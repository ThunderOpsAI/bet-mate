"""NFL Game Outcome Predictor using nfl-data-py, XGBoost, and Isotonic Calibration."""
from __future__ import annotations

import os
import pickle
from datetime import datetime
from typing import Any, Mapping, Sequence

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.preprocessing import StandardScaler
import xgboost as xgb

from app.ml.artifacts import ensure_model_dir, legacy_model_path, model_path

MODEL_FILENAME = "nfl_model.pkl"
MODEL_PATH = model_path(MODEL_FILENAME)
LEGACY_MODEL_PATH = legacy_model_path(MODEL_FILENAME)
HISTORICAL_TRAINING_SOURCE = "historical_nflverse_schedules"

FEATURE_COLUMNS = [
    "epa_diff",
    "rest_diff",
    "is_dome",
    "spread_line",
]

FEATURE_DEFAULTS = {
    "epa_diff": 0.0,
    "rest_diff": 0.0,
    "is_dome": 0.0,
    "spread_line": 0.0,
}


def fetch_historical_nfl_training_data(start_year: int = 1999, end_year: int | None = None) -> pd.DataFrame:
    """Fetch and engineer historical NFL training rows using nfl-data-py schedules."""
    try:
        import nfl_data_py as nfl
    except ImportError:
        print("[NFL] nfl_data_py not installed")
        return pd.DataFrame()

    current_year = datetime.now().year
    end_year = end_year or current_year

    try:
        schedules = nfl.import_schedules(range(start_year, end_year + 1))
    except Exception as exc:
        print(f"[NFL] Failed to fetch nfl schedules: {exc}")
        return pd.DataFrame()

    # Filter to completed regular/postseason games with valid scores
    df = schedules.dropna(subset=["home_score", "away_score", "spread_line"]).copy()
    if df.empty:
        return pd.DataFrame()

    # Sort chronologically
    df.sort_values(by=["season", "week", "gameday"], inplace=True)

    # Calculate rolling EPA/net efficiency differential proxy
    team_history: dict[str, list[float]] = {}
    epa_diffs: list[float] = []

    for _, row in df.iterrows():
        home = str(row["home_team"])
        away = str(row["away_team"])
        h_score = float(row["home_score"])
        a_score = float(row["away_score"])

        # Prior rolling avg margin for home & away (last 5 games)
        h_prior = team_history.get(home, [])
        a_prior = team_history.get(away, [])

        h_net = np.mean(h_prior[-5:]) if h_prior else 0.0
        a_net = np.mean(a_prior[-5:]) if a_prior else 0.0
        epa_diffs.append(round(float((h_net - a_net) / 10.0), 3))

        # Update post-game
        team_history.setdefault(home, []).append(h_score - a_score)
        team_history.setdefault(away, []).append(a_score - h_score)

    df["epa_diff"] = epa_diffs
    df["rest_diff"] = (
        pd.to_numeric(df.get("home_rest", 7), errors="coerce").fillna(7)
        - pd.to_numeric(df.get("away_rest", 7), errors="coerce").fillna(7)
    )
    df["is_dome"] = df["roof"].astype(str).str.lower().isin(["dome", "closed"]).astype(float)
    df["spread_line"] = pd.to_numeric(df["spread_line"], errors="coerce").fillna(0.0)
    df["home_win"] = (df["home_score"] > df["away_score"]).astype(int)

    return df[FEATURE_COLUMNS + ["home_win"]]


class NFLPredictor:
    """XGBoost + CalibratedClassifierCV predictor for NFL match probabilities."""

    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_columns = FEATURE_COLUMNS
        self.training_source = None
        self.training_rows = 0

    def train(self, training_data: pd.DataFrame | None = None) -> None:
        """Train XGBoost model and calibrate probabilities via isotonic regression."""
        if training_data is None or training_data.empty:
            df = fetch_historical_nfl_training_data()
        else:
            df = training_data.copy()

        if df.empty or len(df) < 200:
            existing = self._load_existing_artifacts()
            if existing:
                print(f"[NFL] Loaded existing model trained on {self.training_rows} rows.")
                return
            raise RuntimeError(
                "[NFL] Historical training data unavailable or below 200 rows. Zero mock data allowed."
            )

        # Ensure correct column types
        for col in FEATURE_COLUMNS:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(FEATURE_DEFAULTS[col])
        df["home_win"] = pd.to_numeric(df["home_win"], errors="coerce").fillna(0).astype(int)

        X = df[FEATURE_COLUMNS]
        y = df["home_win"]

        X_scaled = self.scaler.fit_transform(X)

        base_estimator = xgb.XGBClassifier(
            objective="binary:logistic",
            eval_metric="logloss",
            learning_rate=0.05,
            max_depth=3,
            n_estimators=100,
            random_state=42,
        )

        calibrated = CalibratedClassifierCV(
            estimator=base_estimator,
            method="isotonic",
            cv=3,
        )
        calibrated.fit(X_scaled, y)

        self.model = calibrated
        self.training_source = HISTORICAL_TRAINING_SOURCE
        self.training_rows = len(df)

        ensure_model_dir()
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(
                {
                    "model": self.model,
                    "scaler": self.scaler,
                    "feature_columns": FEATURE_COLUMNS,
                    "training_source": self.training_source,
                    "training_rows": self.training_rows,
                },
                f,
            )
        print(f"[NFL] Trained Calibrated XGBoost model on {len(df)} historical games.")

    def load_or_train(self) -> None:
        """Load saved artifact or train a new model."""
        if self._load_existing_artifacts():
            print(f"[NFL] Loaded existing NFL model trained on {self.training_rows} rows.")
            return
        self.train()

    def predict(self, game_features: Mapping[str, Any]) -> dict[str, Any]:
        """Predict calibrated win probability for home and away teams."""
        if self.model is None:
            self.load_or_train()

        features_dict = {col: float(game_features.get(col, FEATURE_DEFAULTS[col])) for col in FEATURE_COLUMNS}
        df = pd.DataFrame([features_dict])
        scaled = self.scaler.transform(df)

        # CalibratedClassifierCV returns probability distribution [[prob_0, prob_1]]
        probs = self.model.predict_proba(scaled)[0]
        away_prob = round(float(probs[0]), 4)
        home_prob = round(float(probs[1]), 4)

        return {
            "home_win_prob": home_prob,
            "away_win_prob": away_prob,
            "feature_impact": [float(features_dict[col]) for col in FEATURE_COLUMNS],
            "feature_names": FEATURE_COLUMNS,
        }

    def _load_existing_artifacts(self) -> bool:
        for path in [MODEL_PATH, LEGACY_MODEL_PATH]:
            if not os.path.exists(path):
                continue
            try:
                with open(path, "rb") as f:
                    data = pickle.load(f)
                if data.get("feature_columns") != FEATURE_COLUMNS:
                    continue
                self.model = data["model"]
                self.scaler = data["scaler"]
                self.training_source = data.get("training_source")
                self.training_rows = data.get("training_rows", 0)
                return True
            except Exception as e:
                print(f"[NFL] Error loading artifact {path}: {e}")
        return False
