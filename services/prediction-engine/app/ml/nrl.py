import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import pickle
import os

from app.ml.artifacts import ensure_model_dir, legacy_model_path, model_path
from app.ml.weights import NRL_WEIGHTS, WEIGHTS_VERSION

MODEL_FILENAME = "nrl_model.pkl"
MODEL_PATH = model_path(MODEL_FILENAME)
LEGACY_MODEL_PATH = legacy_model_path(MODEL_FILENAME)

FEATURE_COLUMNS = [
    'points_differential',
    'recent_form',
    'head_to_head',
    'home_advantage_base',
    'live_odds_signal',
]

FEATURE_DEFAULTS = {
    'points_differential': 0.0,
    'recent_form': 0.0,
    'head_to_head': 0.0,
    'home_advantage_base': 0.05,
    'live_odds_signal': 0.0,
}

class NRLPredictor:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_columns = FEATURE_COLUMNS
        self.training_source = "static"
        self.training_rows = 100

    def load_or_train(self):
        # NRL model loads or uses static/synthetic data to train XGBoost dummy classifier
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
            (row['points_differential'] * NRL_WEIGHTS['points_differential']) +
            (row['recent_form'] * NRL_WEIGHTS['recent_form']) +
            (row['head_to_head'] * NRL_WEIGHTS['head_to_head']) +
            (row['home_advantage_base'] * NRL_WEIGHTS['home_advantage_base']) +
            (row['live_odds_signal'] * NRL_WEIGHTS['live_odds_signal'])
        )
        team_diff = 0.0
        home_team = str(game_features.get("home_team", ""))
        away_team = str(game_features.get("away_team", ""))
        if home_team and away_team:
            h_val = sum(ord(c) for c in home_team) % 30 - 15
            a_val = sum(ord(c) for c in away_team) % 30 - 15
            team_diff = (h_val - a_val) / 40.0

        scaled_score = (base_score * 3.5) + (team_diff * 0.4) + 0.12
        prob = 1 / (1 + np.exp(-scaled_score))
        home_win_prob = round(float(np.clip(prob, 0.22, 0.82)), 4)
        away_win_prob = round(float(1.0 - home_win_prob), 4)

        importances = {k: float(v) for k, v in NRL_WEIGHTS.items()}

        return {
            "home_win_prob": home_win_prob,
            "away_win_prob": away_win_prob,
            "feature_impact": list(importances.values()),
            "feature_names": list(importances.keys()),
        }
