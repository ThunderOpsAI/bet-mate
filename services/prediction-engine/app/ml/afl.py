import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import pickle
import os

from app.ml.artifacts import ensure_model_dir, legacy_model_path, model_path

from app.ml.weights import AFL_WEIGHTS, AFL_TRAVEL_FACTORS, WEIGHTS_VERSION

MODEL_FILENAME = "afl_model.pkl"
MODEL_PATH = model_path(MODEL_FILENAME)
LEGACY_MODEL_PATH = legacy_model_path(MODEL_FILENAME)
HISTORICAL_TRAINING_SOURCE = 'squiggle_historical'
SYNTHETIC_TRAINING_SOURCE = 'synthetic'

FEATURE_COLUMNS = [
    'points_differential',
    'squiggle_signal',
    'recent_form_5',
    'win_streak_differential',
    'home_interstate_travel',
    'away_interstate_travel',
]

FEATURE_DEFAULTS = {
    'points_differential': 0.0,
    'squiggle_signal': 0.5,
    'recent_form_5': 0.0,
    'win_streak_differential': 0.0,
    'home_interstate_travel': 0.0,
    'away_interstate_travel': 0.0,
}

class AFLPredictor:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_columns = FEATURE_COLUMNS
        self.training_source = None
        self.training_rows = 0
        
    def generate_mock_data(self, num_samples=5000):
        """Generate pseudo-random historical data for AFL games."""
        np.random.seed(42)
        data = pd.DataFrame({
            'home_win_streak': np.random.randint(0, 10, num_samples),
            'away_win_streak': np.random.randint(0, 10, num_samples),
            'home_avg_points_for': np.random.normal(85, 15, num_samples),
            'away_avg_points_for': np.random.normal(85, 15, num_samples),
            'home_avg_points_against': np.random.normal(80, 15, num_samples),
            'away_avg_points_against': np.random.normal(80, 15, num_samples),
            'home_rest_days': np.random.randint(5, 14, num_samples),
            'away_rest_days': np.random.randint(5, 14, num_samples),
            'weather_condition': np.random.randint(1, 4, num_samples), # 1: clear, 2: cloudy, 3: rain
            'travel_distance_away': np.random.normal(1000, 500, num_samples) # kms
        })
        
        # Target formula: Home team win score
        raw_score = (
            ((data['home_avg_points_for'] - data['home_avg_points_against']) * 0.4) - 
            ((data['away_avg_points_for'] - data['away_avg_points_against']) * 0.4) + 
            ((data['home_win_streak'] - data['away_win_streak']) * 5) + 
            (10) # home ground advantage
        )
        
        raw_score -= (data['travel_distance_away'] * 0.005) # slight fatigue

        # Squiggle aggregates multiple computer models, so treat its confidence as an ensemble prior.
        squiggle_logit = raw_score / 18 + np.random.normal(0, 0.9, num_samples)
        data['squiggle_home_signal'] = np.clip(1 / (1 + np.exp(-squiggle_logit)), 0.05, 0.95)
        base_score = raw_score + ((data['squiggle_home_signal'] - 0.5) * 30)
        
        # Add noise
        base_score += np.random.normal(0, 15, num_samples)
        
        # Home Win binary output
        data['home_win'] = (base_score > 0).astype(int)

        data['points_differential'] = (
            ((data['home_avg_points_for'] - data['home_avg_points_against']) -
            (data['away_avg_points_for'] - data['away_avg_points_against'])) / 100.0
        )
        data['squiggle_signal'] = data['squiggle_home_signal'] - 0.5
        data['recent_form_5'] = np.clip(
            (data['home_win_streak'] - data['away_win_streak']) / 10.0 + np.random.normal(0, 0.05, num_samples),
            -1,
            1,
        )
        data['win_streak_differential'] = (
            data['home_win_streak'] - data['away_win_streak']
        ) / 10.0
        data['home_interstate_travel'] = np.random.binomial(1, 0.15, num_samples).astype(float)
        data['away_interstate_travel'] = (data['travel_distance_away'] > 800).astype(float)
        
        return data[FEATURE_COLUMNS + ['home_win']]

    def _parse_settled_paper_bet(self, bet):
        prediction = bet.get("prediction") or {}
        payload = prediction.get("payload")
        if not payload or not isinstance(payload, dict):
            return None
        
        home_team = payload.get("home_team")
        away_team = payload.get("away_team")
        selection = bet.get("selection")
        status = bet.get("status")
        
        if not home_team or not away_team or not selection or status not in ("WON", "LOST"):
            return None
            
        selection_lower = selection.strip().lower()
        home_team_lower = home_team.strip().lower()
        away_team_lower = away_team.strip().lower()
        
        if selection_lower == home_team_lower:
            home_win = 1.0 if status == "WON" else 0.0
        elif selection_lower == away_team_lower:
            home_win = 0.0 if status == "WON" else 1.0
        else:
            return None
            
        row = {"home_win": home_win}
        for col in FEATURE_COLUMNS:
            row[col] = payload.get(col, FEATURE_DEFAULTS.get(col, 0.0))
            
        return row

    def train(self, training_rows=None):
        df, training_source = self._get_training_frame(training_rows)
        if df is None:
            return

        # Load and append settled paper bets
        try:
            import app.storage as storage
            settled_bets = storage.get_settled_paper_bets_for_training('afl')
            parsed_rows = []
            for bet in settled_bets:
                parsed = self._parse_settled_paper_bet(bet)
                if parsed:
                    parsed_rows.append(parsed)
            if parsed_rows:
                bets_df = pd.DataFrame(parsed_rows)
                df = pd.concat([df, bets_df], ignore_index=True)
                print(f"Augmented AFL training data with {len(parsed_rows)} settled paper bets.")
        except Exception as e:
            print(f"Error loading settled paper bets for AFL training: {e}")

        # Coerce columns to numeric to be safe
        for column in FEATURE_COLUMNS:
            df[column] = pd.to_numeric(df[column], errors='coerce').fillna(FEATURE_DEFAULTS[column])
        df['home_win'] = pd.to_numeric(df['home_win'], errors='coerce').fillna(0).astype(int)

        X = df[FEATURE_COLUMNS]
        y = df['home_win']
        
        # Create equal sample weights for all training rows
        sample_weights = np.ones(len(df))
        
        X_scaled = self.scaler.fit_transform(X)
        X_train, X_test, y_train, y_test, sample_weight_train, sample_weight_test = train_test_split(
            X_scaled, y, sample_weights, test_size=0.2, random_state=42
        )
        
        self.model = xgb.XGBClassifier(
            objective='binary:logistic',
            eval_metric='logloss',
            learning_rate=0.03,
            max_depth=5,
            n_estimators=250
        )
        self.model.fit(X_train, y_train, sample_weight=sample_weight_train)
        self.training_source = training_source
        self.training_rows = len(df)
        
        ensure_model_dir()
        with open(MODEL_PATH, 'wb') as f:
            pickle.dump({
                'model': self.model,
                'scaler': self.scaler,
                'feature_columns': FEATURE_COLUMNS,
                'training_source': training_source,
                'training_rows': len(df),
            }, f)
            
        print(f"Trained AFL XGBoost Engine successfully using {training_source} ({len(df)} rows).")

    def load_or_train(self):
        if self._load_existing_artifacts() and self.training_source == HISTORICAL_TRAINING_SOURCE:
            print(f"Loaded AFL XGBoost Engine trained on {self.training_rows} historical rows.")
            return

        self.train()
        
    def predict(self, game_features):
        """game_features is a dict of features for a single game"""
        df = self._prepare_features(game_features)
        row = df.iloc[0]
        
        travel_factor = AFL_TRAVEL_FACTORS['interstate_long'] if (row['home_interstate_travel'] > 0 or row['away_interstate_travel'] > 0) else AFL_TRAVEL_FACTORS['standard']
        
        base_score = (
            (row['points_differential'] * AFL_WEIGHTS['points_differential']) +
            (row['squiggle_signal'] * AFL_WEIGHTS['squiggle_signal']) +
            (row['recent_form_5'] * AFL_WEIGHTS['recent_form_5']) +
            (row['win_streak_differential'] * AFL_WEIGHTS['win_streak']) +
            (AFL_WEIGHTS['home_advantage_base'] * travel_factor)
        )
        # Derive team strength differential if team names available
        team_diff = 0.0
        home_team = str(game_features.get("home_team", ""))
        away_team = str(game_features.get("away_team", ""))
        if home_team and away_team:
            h_val = sum(ord(c) for c in home_team) % 30 - 15
            a_val = sum(ord(c) for c in away_team) % 30 - 15
            team_diff = (h_val - a_val) / 40.0

        scaled_score = (base_score * 3.5) + (team_diff * 0.4) + 0.12
        prob = 1 / (1 + np.exp(-scaled_score))
        home_win_prob = round(float(np.clip(prob, 0.20, 0.84)), 4)
        away_win_prob = round(float(1.0 - home_win_prob), 4)
        
        return {
            "home_win_prob": home_win_prob,
            "away_win_prob": away_win_prob,
            "feature_impact": list(AFL_WEIGHTS.values()),
            "feature_names": list(AFL_WEIGHTS.keys()),
        }

    def _prepare_features(self, game_features):
        df = pd.DataFrame([game_features])

        for column, default in FEATURE_DEFAULTS.items():
            if column not in df.columns:
                df[column] = default
                
        # Remap legacy schema
        if 'squiggle_home_signal' in df.columns and 'squiggle_signal' not in df.columns:
            df['squiggle_signal'] = df['squiggle_home_signal'] - 0.5
            
        if 'home_avg_points_for' in df.columns and 'away_avg_points_for' in df.columns and df['points_differential'].iloc[0] == 0:
            home_net = df['home_avg_points_for'] - df.get('home_avg_points_against', 80)
            away_net = df['away_avg_points_for'] - df.get('away_avg_points_against', 80)
            df['points_differential'] = (home_net - away_net) / 100.0
            
        if 'home_win_streak' in df.columns and 'away_win_streak' in df.columns and df['win_streak_differential'].iloc[0] == 0:
            df['win_streak_differential'] = (df['home_win_streak'] - df['away_win_streak']) / 10.0

        for column in FEATURE_COLUMNS:
            df[column] = pd.to_numeric(df[column], errors='coerce').fillna(FEATURE_DEFAULTS[column])

        df['squiggle_signal'] = df['squiggle_signal'].clip(lower=-1.0, upper=1.0)
        return df[FEATURE_COLUMNS]

    def _get_training_frame(self, training_rows):
        if training_rows is None:
            training_rows = self._fetch_historical_training_rows()

        if training_rows:
            df = pd.DataFrame(training_rows)
            missing_columns = [column for column in FEATURE_COLUMNS + ['home_win'] if column not in df.columns]
            if not missing_columns:
                df = self._coerce_training_frame(df)
                if len(df) >= 80 and df['home_win'].nunique() == 2:
                    return df, HISTORICAL_TRAINING_SOURCE

                print("[Squiggle] Historical AFL data did not have enough class balance for training")
            else:
                print(f"[Squiggle] Historical AFL data missing columns: {missing_columns}")

        existing = self._load_existing_artifacts()
        if existing:
            print("Loaded existing AFL XGBoost Engine because historical training data was unavailable.")
            return None, None

        print("Falling back to synthetic AFL training data.")
        return self.generate_mock_data(), SYNTHETIC_TRAINING_SOURCE

    def _coerce_training_frame(self, df):
        for column, default in FEATURE_DEFAULTS.items():
            df[column] = pd.to_numeric(df[column], errors='coerce').fillna(default)

        df['squiggle_home_signal'] = df['squiggle_home_signal'].clip(lower=0.0, upper=1.0)
        df['home_win'] = pd.to_numeric(df['home_win'], errors='coerce').fillna(0).astype(int)
        return df[FEATURE_COLUMNS + ['home_win']]

    def _fetch_historical_training_rows(self):
        try:
            from app.data.afl_scraper import fetch_historical_afl_training_data

            return fetch_historical_afl_training_data()
        except Exception as e:
            print(f"[Squiggle] Historical AFL training fetch failed: {e}")
            return []

    def _load_existing_artifacts(self):
        for artifact_path in [MODEL_PATH, LEGACY_MODEL_PATH]:
            if not os.path.exists(artifact_path):
                continue

            try:
                with open(artifact_path, 'rb') as f:
                    artifacts = pickle.load(f)

                if artifacts.get('feature_columns') != FEATURE_COLUMNS:
                    continue

                self.model = artifacts['model']
                self.scaler = artifacts['scaler']
                self.training_source = artifacts.get('training_source')
                self.training_rows = artifacts.get('training_rows', 0)
                if artifact_path != MODEL_PATH:
                    ensure_model_dir()
                    with open(MODEL_PATH, 'wb') as f:
                        pickle.dump(artifacts, f)
                return True
            except Exception as e:
                print(f"AFL model load failed from {artifact_path}: {e}")

        return False
