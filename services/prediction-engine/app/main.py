from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import os

# Local ML Imports
from app.ml.racing import RacingPredictor, FEATURE_COLUMNS as RACING_FEATURE_COLUMNS, MODEL_PATH as RACING_MODEL_PATH
from app.ml.afl import AFLPredictor, FEATURE_COLUMNS as AFL_FEATURE_COLUMNS, MODEL_PATH as AFL_MODEL_PATH
from app.ml.nba import NBAPredictor, FEATURE_COLUMNS as NBA_FEATURE_COLUMNS, MODEL_PATH as NBA_MODEL_PATH

# Local Data Scraper Imports
import app.data.scraper as racing_scraper
import app.data.afl_scraper as afl_scraper
import app.data.nba_scraper as nba_scraper

app = FastAPI(title="BetMate Advanced ML Engine", version="2.0.0")

# CORS — allow the Next.js frontend to reach the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize models
racing_predictor = RacingPredictor()
afl_predictor = AFLPredictor()
nba_predictor = NBAPredictor()

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

class Race(BaseModel):
    race_id: str
    venue: str
    race_number: int
    distance: int
    horses: List[Horse]

class TeamGame(BaseModel):
    game_id: str
    home_team: str
    away_team: str
    features: Dict[str, float]

@app.on_event("startup")
def startup_event():
    # Pre-train or load models on startup
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

# --- RACING ENDPOINTS ---

@app.get("/api/races/today")
def get_today_races():
    """Fetch live/mock data for today's races."""
    races = racing_scraper.fetch_today_races()
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
def get_upcoming_afl():
    games = afl_scraper.fetch_this_week_afl()
    return {"games": games}

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
        
        return {
            "game_id": game.game_id,
            "predictions": {
                "home_team": game.home_team,
                "away_team": game.away_team,
                "home_win_probability": round(result['home_win_prob'] * 100, 2),
                "away_win_probability": round(result['away_win_prob'] * 100, 2),
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
def get_today_nba():
    games = nba_scraper.fetch_today_nba()
    return {"games": games}

@app.post("/api/predict/nba")
def predict_nba(game: TeamGame):
    try:
        result = nba_predictor.predict(game.features)
        
        feature_keys = result.get('feature_names', NBA_FEATURE_COLUMNS)
        importances = dict(zip(feature_keys, [round(i, 4) for i in result['feature_impact']]))
        
        home_odds = round(1 / result['home_win_prob'], 2) if result['home_win_prob'] > 0 else 999
        away_odds = round(1 / result['away_win_prob'], 2) if result['away_win_prob'] > 0 else 999
        
        return {
            "game_id": game.game_id,
            "predictions": {
                "home_team": game.home_team,
                "away_team": game.away_team,
                "home_win_probability": round(result['home_win_prob'] * 100, 2),
                "away_win_probability": round(result['away_win_prob'] * 100, 2),
                "fair_odds_home": home_odds,
                "fair_odds_away": away_odds
            },
            "feature_impact": importances,
            "ai_insights_context": f"NBA ML strongly correlated {max(importances, key=importances.get)} to the outcome."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
