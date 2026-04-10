import asyncio
from contextlib import asynccontextmanager, suppress
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import os

# Local ML Imports
from app.ml.racing import RacingPredictor, FEATURE_COLUMNS as RACING_FEATURE_COLUMNS, MODEL_PATH as RACING_MODEL_PATH
from app.ml.afl import AFLPredictor, FEATURE_COLUMNS as AFL_FEATURE_COLUMNS, MODEL_PATH as AFL_MODEL_PATH
from app.ml.nba import NBAPredictor, FEATURE_COLUMNS as NBA_FEATURE_COLUMNS, MODEL_PATH as NBA_MODEL_PATH
from app.bob import (
    bob_request_in_scope,
    build_bob_provider_from_env,
    build_bob_system_prompt,
    build_local_bob_fallback,
    sanitize_bob_messages,
)
import app.nightly as nightly_runner
from app.strategy import StrategyService
from app.time_utils import now_melbourne, today_melbourne

# Local Data Scraper Imports
import app.data.scraper as racing_scraper
import app.data.afl_scraper as afl_scraper
import app.data.nba_scraper as nba_scraper
import app.storage as storage

# CORS — configurable for deployment; defaults to localhost dev
_cors_env = os.getenv("BETMATE_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
CORS_ORIGINS = [origin.strip().rstrip("/") for origin in _cors_env.split(",") if origin.strip()]
NIGHTLY_SCHEDULER_ENABLED = os.getenv("BETMATE_NIGHTLY_SCHEDULER_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}
NIGHTLY_SCHEDULER_TIME = os.getenv("BETMATE_NIGHTLY_SCHEDULER_TIME", nightly_runner.DEFAULT_SCHEDULER_TIME)
_nightly_scheduler_task: Optional[asyncio.Task] = None


async def _nightly_scheduler_loop():
    try:
        scheduled_time = nightly_runner.parse_scheduler_time(NIGHTLY_SCHEDULER_TIME)
    except ValueError as exc:
        print(f"Nightly scheduler disabled: {exc}")
        return

    while True:
        next_run = nightly_runner.next_scheduler_run(scheduled_time=scheduled_time)
        sleep_seconds = max(1.0, (next_run - now_melbourne()).total_seconds())
        print(f"Nightly scheduler sleeping until {next_run.isoformat()}")
        await asyncio.sleep(sleep_seconds)
        try:
            summary = nightly_runner.run_nightly_cycle(
                strategy_service=strategy_service,
                run_date=next_run.date().isoformat(),
            )
            print(f"Nightly strategy cycle completed for {summary['run_date']}")
        except Exception as exc:
            print(f"Nightly strategy cycle failed: {exc}")


@asynccontextmanager
async def lifespan(application: FastAPI):
    global _nightly_scheduler_task
    # Startup
    storage.init_db()
    try:
        print("Initializing Racing ML Model...")
        racing_predictor.load_or_train()
        print("Initializing AFL ML Model...")
        afl_predictor.load_or_train()
        print("Initializing NBA ML Model...")
        nba_predictor.load_or_train()
        print("All ML Models Initialized successfully.")
    except Exception as e:
        print(f"Startup ML init error: {e}")
    if NIGHTLY_SCHEDULER_ENABLED:
        _nightly_scheduler_task = asyncio.create_task(_nightly_scheduler_loop())
    yield
    # Shutdown (nothing to clean up yet)
    if _nightly_scheduler_task is not None:
        _nightly_scheduler_task.cancel()
        with suppress(asyncio.CancelledError):
            await _nightly_scheduler_task
        _nightly_scheduler_task = None


app = FastAPI(title="BetMate Advanced ML Engine", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize models
racing_predictor = RacingPredictor()
afl_predictor = AFLPredictor()
nba_predictor = NBAPredictor()
strategy_service = StrategyService(racing_predictor=racing_predictor, afl_predictor=afl_predictor, nba_predictor=nba_predictor)
bob_provider = build_bob_provider_from_env()

# --- Schemas ---

class Horse(BaseModel):
    horse_id: str
    name: str
    barrier: int
    weight: float
    past_win_rate: float
    jockey_win_rate: float
    track_condition: int
    days_since_last_race: int
    betfair_back_price: float = 0.0
    betfair_implied_prob: float = 0.0
    jockey_name: Optional[str] = None
    data_source: str = "betfair"

class Race(BaseModel):
    race_id: str
    venue: str
    race_number: int
    distance: int
    horses: List[Horse]
    start_time: str = ""
    market_name: str = ""
    meeting_type: str = "unknown"
    meeting_region: str = "unknown"
    state: str = ""
    meeting_date: str = ""
    data_source: str = "betfair"

class TeamGame(BaseModel):
    game_id: str
    home_team: str
    away_team: str
    features: Dict[str, float]

class PredictionResultInput(BaseModel):
    sport: str
    event_id: str
    event_name: Optional[str] = None
    winner_selection: Optional[str] = None
    selection_results: Optional[Dict[str, float]] = None
    completed_at: Optional[str] = None
    result_payload: Optional[Dict[str, Any]] = None

class PredictionResultIngestionInput(BaseModel):
    sports: List[str] = Field(default_factory=lambda: ["afl", "nba"])
    max_results: int = 50
    afl_year: Optional[int] = None
    nba_days_back: int = 7

class PaperBetInput(BaseModel):
    sport: str
    event_id: str
    event_name: str = ""
    selection: str
    stake: float
    odds: Optional[float] = None
    bet_type: str = "win"
    notes: Optional[str] = None
    prediction_log_id: Optional[int] = None

class PaperBetSettleInput(BaseModel):
    status: str
    payout: Optional[float] = None


class StrategyProfilePatchInput(BaseModel):
    display_name: Optional[str] = None
    min_edge: Optional[float] = None
    min_confidence: Optional[str] = None
    max_bets_per_day: Optional[int] = None
    max_stake_per_bet: Optional[float] = None
    kelly_fraction: Optional[float] = None
    allowed_markets: Optional[List[str]] = None
    allow_multis: Optional[bool] = None
    max_multi_legs: Optional[int] = None
    sport_weights: Optional[Dict[str, float]] = None
    notes: Optional[str] = None


class BobChatMessage(BaseModel):
    role: str
    content: str


class BobChatRequest(BaseModel):
    messages: List[BobChatMessage]
    date: Optional[str] = None



@app.get("/")
def root():
    return {
        "message": "BetMate Advanced ML Prediction Engine is online.",
        "version": "2.0.0",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "metadata": "/api/models/metadata"
        }
    }

@app.get("/health")
def health():
    return {"status": "ok", "service": "advanced-ml-engine"}

@app.get("/api/models/metadata")
def get_models_metadata():
    return {
        "models": [
            _model_metadata("Racing", racing_predictor, RACING_FEATURE_COLUMNS, RACING_MODEL_PATH),
            _model_metadata("AFL", afl_predictor, AFL_FEATURE_COLUMNS, AFL_MODEL_PATH),
            _model_metadata("NBA", nba_predictor, NBA_FEATURE_COLUMNS, NBA_MODEL_PATH),
        ]
    }

def _model_metadata(name: str, predictor, feature_columns: List[str], model_path: str):
    importances = getattr(getattr(predictor, "model", None), "feature_importances_", [])
    feature_impact = {
        feature: round(float(importance), 4)
        for feature, importance in zip(feature_columns, importances)
    }
    top_feature = max(feature_impact, key=feature_impact.get) if feature_impact else None

    return {
        "name": name,
        "model_type": "XGBoostClassifier",
        "status": "loaded" if getattr(predictor, "model", None) is not None else "not_loaded",
        "training_source": getattr(predictor, "training_source", None),
        "training_rows": getattr(predictor, "training_rows", 0),
        "feature_count": len(feature_columns),
        "features": feature_columns,
        "feature_impact": feature_impact,
        "top_feature": top_feature,
        "artifact_exists": os.path.exists(model_path),
    }

@app.get("/api/predictions/recent")
def get_recent_predictions(limit: int = 50):
    return {"predictions": storage.get_recent_predictions(limit)}

@app.get("/api/predictions/summary")
def get_prediction_summary():
    return {"summary": storage.get_prediction_summary()}

@app.get("/api/predictions/accuracy")
def get_prediction_accuracy(sport: Optional[str] = None):
    return {"accuracy": storage.get_prediction_accuracy(sport)}

@app.get("/api/predictions/accuracy/trend")
def get_prediction_accuracy_trend(sport: Optional[str] = None, days: int = 30):
    return {"trend": storage.get_prediction_accuracy_trend(sport, days)}

@app.get("/api/predictions/results/recent")
def get_recent_prediction_results(limit: int = 50):
    return {"results": storage.get_recent_results(limit)}

@app.post("/api/predictions/results")
def settle_prediction_result(result: PredictionResultInput):
    try:
        settled_result = storage.settle_prediction_result(
            sport=result.sport,
            event_id=result.event_id,
            winner_selection=result.winner_selection,
            selection_results=result.selection_results,
            event_name=result.event_name,
            completed_at=result.completed_at,
            result_payload=result.result_payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "result": settled_result,
        "accuracy": storage.get_prediction_accuracy(result.sport),
    }

@app.post("/api/predictions/results/ingest")
def ingest_prediction_results(request: Optional[PredictionResultIngestionInput] = None):
    request = request or PredictionResultIngestionInput()
    sports = {sport.strip().lower() for sport in request.sports if sport.strip()}
    if "all" in sports:
        sports = {"afl", "nba"}

    unsupported = sorted(sports - {"afl", "nba"})
    if unsupported:
        raise HTTPException(status_code=400, detail=f"Result ingestion is not available for: {', '.join(unsupported)}")

    ingestion = {
        "sports": {},
        "fetched": 0,
        "settled": 0,
        "skipped_unmatched": 0,
        "errors": [],
    }

    if "afl" in sports:
        afl_results = afl_scraper.fetch_completed_afl_results(
            year=request.afl_year,
            max_results=request.max_results,
        )
        ingestion["sports"]["afl"] = _settle_ingested_results(afl_results)

    if "nba" in sports:
        nba_results = nba_scraper.fetch_completed_nba_results(
            days_back=request.nba_days_back,
            max_results=request.max_results,
        )
        ingestion["sports"]["nba"] = _settle_ingested_results(nba_results)

    for sport_result in ingestion["sports"].values():
        ingestion["fetched"] += sport_result["fetched"]
        ingestion["settled"] += sport_result["settled"]
        ingestion["skipped_unmatched"] += sport_result["skipped_unmatched"]
        ingestion["errors"].extend(sport_result["errors"])

    return {
        "ingestion": ingestion,
        "accuracy": storage.get_prediction_accuracy(),
        "summary": storage.get_prediction_summary(),
    }

def _settle_ingested_results(results: List[Dict[str, Any]]):
    settled = []
    errors = []
    skipped_unmatched = 0

    for result in results:
        try:
            settled.append(storage.settle_prediction_result(**result))
        except ValueError as e:
            if "no logged predictions" in str(e):
                skipped_unmatched += 1
            else:
                errors.append({
                    "sport": result.get("sport"),
                    "event_id": result.get("event_id"),
                    "message": str(e),
                })

    return {
        "fetched": len(results),
        "settled": len(settled),
        "skipped_unmatched": skipped_unmatched,
        "errors": errors,
        "results": settled,
    }

@app.get("/api/paper-bets")
def get_paper_bets(status: Optional[str] = None, sport: Optional[str] = None, limit: int = 50):
    return {"bets": storage.get_paper_bets(status=status, sport=sport, limit=limit)}

@app.get("/api/paper-bets/summary")
def get_paper_bet_summary(sport: Optional[str] = None):
    return {"summary": storage.get_paper_bet_summary(sport)}

@app.get("/api/paper-bets/trend")
def get_paper_bet_trend(sport: Optional[str] = None, days: int = 30):
    return {"trend": storage.get_paper_bet_trend(sport, days)}

@app.post("/api/paper-bets")
def create_paper_bet(bet: PaperBetInput):
    try:
        created = storage.create_paper_bet(
            sport=bet.sport,
            event_id=bet.event_id,
            event_name=bet.event_name,
            selection=bet.selection,
            stake=bet.stake,
            odds=bet.odds,
            bet_type=bet.bet_type,
            notes=bet.notes,
            prediction_log_id=bet.prediction_log_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "bet": created,
        "summary": storage.get_paper_bet_summary(bet.sport),
    }

@app.patch("/api/paper-bets/{bet_id}/settle")
def settle_paper_bet(bet_id: int, settlement: PaperBetSettleInput):
    try:
        bet = storage.settle_paper_bet(bet_id, settlement.status, settlement.payout)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "bet": bet,
        "summary": storage.get_paper_bet_summary(bet["sport"]),
    }

@app.delete("/api/paper-bets/{bet_id}")
def delete_paper_bet(bet_id: int):
    deleted = storage.delete_paper_bet(bet_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="paper bet not found")

    return {"deleted": True, "summary": storage.get_paper_bet_summary()}


@app.get("/api/strategy-profiles")
def list_strategy_profiles():
    return {"profiles": storage.list_strategy_profiles()}


@app.get("/api/strategy-profiles/{profile_key}")
def get_strategy_profile(profile_key: str):
    profile = storage.get_strategy_profile(profile_key)
    if not profile:
        raise HTTPException(status_code=404, detail="strategy profile not found")
    return profile


@app.patch("/api/strategy-profiles/james")
def patch_james_strategy_profile(payload: StrategyProfilePatchInput):
    updates = {key: value for key, value in payload.model_dump().items() if value is not None}
    try:
        profile = storage.update_strategy_profile("james", updates)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return profile


@app.get("/api/strategy-cards")
def get_strategy_cards(date: Optional[str] = None):
    run_date = date or today_melbourne().isoformat()
    try:
        cards = strategy_service.get_or_create_cards(run_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"cards": cards}


@app.get("/api/strategy-cards/{profile_key}")
def get_strategy_card(profile_key: str, date: Optional[str] = None):
    run_date = date or today_melbourne().isoformat()
    try:
        card = strategy_service.get_or_create_card(profile_key, run_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return card


@app.get("/api/system-bets")
def get_system_bets(profile_key: Optional[str] = None, limit: int = 200):
    return {"bets": storage.list_system_bets(profile_key=profile_key, limit=limit)}


@app.post("/api/bob/chat")
async def bob_chat(request: BobChatRequest):
    today_date = today_melbourne().isoformat()
    run_date = request.date or today_date
    messages = sanitize_bob_messages([message.model_dump() for message in request.messages])
    if not bob_request_in_scope(messages, run_date, today_date):
        return {
            "message": "Bob only explains today's Bob card, why bets qualified or were skipped, profile differences, bankroll allocation, and paper-bet context.",
            "card_date": run_date,
            "scope": "refused",
        }

    bob_card = strategy_service.get_or_create_card("bob", run_date)
    all_cards = strategy_service.get_or_create_cards(run_date)
    event_ids = {bet["event_id"] for bet in bob_card.get("selected_bets", [])}
    relevant_predictions = [
        prediction
        for prediction in storage.get_recent_predictions(limit=500)
        if prediction["event_id"] in event_ids
    ]
    bob_context = {
        "card_date": run_date,
        "strategy_card": bob_card,
        "all_profile_cards": [
            {
                "profile_key": card["profile_key"],
                "display_name": card["display_name"],
                "total_allocated": card["total_allocated"],
                "selected_count": len(card.get("selected_bets", [])),
                "expected_edge": card.get("expected_edge", 0.0),
            }
            for card in all_cards
        ],
        "model_signals": relevant_predictions,
    }
    if bob_provider is None:
        return {
            "message": build_local_bob_fallback(messages, bob_context),
            "card_date": run_date,
            "scope": "local_fallback",
        }

    try:
        answer = await bob_provider.complete(
            system_prompt=build_bob_system_prompt(bob_context),
            messages=messages,
            max_tokens=1000,
        )
        return {"message": answer, "card_date": run_date, "scope": "provider"}
    except Exception:
        return {
            "message": build_local_bob_fallback(messages, bob_context),
            "card_date": run_date,
            "scope": "provider_fallback",
        }

# --- RACING ENDPOINTS ---

@app.get("/api/races/today")
def get_today_races(date: Optional[str] = None):
    """Fetch live/mock data for a Melbourne date (defaults to today)."""
    try:
        races = racing_scraper.fetch_today_races(run_date=date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"races": races}

@app.post("/api/predict/racing")
def predict_race(race: Race):
    """Predict win probabilities for a racing field."""
    horse_dicts = []
    features_keys = RACING_FEATURE_COLUMNS
    
    for h in race.horses:
        horse_dicts.append({k: getattr(h, k) for k in features_keys})
        
    try:
        probabilities, importances = racing_predictor.predict(horse_dicts)
        predictions = []
        for i, h in enumerate(race.horses):
            predictions.append({
                "horse_id": h.horse_id,
                "name": h.name,
                "win_probability": round(probabilities[i] * 100, 2),
                "fair_odds": round(1 / probabilities[i], 2) if probabilities[i] > 0 else 999.0
            })
            
        predictions.sort(key=lambda x: x["win_probability"], reverse=True)
        feature_impact = dict(zip(features_keys, [round(imp, 4) for imp in importances]))
        storage.log_prediction_batch(
            sport="racing",
            event_id=race.race_id,
            event_name=f"{race.venue} R{race.race_number}",
            predictions=[
                {
                    "selection": prediction["name"],
                    "probability": prediction["win_probability"],
                    "fair_odds": prediction["fair_odds"],
                    "payload": prediction,
                }
                for prediction in predictions
            ],
            feature_impact=feature_impact,
        )
        
        return {
            "race_id": race.race_id,
            "predictions": predictions,
            "feature_impact": feature_impact,
            "ai_insights_context": f"Racing ML model heavily weighted {max(feature_impact, key=feature_impact.get)}."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- AFL ENDPOINTS ---

@app.get("/api/afl/games/upcoming")
def get_upcoming_afl(date: Optional[str] = None):
    try:
        games = afl_scraper.fetch_this_week_afl(run_date=date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"games": games}

@app.get("/api/afl/games/live")
def stream_live_afl_games():
    return StreamingResponse(
        afl_scraper.stream_live_afl_games(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@app.post("/api/predict/afl")
def predict_afl(game: TeamGame):
    try:
        result = afl_predictor.predict(game.features)
        
        # Mapping features back for explainability
        feature_keys = result.get('feature_names', AFL_FEATURE_COLUMNS)
        importances = dict(zip(feature_keys, [round(i, 4) for i in result['feature_impact']]))
        
        # Calculate fair odds
        home_odds = round(1 / result['home_win_prob'], 2) if result['home_win_prob'] > 0 else 999
        away_odds = round(1 / result['away_win_prob'], 2) if result['away_win_prob'] > 0 else 999
        home_probability = round(result['home_win_prob'] * 100, 2)
        away_probability = round(result['away_win_prob'] * 100, 2)
        storage.log_prediction_batch(
            sport="afl",
            event_id=game.game_id,
            event_name=f"{game.home_team} vs {game.away_team}",
            predictions=[
                {
                    "selection": game.home_team,
                    "probability": home_probability,
                    "fair_odds": home_odds,
                },
                {
                    "selection": game.away_team,
                    "probability": away_probability,
                    "fair_odds": away_odds,
                },
            ],
            feature_impact=importances,
        )
        
        return {
            "game_id": game.game_id,
            "predictions": {
                "home_team": game.home_team,
                "away_team": game.away_team,
                "home_win_probability": home_probability,
                "away_win_probability": away_probability,
                "fair_odds_home": home_odds,
                "fair_odds_away": away_odds
            },
            "feature_impact": importances,
            "ai_insights_context": f"AFL ML model found {max(importances, key=importances.get)} to be the deciding factor."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- NBA ENDPOINTS ---

@app.get("/api/nba/games/today")
def get_today_nba(date: Optional[str] = None):
    try:
        games = nba_scraper.fetch_today_nba(run_date=date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"games": games}

@app.post("/api/predict/nba")
def predict_nba(game: TeamGame):
    try:
        result = nba_predictor.predict(game.features)
        
        feature_keys = result.get('feature_names', NBA_FEATURE_COLUMNS)
        importances = dict(zip(feature_keys, [round(i, 4) for i in result['feature_impact']]))
        
        home_odds = round(1 / result['home_win_prob'], 2) if result['home_win_prob'] > 0 else 999
        away_odds = round(1 / result['away_win_prob'], 2) if result['away_win_prob'] > 0 else 999
        home_probability = round(result['home_win_prob'] * 100, 2)
        away_probability = round(result['away_win_prob'] * 100, 2)
        storage.log_prediction_batch(
            sport="nba",
            event_id=game.game_id,
            event_name=f"{game.home_team} vs {game.away_team}",
            predictions=[
                {
                    "selection": game.home_team,
                    "probability": home_probability,
                    "fair_odds": home_odds,
                },
                {
                    "selection": game.away_team,
                    "probability": away_probability,
                    "fair_odds": away_odds,
                },
            ],
            feature_impact=importances,
        )
        
        return {
            "game_id": game.game_id,
            "predictions": {
                "home_team": game.home_team,
                "away_team": game.away_team,
                "home_win_probability": home_probability,
                "away_win_probability": away_probability,
                "fair_odds_home": home_odds,
                "fair_odds_away": away_odds
            },
            "feature_impact": importances,
            "ai_insights_context": f"NBA ML strongly correlated {max(importances, key=importances.get)} to the outcome."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
