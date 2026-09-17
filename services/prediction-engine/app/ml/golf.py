import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.preprocessing import StandardScaler
import pickle
import os

from app.ml.artifacts import ensure_model_dir, legacy_model_path, model_path
from app.ml.weights import GOLF_WEIGHTS, WEIGHTS_VERSION

MODEL_FILENAME = "golf_model.pkl"
MODEL_PATH = model_path(MODEL_FILENAME)
LEGACY_MODEL_PATH = legacy_model_path(MODEL_FILENAME)

FEATURE_COLUMNS = [
    'recent_finishes',
    'course_history',
    'driving_accuracy',
    'putting_average',
    'live_odds_signal',
]

FEATURE_DEFAULTS = {
    'recent_finishes': 0.5,
    'course_history': 0.5,
    'driving_accuracy': 0.5,
    'putting_average': 0.5,
    'live_odds_signal': 0.05,
}

class GolfPredictor:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_columns = FEATURE_COLUMNS
        self.training_source = "static"
        self.training_rows = 100

    def load_or_train(self):
        ensure_model_dir()
        self.scaler = StandardScaler()
        X_dummy = np.random.normal(0, 1, (100, len(FEATURE_COLUMNS)))
        y_dummy = np.random.randint(0, 2, 100)
        self.scaler.fit(X_dummy)
        
        self.model = xgb.XGBClassifier(
            objective='binary:logistic',
            eval_metric='logloss',
            learning_rate=0.04,
            max_depth=5,
            n_estimators=200
        )
        self.model.fit(X_dummy, y_dummy)
        
        with open(MODEL_PATH, 'wb') as f:
            pickle.dump({
                'model': self.model,
                'scaler': self.scaler,
                'feature_columns': FEATURE_COLUMNS,
                'training_source': 'static',
                'training_rows': 100,
            }, f)

    def predict(self, tournament):
        # Predict outright win probabilities for all players in a tournament
        players = tournament.get("players", [])
        if not players:
            return {
                "tournament_id": tournament.get("tournament_id", ""),
                "predictions": [],
                "feature_impact": list(GOLF_WEIGHTS.values()),
                "feature_names": list(GOLF_WEIGHTS.keys()),
            }

        scores = []
        for player in players:
            odds = player.get("betfair_back_price", 0)
            implied = (1.0 / odds) if odds > 1 else 0.01
            
            # Simulated features for visual display/calculations
            recent_finishes = round(float(np.random.uniform(0.1, 0.9)), 2)
            course_history = round(float(np.random.uniform(0.1, 0.9)), 2)
            driving_accuracy = round(float(np.random.uniform(0.1, 0.9)), 2)
            putting_average = round(float(np.random.uniform(0.1, 0.9)), 2)

            score = (
                recent_finishes * GOLF_WEIGHTS["recent_finishes"] +
                course_history * GOLF_WEIGHTS["course_history"] +
                driving_accuracy * GOLF_WEIGHTS["sg_approach"] +
                putting_average * GOLF_WEIGHTS["sg_off_the_tee"] +
                implied * GOLF_WEIGHTS["live_odds_signal"]
            )
            scores.append((player, score))

        total_score = sum(s[1] for s in scores) or 1.0
        predictions = []
        for player, score in scores:
            prob = (score / total_score) * 100.0
            prob = max(0.1, min(prob, 99.0))
            fair_odds = round(100.0 / prob, 2) if prob > 0 else 999.0
            predictions.append({
                "player_id": str(player.get("player_id", "")),
                "name": player.get("name", ""),
                "win_probability": float(prob),
                "fair_odds": float(fair_odds),
            })

        # Sort by win probability descending
        predictions.sort(key=lambda x: x["win_probability"], reverse=True)

        importances = {k: float(v) for k, v in GOLF_WEIGHTS.items()}

        return {
            "tournament_id": tournament.get("tournament_id", ""),
            "predictions": predictions,
            "feature_impact": list(importances.values()),
            "feature_names": list(importances.keys()),
        }
