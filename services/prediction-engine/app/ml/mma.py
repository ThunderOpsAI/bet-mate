import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.preprocessing import StandardScaler
import pickle
import os

from app.ml.artifacts import ensure_model_dir, legacy_model_path, model_path
from app.ml.weights import MMA_WEIGHTS, WEIGHTS_VERSION

MODEL_FILENAME = "mma_model.pkl"
MODEL_PATH = model_path(MODEL_FILENAME)
LEGACY_MODEL_PATH = legacy_model_path(MODEL_FILENAME)

FEATURE_COLUMNS = [
    'striking_accuracy',
    'takedown_defense',
    'reach_advantage',
    'recent_form',
    'live_odds_signal',
]

FEATURE_DEFAULTS = {
    'striking_accuracy': 0.5,
    'takedown_defense': 0.5,
    'reach_advantage': 0.0,
    'recent_form': 0.0,
    'live_odds_signal': 0.0,
}

class MMAPredictor:
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

    def predict(self, game_features):
        df = pd.DataFrame([game_features])
        for col in FEATURE_COLUMNS:
            if col not in df.columns:
                df[col] = FEATURE_DEFAULTS[col]
        row = df.iloc[0]

        base_score = (
            (row['striking_accuracy'] * MMA_WEIGHTS['striking_accuracy']) +
            (row['takedown_defense'] * MMA_WEIGHTS['takedown_defense']) +
            (row['reach_advantage'] * MMA_WEIGHTS['reach_advantage']) +
            (row['recent_form'] * MMA_WEIGHTS['recent_form']) +
            (row['live_odds_signal'] * MMA_WEIGHTS['live_odds_signal'])
        )
        prob = 1 / (1 + np.exp(-base_score))
        home_win_prob = np.clip(prob, 0.01, 0.99)
        away_win_prob = 1.0 - home_win_prob

        importances = {k: float(v) for k, v in MMA_WEIGHTS.items()}

        return {
            "home_win_prob": float(home_win_prob),
            "away_win_prob": float(away_win_prob),
            "feature_impact": list(importances.values()),
            "feature_names": list(importances.keys()),
        }
