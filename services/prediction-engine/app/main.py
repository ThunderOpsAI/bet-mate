import base64
import hashlib
import hmac
import json
import binascii
import logging
import time
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import os

# Local ML Imports
from app.ml.racing import RacingPredictor, FEATURE_COLUMNS as RACING_FEATURE_COLUMNS, MODEL_PATH as RACING_MODEL_PATH
from app.ml.afl import AFLPredictor, FEATURE_COLUMNS as AFL_FEATURE_COLUMNS, MODEL_PATH as AFL_MODEL_PATH
from app.ml.nba import NBAPredictor, FEATURE_COLUMNS as NBA_FEATURE_COLUMNS, MODEL_PATH as NBA_MODEL_PATH
from app.ml.nrl import NRLPredictor, MODEL_PATH as NRL_MODEL_PATH
from app.ml.soccer import SoccerPredictor, MODEL_PATH as SOCCER_MODEL_PATH
from app.ml.golf import GolfPredictor, MODEL_PATH as GOLF_MODEL_PATH
from app.ml.mma import MMAPredictor, MODEL_PATH as MMA_MODEL_PATH
from app.ml.weights import WEIGHTS_VERSION
from app.bob import (
    bob_request_in_scope,
    build_bob_provider_from_env,
    build_bob_system_prompt,
    build_local_bob_fallback,
    sanitize_bob_messages,
)
from app.notifications import notify_blackbook_trigger
from app.strategy import StrategyService, build_strategy_card
from app.time_utils import today_melbourne
from app import database as database_mod
from app.ml import artifacts as artifact_store

# Local Data Scraper Imports
import app.data.scraper as racing_scraper
import app.data.afl_scraper as afl_scraper
import app.data.nba_scraper as nba_scraper
import app.data.nrl_scraper as nrl_scraper
import app.data.soccer_scraper as soccer_scraper
import app.data.golf_scraper as golf_scraper
import app.data.mma_scraper as mma_scraper
import app.storage as storage
from app.data.betfair_sports_odds import get_cached_sport_odds, match_event_odds, match_golfer_odds

# CORS — configurable for deployment; defaults to localhost dev
_cors_env = os.getenv("BETMATE_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
CORS_ORIGINS = [origin.strip().rstrip("/") for origin in _cors_env.split(",") if origin.strip()]
LOGGER = logging.getLogger("betmate.prediction_engine")


def _configure_logging() -> None:
    if logging.getLogger().handlers:
        return
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


def _log_model_initialization(name: str, predictor, model_path: str) -> None:
    artifact_exists = os.path.exists(model_path)
    LOGGER.info("%s artifact %s at %s", name, "present" if artifact_exists else "missing", model_path)
    started_at = time.perf_counter()
    predictor.load_or_train()
    LOGGER.info(
        "%s model ready in %.2fs training_source=%s training_rows=%s",
        name,
        time.perf_counter() - started_at,
        getattr(predictor, "training_source", None),
        getattr(predictor, "training_rows", 0),
    )


@asynccontextmanager
async def lifespan(application: FastAPI):
    _configure_logging()
    database_mod.require_database_url()
    storage.init_db()
    database_mod.validate_persistence_configuration()
    database_mod.verify_database_connection()
    LOGGER.info("Database connection verified successfully.")
    volume_path = artifact_store.ensure_volume_mount()
    LOGGER.info("Model artifact volume mount ready at %s", volume_path)
    _log_model_initialization("Racing", racing_predictor, RACING_MODEL_PATH)
    _log_model_initialization("AFL", afl_predictor, AFL_MODEL_PATH)
    _log_model_initialization("NBA", nba_predictor, NBA_MODEL_PATH)
    _log_model_initialization("NRL", nrl_predictor, NRL_MODEL_PATH)
    _log_model_initialization("Soccer", soccer_predictor, SOCCER_MODEL_PATH)
    _log_model_initialization("Golf", golf_predictor, GOLF_MODEL_PATH)
    _log_model_initialization("MMA", mma_predictor, MMA_MODEL_PATH)
    LOGGER.info("Prediction engine cold start completed.")
    yield


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
nrl_predictor = NRLPredictor()
soccer_predictor = SoccerPredictor()
golf_predictor = GolfPredictor()
mma_predictor = MMAPredictor()
strategy_service = StrategyService(racing_predictor=racing_predictor, afl_predictor=afl_predictor, nba_predictor=nba_predictor)
bob_provider = build_bob_provider_from_env()


def _decode_jwt_payload(token: str) -> Dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("malformed token")

    header_b64, payload_b64, signature_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    secret = os.getenv("JWT_SECRET", "change-me-in-production").encode("utf-8")
    expected_sig = hmac.new(secret, signing_input, hashlib.sha256).digest()
    actual_sig = base64.urlsafe_b64decode(signature_b64 + "=" * (-len(signature_b64) % 4))
    if not hmac.compare_digest(expected_sig, actual_sig):
        raise ValueError("invalid signature")

    payload_raw = base64.urlsafe_b64decode(payload_b64 + "=" * (-len(payload_b64) % 4))
    payload = json.loads(payload_raw.decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("invalid payload")
    return payload


def require_user_id(authorization: str = Header(default="", alias="Authorization")) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization[7:].strip()
    if not token or token.lower() in ("guest", "null", "undefined"):
        user_id = "guest"
        database_mod.user_id_ctx.set(user_id)
        return user_id

    try:
        payload = _decode_jwt_payload(token)
        user_id = payload.get("sub") or payload.get("user_id") or "guest"
    except Exception:
        try:
            parts = token.split(".")
            if len(parts) == 3:
                payload_b64 = parts[1]
                payload_raw = base64.urlsafe_b64decode(payload_b64 + "=" * (-len(payload_b64) % 4))
                payload = json.loads(payload_raw.decode("utf-8"))
                user_id = str(payload.get("sub") or payload.get("user_id") or "guest")
            else:
                user_id = "guest"
        except Exception:
            user_id = "guest"

    user_id = user_id if user_id.strip() else "guest"
    database_mod.user_id_ctx.set(user_id)
    return user_id


def resolve_optional_user_id(
    authorization: str = Header(default="", alias="Authorization"),
    fallback_user_id: Optional[str] = None,
) -> str:
    if authorization.startswith("Bearer "):
        return require_user_id(authorization)

    if fallback_user_id and fallback_user_id.strip():
        user_id = fallback_user_id.strip()
        database_mod.user_id_ctx.set(user_id)
        return user_id

    raise HTTPException(status_code=401, detail="Missing bearer token")

# --- Schemas ---

class Horse(BaseModel):
    horse_id: str
    name: str
    barrier: int = 1
    weight: float = 58.0
    past_win_rate: float = 0.1
    jockey_win_rate: float = 0.1
    track_condition: int = 5
    days_since_last_race: int = 14
    betfair_back_price: float = 0.0
    betfair_implied_prob: float = 0.0
    jockey_name: Optional[str] = None
    data_source: str = "betfair"
    
    # New Phase 0 ML Features
    speed_rating: float = 0.5
    horse_win_rate: float = 0.12
    track_conditions: float = 0.5
    recent_form: float = 0.5
    class_factor: float = 0.5
    horse_jockey_proven: float = 0.0
    jockey_trainer_proven: float = 0.0

class Race(BaseModel):
    race_id: str
    venue: str
    canonical_venue: str = ""
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
    sports: List[str] = Field(default_factory=lambda: ["afl", "nba", "racing"])
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


class BlackbookAutoBetInput(BaseModel):
    user_id: Optional[str] = None
    sport: str
    bet_type: str = "win"
    stake: float
    enabled: bool = True
    probability_threshold: float = Field(default=50.0, ge=1.0, le=99.9)
    notify_phone: Optional[str] = None
    notify_email: Optional[str] = None
    notify_pushover_key: Optional[str] = None


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
        sports = {"afl", "nba", "racing"}

    unsupported = sorted(sports - {"afl", "nba", "racing"})
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

    if "racing" in sports:
        racing_targets = storage.list_pending_racing_result_targets(limit=request.max_results)
        racing_results = racing_scraper.fetch_completed_racing_results(
            racing_targets,
            max_results=request.max_results,
        )
        ingestion["sports"]["racing"] = _settle_ingested_results(racing_results)

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
def get_paper_bets(
    status: Optional[str] = None,
    sport: Optional[str] = None,
    limit: int = 50,
    user_id: str = Depends(require_user_id),
):
    return {"bets": storage.get_paper_bets(status=status, sport=sport, limit=limit, user_id=user_id)}

@app.get("/api/paper-bets/summary")
def get_paper_bet_summary(sport: Optional[str] = None, user_id: str = Depends(require_user_id)):
    return {"summary": storage.get_paper_bet_summary(sport, user_id=user_id)}

@app.get("/api/paper-bets/trend")
def get_paper_bet_trend(sport: Optional[str] = None, days: int = 30, user_id: str = Depends(require_user_id)):
    return {"trend": storage.get_paper_bet_trend(sport, days, user_id=user_id)}

@app.post("/api/paper-bets")
def create_paper_bet(bet: PaperBetInput, user_id: str = Depends(require_user_id)):
    try:
        created = storage.create_paper_bet(
            user_id=user_id,
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
        "summary": storage.get_paper_bet_summary(bet.sport, user_id=user_id),
    }

@app.post("/api/paper-bets/batch")
def create_paper_bets_batch(bets: List[PaperBetInput], user_id: str = Depends(require_user_id)):
    created_bets = []
    # If there are a lot of bets, consider using a database transaction if storage supports it.
    # For now, we'll loop to reuse existing logic.
    for bet in bets:
        try:
            created = storage.create_paper_bet(
                user_id=user_id,
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
            created_bets.append(created)
        except Exception as exc:
            # Continue to next if one fails? Or return which ones failed?
            # For simplicity, we just log and continue.
            LOGGER.error("[Batch] Failed to create bet: %s", exc, exc_info=True)

    return {
        "success": True,
        "count": len(created_bets),
        "bets": created_bets,
        "summary": storage.get_paper_bet_summary(user_id=user_id),
    }

@app.patch("/api/paper-bets/{bet_id}/settle")
def settle_paper_bet(bet_id: int, settlement: PaperBetSettleInput, user_id: str = Depends(require_user_id)):
    try:
        bet = storage.settle_paper_bet(bet_id, settlement.status, settlement.payout, user_id=user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "bet": bet,
        "summary": storage.get_paper_bet_summary(bet["sport"], user_id=user_id),
    }

@app.delete("/api/paper-bets/{bet_id}")
def delete_paper_bet(bet_id: int, user_id: str = Depends(require_user_id)):
    deleted = storage.delete_paper_bet(bet_id, user_id=user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="paper bet not found")

    return {"deleted": True, "summary": storage.get_paper_bet_summary(user_id=user_id)}


@app.get("/blackbook/{runner}/auto-bet")
def get_blackbook_auto_bet(
    runner: str,
    user_id: Optional[str] = None,
    authorization: str = Header(default="", alias="Authorization"),
):
    resolved_user_id = resolve_optional_user_id(authorization, user_id)
    config = storage.get_blackbook_auto_bet_config(runner=runner, user_id=resolved_user_id)
    if not config:
        raise HTTPException(status_code=404, detail="auto-bet config not found")
    return {"config": config}


@app.put("/blackbook/{runner}/auto-bet")
def upsert_blackbook_auto_bet(
    runner: str,
    payload: BlackbookAutoBetInput,
    authorization: str = Header(default="", alias="Authorization"),
):
    resolved_user_id = resolve_optional_user_id(authorization, payload.user_id)
    try:
        config = storage.upsert_blackbook_auto_bet_config(
            runner=runner,
            user_id=resolved_user_id,
            sport=payload.sport,
            bet_type=payload.bet_type,
            stake=payload.stake,
            enabled=payload.enabled,
            probability_threshold=payload.probability_threshold,
            notify_phone=payload.notify_phone,
            notify_email=payload.notify_email,
            notify_pushover_key=payload.notify_pushover_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"config": config}


@app.get("/blackbook")
def list_blackbook_auto_bets(user_id: str = Depends(require_user_id)):
    configs = storage.list_blackbook_auto_bet_configs_for_user(user_id=user_id)
    return {"configs": configs}


@app.delete("/blackbook/{runner}/auto-bet")
def delete_blackbook_auto_bet(runner: str, user_id: str = Depends(require_user_id)):
    deleted = storage.delete_blackbook_auto_bet_config(runner=runner, user_id=user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="auto-bet config not found")
    return {"deleted": True}


@app.get("/blackbook/running-today")
def blackbook_running_today(
    user_id: Optional[str] = None,
    authorization: str = Header(default="", alias="Authorization"),
):
    resolved_user_id = None
    if user_id:
        resolved_user_id = resolve_optional_user_id(authorization, user_id)
        
    user_items = []
    if resolved_user_id:
        try:
            with database_mod.get_connection() as conn:
                items = conn.execute('SELECT * FROM "BlackbookItem" WHERE "userId" = ?', (resolved_user_id,)).fetchall()
                user_items = [dict(row) for row in items]
        except Exception as exc:
            LOGGER.error("Failed to fetch user blackbook items: %s", exc)

    try:
        races = racing_scraper.fetch_today_races()
    except Exception as exc:
        LOGGER.error("Failed to fetch races for blackbook running today: %s", exc)
        return []

    runners = []
    features_keys = RACING_FEATURE_COLUMNS
    for race_dict in races:
        horses_list = race_dict.get("horses", [])
        if not horses_list:
            continue
            
        horse_dicts = []
        for h_dict in horses_list:
            try:
                h_obj = Horse(**h_dict)
                horse_dicts.append({k: getattr(h_obj, k) for k in features_keys})
            except Exception:
                horse_dicts.append({k: h_dict.get(k, 0.0) for k in features_keys})
                
        try:
            probabilities, _ = racing_predictor.predict(horse_dicts)
        except Exception as exc:
            LOGGER.error("Failed to predict for race %s: %s", race_dict.get("race_id"), exc)
            continue
            
        for i, h_dict in enumerate(horses_list):
            win_prob = probabilities[i]
            fair_odds = round(1 / win_prob, 2) if win_prob > 0 else 999.0
            betfair_odds = h_dict.get("betfair_back_price", 0.0)
            is_value = bool(betfair_odds > (fair_odds * 1.10)) if fair_odds > 0 else False
            
            runner_obj = {
                "horseName": h_dict.get("name", "Unknown"),
                "venue": race_dict.get("venue", "Unknown"),
                "raceNumber": race_dict.get("race_number", 1),
                "startTime": race_dict.get("start_time", ""),
                "betfairOdds": betfair_odds,
                "mlFairOdds": fair_odds,
                "isValue": is_value,
                "winProbability": round(win_prob * 100, 2),
                "last5": h_dict.get("recent_form_str", "") or h_dict.get("last_5", "") or "x-x-x-x-x"
            }
            
            if resolved_user_id:
                matched = False
                matched_conditions = []
                for item in user_items:
                    t_name = item.get("targetName", "").lower()
                    e_type = item.get("entityType", "RUNNER")
                    
                    is_match = False
                    if e_type == "RUNNER" and t_name in runner_obj["horseName"].lower():
                        is_match = True
                    elif e_type == "JOCKEY" and t_name in (h_dict.get("jockey_name") or "").lower():
                        is_match = True
                    elif e_type == "TRAINER" and t_name in (h_dict.get("trainer_name") or "").lower():
                        is_match = True
                        
                    if is_match:
                        matched = True
                        # Simplified condition check for Sprint 2
                        conds = item.get("conditions", "{}")
                        try:
                            cond_dict = json.loads(conds) if isinstance(conds, str) else conds
                            if cond_dict:
                                matched_conditions.extend(list(cond_dict.keys()))
                        except Exception:
                            pass
                            
                if not matched:
                    continue
                runner_obj["conditionsMet"] = True
                runner_obj["matchedConditions"] = matched_conditions
                
            runners.append(runner_obj)
            
    return runners


@app.get("/blackbook/search")
def blackbook_search(q: str = ""):
    import re
    def norm(s: str) -> str:
        return re.sub(r'[^a-z0-9]', '', s.lower())
        
    nq = norm(q)
    if not nq:
        return {"horses": [], "jockeys": [], "trainers": []}
        
    try:
        races = racing_scraper.fetch_today_races()
    except Exception:
        return {"horses": [], "jockeys": [], "trainers": []}
        
    results = []
    
    for race_dict in races:
        venue = race_dict.get("venue", "Unknown")
        race_number = race_dict.get("race_number", 1)
        start_time = race_dict.get("start_time", "")
        
        for h_dict in race_dict.get("horses", []):
            horse_name = h_dict.get("name", "")
            jockey_name = h_dict.get("jockey_name", "")
            trainer_name = h_dict.get("trainer_name", "")
            
            if horse_name and nq in norm(horse_name):
                results.append({
                    "id": f"horse_{horse_name}_{venue}_{race_number}",
                    "name": horse_name,
                    "venue": venue,
                    "raceNumber": race_number,
                    "startTime": start_time,
                    "type": "horse"
                })
                
            if jockey_name and nq in norm(jockey_name):
                results.append({
                    "id": f"jockey_{jockey_name}_{venue}_{race_number}",
                    "name": jockey_name,
                    "venue": venue,
                    "raceNumber": race_number,
                    "startTime": start_time,
                    "type": "jockey"
                })
                
            if trainer_name and nq in norm(trainer_name):
                results.append({
                    "id": f"trainer_{trainer_name}_{venue}_{race_number}",
                    "name": trainer_name,
                    "venue": venue,
                    "raceNumber": race_number,
                    "startTime": start_time,
                    "type": "trainer"
                })
                
    # Deduplicate results by type and name for jockeys and trainers
    seen = set()
    deduped_results = []
    for r in results:
        key = f"{r['type']}_{r['name']}"
        if r['type'] in ('jockey', 'trainer'):
            if key not in seen:
                seen.add(key)
                deduped_results.append(r)
        else:
            deduped_results.append(r)
            
    return {
        "results": deduped_results
    }


@app.get("/explore/hot-picks")
def explore_hot_picks():
    # Return today's runners with highest ML win confidence
    runners = blackbook_running_today()
    if not runners:
        return []
    runners_sorted = sorted(runners, key=lambda x: x.get("winProbability", 0), reverse=True)
    return runners_sorted[:50]

@app.get("/explore/value-plays")
def explore_value_plays():
    # Return runners where isValue === true, sorted by edge
    runners = blackbook_running_today()
    if not runners:
        return []
    value_runners = [r for r in runners if r.get("isValue")]
    def edge(r):
        bf = float(r.get("betfairOdds") or 0)
        ml = float(r.get("mlFairOdds") or 999)
        return bf / ml if ml > 0 else 0
    value_runners_sorted = sorted(value_runners, key=edge, reverse=True)
    return value_runners_sorted[:50]

@app.get("/explore/top-jockeys")
def explore_top_jockeys():
    try:
        races = racing_scraper.fetch_today_races()
    except Exception:
        return []
    
    jockey_counts = {}
    for race in races:
        venue = race.get("venue", "Unknown")
        for horse in race.get("horses", []):
            j_name = horse.get("jockey_name")
            if j_name:
                if j_name not in jockey_counts:
                    jockey_counts[j_name] = {"id": j_name, "name": j_name, "raceCount": 0, "venues": set(), "roi": None}
                jockey_counts[j_name]["raceCount"] += 1
                jockey_counts[j_name]["venues"].add(venue)
                
    result = list(jockey_counts.values())
    for r in result:
        r["venues"] = list(r["venues"])
    result_sorted = sorted(result, key=lambda x: x["raceCount"], reverse=True)
    return result_sorted[:20]

@app.get("/explore/top-trainers")
def explore_top_trainers():
    try:
        races = racing_scraper.fetch_today_races()
    except Exception:
        return []
    
    trainer_counts = {}
    for race in races:
        venue = race.get("venue", "Unknown")
        for horse in race.get("horses", []):
            t_name = horse.get("trainer_name")
            if t_name:
                if t_name not in trainer_counts:
                    trainer_counts[t_name] = {"id": t_name, "name": t_name, "raceCount": 0, "venues": set(), "roi": None}
                trainer_counts[t_name]["raceCount"] += 1
                trainer_counts[t_name]["venues"].add(venue)
                
    result = list(trainer_counts.values())
    for r in result:
        r["venues"] = list(r["venues"])
    result_sorted = sorted(result, key=lambda x: x["raceCount"], reverse=True)
    return result_sorted[:50]


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


@app.post("/api/strategy-cards/refresh")
def refresh_strategy_cards(date: Optional[str] = None):
    run_date = date or today_melbourne().isoformat()
    try:
        candidates = strategy_service.collect_candidates_for_date(run_date)
        profiles = storage.list_strategy_profiles()
        cards = []
        for profile in profiles:
            card = build_strategy_card(profile, candidates, run_date)
            saved = storage.save_strategy_card(card, replace=True)
            cards.append(saved)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to refresh strategy cards: {exc}")
    return {"status": "success", "run_date": run_date, "count": len(cards), "cards": cards}



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
@app.get("/api/racing/today")
@app.get("/api/races/next")
@app.get("/api/racing/next")
def get_today_races(
    date: Optional[str] = None,
    type: Optional[str] = None,
    race_type: Optional[str] = None,
):
    """Fetch live race data for a Melbourne date (defaults to today)."""
    selected_type = type or race_type
    try:
        races = racing_scraper.fetch_today_races(run_date=date, race_type=selected_type)
        if len(races) == 0:
            import datetime
            from app.time_utils import today_melbourne
            req_date = datetime.date.fromisoformat(date) if date else today_melbourne()
            tomorrow = (req_date + datetime.timedelta(days=1)).isoformat()
            tomorrow_races = racing_scraper.fetch_today_races(run_date=tomorrow, race_type=selected_type)
            existing_ids = {r["race_id"] for r in races}
            for tr in tomorrow_races:
                if tr["race_id"] not in existing_ids:
                    races.append(tr)
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
                    "payload": {
                        **prediction,
                        "venue": race.venue,
                        "canonical_venue": race.canonical_venue or race.venue,
                        "race_number": race.race_number,
                        "meeting_date": race.meeting_date,
                        "state": race.state,
                        "meeting_region": race.meeting_region,
                        "market_name": race.market_name,
                        "start_time": race.start_time,
                        "distance": race.distance,
                        "data_source": race.data_source,
                    },
                }
                for prediction in predictions
            ],
            feature_impact=feature_impact,
        )

        # Blackbook auto-bet trigger — check each prediction against watching configs
        for prediction in predictions:
            configs = storage.list_blackbook_auto_bet_configs_for_runner(prediction["name"])
            for cfg in configs:
                if prediction["win_probability"] >= cfg["probability_threshold"]:
                    try:
                        storage.create_paper_bet(
                            sport="racing",
                            event_id=race.race_id,
                            event_name=f"{race.venue} R{race.race_number}",
                            selection=prediction["name"],
                            bet_type=cfg.get("bet_type", "win"),
                            odds=prediction["fair_odds"],
                            stake=cfg["stake"],
                            origin="blackbook",
                            user_id=cfg["user_id"],
                        )
                        notify_blackbook_trigger(
                            runner=prediction["name"],
                            probability=prediction["win_probability"],
                            stake=cfg["stake"],
                            bet_type=cfg.get("bet_type", "win"),
                            user_config=cfg,
                        )
                    except Exception as exc:
                        print(f"[blackbook] trigger failed for {prediction['name']}/{cfg['user_id']}: {exc}")

        return {
            "race_id": race.race_id,
            "predictions": predictions,
            "feature_impact": feature_impact,
            "ai_insights_context": f"Racing ML model heavily weighted {max(feature_impact, key=feature_impact.get)}.",
            "model_metadata": {
                "feature_importance": feature_impact,
                "last_trained": "auto-tune pending",
                "version": WEIGHTS_VERSION
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/predict/racing/batch")
def predict_racing_batch(payload: Dict[str, Any]):
    """Batch predict win probabilities for multiple racing fields."""
    raw_races = payload.get("races", []) if isinstance(payload, dict) else []
    results = {}
    for race_data in raw_races:
        try:
            race = Race.model_validate(race_data) if isinstance(race_data, dict) else race_data
            pred = predict_race(race)
            results[race.race_id] = pred
        except Exception as exc:
            race_id = race_data.get("race_id") if isinstance(race_data, dict) else "unknown"
            LOGGER.error("Error predicting batch race %s: %s", race_id, exc)
    return results

FALLBACK_AFL_GAMES = [
    {
        "game_id": "afl_fb_1",
        "home_team": "Collingwood",
        "away_team": "Carlton",
        "features": {"home_rest_days": 7, "travel_distance_away": 0, "weather_condition": 1, "home_win_streak": 3, "away_win_streak": 2, "points_difference": 12.5},
        "round": 1,
        "venue": "MCG",
        "date": "2026-08-07T19:50:00Z",
        "complete": 0,
        "hscore": None,
        "ascore": None,
        "squiggle_tip": "Collingwood",
        "squiggle_confidence": 62,
    },
    {
        "game_id": "afl_fb_2",
        "home_team": "Brisbane Lions",
        "away_team": "Geelong Cats",
        "features": {"home_rest_days": 6, "travel_distance_away": 1600, "weather_condition": 1, "home_win_streak": 4, "away_win_streak": 1, "points_difference": 18.0},
        "round": 1,
        "venue": "Gabba",
        "date": "2026-08-08T14:10:00Z",
        "complete": 0,
        "hscore": None,
        "ascore": None,
        "squiggle_tip": "Brisbane Lions",
        "squiggle_confidence": 68,
    },
    {
        "game_id": "afl_fb_3",
        "home_team": "Sydney Swans",
        "away_team": "GWS Giants",
        "features": {"home_rest_days": 7, "travel_distance_away": 35, "weather_condition": 2, "home_win_streak": 2, "away_win_streak": 3, "points_difference": 5.5},
        "round": 1,
        "venue": "SCG",
        "date": "2026-08-08T19:30:00Z",
        "complete": 0,
        "hscore": None,
        "ascore": None,
        "squiggle_tip": "Sydney Swans",
        "squiggle_confidence": 55,
    },
]

FALLBACK_NBA_GAMES = [
    {
        "game_id": "nba_fb_1",
        "home_team": "Boston Celtics",
        "away_team": "Los Angeles Lakers",
        "features": {"home_rest_days": 2, "travel_distance_away": 3000, "home_win_pct": 0.72, "away_win_pct": 0.58, "net_rating_diff": 6.5},
        "venue": "TD Garden",
        "date": "2026-08-07T23:30:00Z",
        "complete": 0,
    },
    {
        "game_id": "nba_fb_2",
        "home_team": "Golden State Warriors",
        "away_team": "Denver Nuggets",
        "features": {"home_rest_days": 1, "travel_distance_away": 1200, "home_win_pct": 0.65, "away_win_pct": 0.68, "net_rating_diff": 2.1},
        "venue": "Chase Center",
        "date": "2026-08-08T02:00:00Z",
        "complete": 0,
    },
]

FALLBACK_NRL_GAMES = [
    {
        "game_id": "nrl_fb_1",
        "home_team": "Penrith Panthers",
        "away_team": "Brisbane Broncos",
        "features": {"points_differential": 8.5, "recent_form": 0.4, "head_to_head": 0.3, "home_advantage_base": 0.05, "live_odds_signal": 0.6},
        "venue": "BlueBet Stadium",
        "date": "2026-08-07T10:00:00Z",
        "complete": 0,
    },
    {
        "game_id": "nrl_fb_2",
        "home_team": "Melbourne Storm",
        "away_team": "Sydney Roosters",
        "features": {"points_differential": 6.2, "recent_form": 0.3, "head_to_head": 0.2, "home_advantage_base": 0.05, "live_odds_signal": 0.55},
        "venue": "AAMI Park",
        "date": "2026-08-08T09:35:00Z",
        "complete": 0,
    },
]

FALLBACK_SOCCER_GAMES = [
    {
        "game_id": "soccer_fb_1",
        "home_team": "Arsenal",
        "away_team": "Chelsea",
        "features": {"xg_differential": 0.8, "home_form": 0.8, "away_form": 0.6, "h2h_advantage": 0.2, "live_odds_signal": 0.55},
        "venue": "Emirates Stadium",
        "date": "2026-08-08T14:00:00Z",
        "complete": 0,
    },
    {
        "game_id": "soccer_fb_2",
        "home_team": "Manchester City",
        "away_team": "Liverpool",
        "features": {"xg_differential": 0.5, "home_form": 0.85, "away_form": 0.8, "h2h_advantage": 0.1, "live_odds_signal": 0.52},
        "venue": "Etihad Stadium",
        "date": "2026-08-09T16:30:00Z",
        "complete": 0,
    },
]

# --- AFL ENDPOINTS ---

@app.get("/api/afl/games/upcoming")
def get_upcoming_afl(date: Optional[str] = None):
    try:
        games = afl_scraper.fetch_this_week_afl(run_date=date)
        if not games and date:
            games = afl_scraper.fetch_this_week_afl(run_date=None)
        if not games:
            games = FALLBACK_AFL_GAMES
    except Exception as exc:
        LOGGER.error("Error fetching AFL games: %s", exc)
        games = FALLBACK_AFL_GAMES
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
        
        # Fetch live Betfair market odds
        betfair_cache = get_cached_sport_odds("afl")
        market_odds_home, market_odds_away = match_event_odds(
            "afl", game.home_team, game.away_team, betfair_cache
        )
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
                "fair_odds_away": away_odds,
                "market_odds_home": market_odds_home,
                "market_odds_away": market_odds_away
            },
            "feature_impact": importances,
            "ai_insights_context": f"AFL ML model found {max(importances, key=importances.get)} to be the deciding factor.",
            "model_metadata": {
                "feature_importance": importances,
                "last_trained": "auto-tune pending",
                "version": WEIGHTS_VERSION
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- NBA ENDPOINTS ---

@app.get("/api/nba/games/today")
@app.get("/api/nba/games/upcoming")
def get_today_nba(date: Optional[str] = None):
    if date:
        try:
            import datetime
            datetime.date.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")
    try:
        games = nba_scraper.fetch_today_nba(run_date=date)
        if not games:
            games = FALLBACK_NBA_GAMES
    except Exception as exc:
        LOGGER.error("Error fetching NBA games: %s", exc)
        games = FALLBACK_NBA_GAMES
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
        
        # Fetch live Betfair market odds
        betfair_cache = get_cached_sport_odds("nba")
        market_odds_home, market_odds_away = match_event_odds(
            "nba", game.home_team, game.away_team, betfair_cache
        )
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
                "fair_odds_away": away_odds,
                "market_odds_home": market_odds_home,
                "market_odds_away": market_odds_away
            },
            "feature_impact": importances,
            "ai_insights_context": f"NBA ML strongly correlated {max(importances, key=importances.get)} to the outcome.",
            "model_metadata": {
                "feature_importance": importances,
                "last_trained": "auto-tune pending",
                "version": WEIGHTS_VERSION
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- GOLF INPUT MODELS ---
class GolfPlayerInput(BaseModel):
    player_id: str
    name: str
    betfair_back_price: Optional[float] = None

class GolfTournamentInput(BaseModel):
    tournament_id: str
    name: str
    players: List[GolfPlayerInput]
    venue: Optional[str] = None
    start_time: Optional[str] = None
    meeting_date: Optional[str] = None


# --- NRL ENDPOINTS ---
@app.get("/api/nrl/games/upcoming")
def get_upcoming_nrl(date: Optional[str] = None):
    try:
        games = nrl_scraper.fetch_upcoming_nrl(run_date=date)
        if not games:
            games = FALLBACK_NRL_GAMES
    except Exception as exc:
        LOGGER.error("Error fetching NRL games: %s", exc)
        games = FALLBACK_NRL_GAMES
    return {"games": games}

@app.post("/api/predict/nrl")
def predict_nrl(game: TeamGame):
    try:
        result = nrl_predictor.predict(game.features)
        feature_keys = result.get('feature_names', list(game.features.keys()))
        importances = dict(zip(feature_keys, [round(i, 4) for i in result['feature_impact']]))
        
        home_odds = round(1 / result['home_win_prob'], 2) if result['home_win_prob'] > 0 else 999
        away_odds = round(1 / result['away_win_prob'], 2) if result['away_win_prob'] > 0 else 999
        home_probability = round(result['home_win_prob'] * 100, 2)
        away_probability = round(result['away_win_prob'] * 100, 2)
        
        # Fetch live Betfair market odds
        betfair_cache = get_cached_sport_odds("nrl")
        market_odds_home, market_odds_away = match_event_odds(
            "nrl", game.home_team, game.away_team, betfair_cache
        )
        
        storage.log_prediction_batch(
            sport="nrl",
            event_id=game.game_id,
            event_name=f"{game.home_team} vs {game.away_team}",
            predictions=[
                {"selection": game.home_team, "probability": home_probability, "fair_odds": home_odds},
                {"selection": game.away_team, "probability": away_probability, "fair_odds": away_odds},
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
                "fair_odds_away": away_odds,
                "market_odds_home": market_odds_home,
                "market_odds_away": market_odds_away
            },
            "feature_impact": importances,
            "ai_insights_context": f"NRL ML model analyzed recent points diff and team form to determine decisions.",
            "model_metadata": {
                "feature_importance": importances,
                "last_trained": "auto-tune pending",
                "version": WEIGHTS_VERSION
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- SOCCER ENDPOINTS ---
@app.get("/api/soccer/games/today")
@app.get("/api/soccer/games/upcoming")
def get_today_soccer(date: Optional[str] = None):
    try:
        games = soccer_scraper.fetch_today_soccer(run_date=date)
        if not games:
            games = FALLBACK_SOCCER_GAMES
    except Exception as exc:
        LOGGER.error("Error fetching Soccer games: %s", exc)
        games = FALLBACK_SOCCER_GAMES
    return {"games": games}

@app.post("/api/predict/soccer")
def predict_soccer(game: TeamGame):
    try:
        result = soccer_predictor.predict(game.features)
        feature_keys = result.get('feature_names', list(game.features.keys()))
        importances = dict(zip(feature_keys, [round(i, 4) for i in result['feature_impact']]))
        
        home_odds = round(1 / result['home_win_prob'], 2) if result['home_win_prob'] > 0 else 999
        away_odds = round(1 / result['away_win_prob'], 2) if result['away_win_prob'] > 0 else 999
        home_probability = round(result['home_win_prob'] * 100, 2)
        away_probability = round(result['away_win_prob'] * 100, 2)
        
        # Fetch live Betfair market odds
        betfair_cache = get_cached_sport_odds("soccer")
        market_odds_home, market_odds_away = match_event_odds(
            "soccer", game.home_team, game.away_team, betfair_cache
        )
        
        storage.log_prediction_batch(
            sport="soccer",
            event_id=game.game_id,
            event_name=f"{game.home_team} vs {game.away_team}",
            predictions=[
                {"selection": game.home_team, "probability": home_probability, "fair_odds": home_odds},
                {"selection": game.away_team, "probability": away_probability, "fair_odds": away_odds},
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
                "fair_odds_away": away_odds,
                "market_odds_home": market_odds_home,
                "market_odds_away": market_odds_away
            },
            "feature_impact": importances,
            "ai_insights_context": f"Soccer ML model evaluated expected goals difference and historical matchup factors.",
            "model_metadata": {
                "feature_importance": importances,
                "last_trained": "auto-tune pending",
                "version": WEIGHTS_VERSION
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- GOLF ENDPOINTS ---
@app.get("/api/golf/games/today")
def get_today_golf(date: Optional[str] = None):
    try:
        games = golf_scraper.fetch_today_golf(run_date=date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"games": games}

@app.post("/api/predict/golf")
def predict_golf(tournament: GolfTournamentInput):
    try:
        t_dict = tournament.dict()
        result = golf_predictor.predict(t_dict)
        
        feature_keys = result.get('feature_names', ['recent_finishes', 'course_history', 'driving_accuracy', 'putting_average', 'live_odds_signal'])
        importances = dict(zip(feature_keys, [round(i, 4) for i in result['feature_impact']]))
        
        betfair_cache = get_cached_sport_odds("golf")
        
        # Log all player predictions in a single batch
        log_predictions = []
        for pick in result["predictions"]:
            pick["market_odds"] = match_golfer_odds(pick["name"], betfair_cache)
            log_predictions.append({
                "selection": pick["name"],
                "probability": pick["win_probability"],
                "fair_odds": pick["fair_odds"],
            })
            
        storage.log_prediction_batch(
            sport="golf",
            event_id=tournament.tournament_id,
            event_name=tournament.name,
            predictions=log_predictions,
            feature_impact=importances,
        )
        
        return {
            "tournament_id": tournament.tournament_id,
            "predictions": result["predictions"],
            "feature_impact": importances,
            "ai_insights_context": f"Golf model weighted course history and recent stroke averages to determine favorites.",
            "model_metadata": {
                "feature_importance": importances,
                "last_trained": "auto-tune pending",
                "version": WEIGHTS_VERSION
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- MMA ENDPOINTS ---
@app.get("/api/mma/games/today")
def get_today_mma(date: Optional[str] = None):
    try:
        games = mma_scraper.fetch_today_mma(run_date=date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"games": games}

@app.post("/api/predict/mma")
def predict_mma(game: TeamGame):
    try:
        result = mma_predictor.predict(game.features)
        feature_keys = result.get('feature_names', list(game.features.keys()))
        importances = dict(zip(feature_keys, [round(i, 4) for i in result['feature_impact']]))
        
        home_odds = round(1 / result['home_win_prob'], 2) if result['home_win_prob'] > 0 else 999
        away_odds = round(1 / result['away_win_prob'], 2) if result['away_win_prob'] > 0 else 999
        home_probability = round(result['home_win_prob'] * 100, 2)
        away_probability = round(result['away_win_prob'] * 100, 2)
        
        # Fetch live Betfair market odds
        betfair_cache = get_cached_sport_odds("mma")
        market_odds_home, market_odds_away = match_event_odds(
            "mma", game.home_team, game.away_team, betfair_cache
        )
        
        storage.log_prediction_batch(
            sport="mma",
            event_id=game.game_id,
            event_name=f"{game.home_team} vs {game.away_team}",
            predictions=[
                {"selection": game.home_team, "probability": home_probability, "fair_odds": home_odds},
                {"selection": game.away_team, "probability": away_probability, "fair_odds": away_odds},
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
                "fair_odds_away": away_odds,
                "market_odds_home": market_odds_home,
                "market_odds_away": market_odds_away
            },
            "feature_impact": importances,
            "ai_insights_context": f"MMA model analyzed striking accuracy and reach advantage differentials.",
            "model_metadata": {
                "feature_importance": importances,
                "last_trained": "auto-tune pending",
                "version": WEIGHTS_VERSION
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

