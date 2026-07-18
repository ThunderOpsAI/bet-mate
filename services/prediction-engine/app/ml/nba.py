import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import pickle
import os

from app.ml.artifacts import ensure_model_dir, legacy_model_path, model_path

from app.ml.weights import NBA_WEIGHTS, NBA_MULTIPLIERS, NBA_HOME_FACTORS, WEIGHTS_VERSION

MODEL_FILENAME = "nba_model.pkl"
MODEL_PATH = model_path(MODEL_FILENAME)
LEGACY_MODEL_PATH = legacy_model_path(MODEL_FILENAME)
HISTORICAL_TRAINING_SOURCE = 'balldontlie_historical'
SYNTHETIC_TRAINING_SOURCE = 'synthetic'

FEATURE_COLUMNS = [
    'off_rating_diff',
    'def_rating_diff',
    'recent_form_10',
    'head_to_head_factor',
    'usage_rates',
    'live_odds_signal',
    'home_team_toronto',
    'away_team_toronto',
    'home_b2b',
    'away_b2b',
]

FEATURE_DEFAULTS = {
    'off_rating_diff': 0.0,
    'def_rating_diff': 0.0,
    'recent_form_10': 0.0,
    'head_to_head_factor': 0.0,
    'usage_rates': 0.0,
    'live_odds_signal': 0.0,
    'home_team_toronto': 0.0,
    'away_team_toronto': 0.0,
    'home_b2b': 0.0,
    'away_b2b': 0.0,
}

class NBAPredictor:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_columns = FEATURE_COLUMNS
        self.training_source = None
        self.training_rows = 0
        
    def generate_mock_data(self, num_samples=10000):
        """Generate pseudo-random historical data for NBA games."""
        np.random.seed(42)
        data = pd.DataFrame({
            'home_b2b': np.random.randint(0, 2, num_samples), # Back to back
            'away_b2b': np.random.randint(0, 2, num_samples),
            'home_win_pct': np.random.uniform(0.1, 0.9, num_samples),
            'away_win_pct': np.random.uniform(0.1, 0.9, num_samples),
            'home_ortg': np.random.normal(115, 6, num_samples),
            'home_drtg': np.random.normal(115, 6, num_samples),
            'away_ortg': np.random.normal(115, 6, num_samples),
            'away_drtg': np.random.normal(115, 6, num_samples),
            'home_injuries_impact': np.random.normal(5, 3, num_samples),
            'away_injuries_impact': np.random.normal(5, 3, num_samples),
        })
        
        # Calculate base advantage
        home_net = data['home_ortg'] - data['home_drtg']
        away_net = data['away_ortg'] - data['away_drtg']
        
        base_score = (
            home_net - away_net + 
            (data['home_win_pct'] - data['away_win_pct']) * 20 + 
            3.5 # Home court advantage
        )
        
        # Penalties
        base_score -= (data['home_b2b'] * 3)
        base_score += (data['away_b2b'] * 3)
        base_score -= data['home_injuries_impact']
        base_score += data['away_injuries_impact']
        
        # Noise
        base_score += np.random.normal(0, 12, num_samples)
        
        data['home_win'] = (base_score > 0).astype(int)
        data['off_rating_diff'] = (data['home_ortg'] - data['away_ortg']) / 100.0
        data['def_rating_diff'] = (data['away_drtg'] - data['home_drtg']) / 100.0
        data['recent_form_10'] = data['home_win_pct'] - data['away_win_pct']
        data['head_to_head_factor'] = np.clip(
            (data['home_win_pct'] - data['away_win_pct']) * 0.8 + np.random.normal(0, 0.08, num_samples),
            -1,
            1,
        )
        data['usage_rates'] = np.clip(
            (data['away_injuries_impact'] - data['home_injuries_impact']) / 10.0,
            -1,
            1,
        )
        data['live_odds_signal'] = np.clip(
            base_score / 25.0 + np.random.normal(0, 0.08, num_samples),
            -1,
            1,
        )
        data['home_team_toronto'] = np.random.binomial(1, 0.03, num_samples).astype(float)
        data['away_team_toronto'] = np.where(
            data['home_team_toronto'] > 0,
            0.0,
            np.random.binomial(1, 0.03, num_samples).astype(float),
        )
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
            settled_bets = storage.get_settled_paper_bets_for_training('nba')
            parsed_rows = []
            for bet in settled_bets:
                parsed = self._parse_settled_paper_bet(bet)
                if parsed:
                    parsed_rows.append(parsed)
            if parsed_rows:
                bets_df = pd.DataFrame(parsed_rows)
                df = pd.concat([df, bets_df], ignore_index=True)
                print(f"Augmented NBA training data with {len(parsed_rows)} settled paper bets.")
        except Exception as e:
            print(f"Error loading settled paper bets for NBA training: {e}")

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
            learning_rate=0.04,
            max_depth=5,
            n_estimators=200
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
            
        print(f"Trained NBA XGBoost Engine successfully using {training_source} ({len(df)} rows).")

    def load_or_train(self):
        if self._load_existing_artifacts() and self.training_source == HISTORICAL_TRAINING_SOURCE:
            print(f"Loaded NBA XGBoost Engine trained on {self.training_rows} historical rows.")
            return

        self.train()
        
    def predict(self, game_features):
        df = self._prepare_features(game_features)
        row = df.iloc[0]
        
        home_factor = NBA_HOME_FACTORS['toronto_international'] if (row['home_team_toronto'] > 0 and row['away_team_toronto'] == 0) or (row['away_team_toronto'] > 0 and row['home_team_toronto'] == 0) else NBA_HOME_FACTORS['standard']
        
        base_score = (
            (row['off_rating_diff'] * NBA_WEIGHTS['off_rating']) +
            (row['def_rating_diff'] * NBA_WEIGHTS['def_rating']) +
            (row['recent_form_10'] * NBA_WEIGHTS['recent_form_10']) +
            (row['head_to_head_factor'] * NBA_WEIGHTS['head_to_head']) +
            (row['usage_rates'] * NBA_WEIGHTS['usage_rates']) +
            (row['live_odds_signal'] * NBA_WEIGHTS['live_odds_signal']) +
            (NBA_WEIGHTS['home_court_base'] * home_factor)
        )
        
        b2b_multiplier = NBA_MULTIPLIERS['back_to_back'] if row['home_b2b'] > 0 else 1.0
        # Formula applies back-to-back to home base score
        final_score = base_score * b2b_multiplier
        
        # Convert score to prob (e.g. sigmoid since we normalized around 0)
        prob = 1 / (1 + np.exp(-final_score))
        home_win_prob = np.clip(prob, 0.01, 0.99)
        away_win_prob = 1.0 - home_win_prob
        
        return {
            "home_win_prob": float(home_win_prob),
            "away_win_prob": float(away_win_prob),
            "feature_impact": list(NBA_WEIGHTS.values()),
            "feature_names": list(NBA_WEIGHTS.keys()),
        }

    def _prepare_features(self, game_features):
        df = pd.DataFrame([game_features])

        for column, default in FEATURE_DEFAULTS.items():
            if column not in df.columns:
                df[column] = default
        
        # Maps old feature schema for legacy data
        if 'home_ortg' in df.columns and 'away_ortg' in df.columns and df['off_rating_diff'].iloc[0] == 0:
            df['off_rating_diff'] = (df['home_ortg'] - df['away_ortg']) / 100.0
            
        if 'home_drtg' in df.columns and 'away_drtg' in df.columns and df['def_rating_diff'].iloc[0] == 0:
            # lower defensive rating is better
            df['def_rating_diff'] = (df['away_drtg'] - df['home_drtg']) / 100.0
            
        if 'home_win_pct' in df.columns and 'away_win_pct' in df.columns and df['recent_form_10'].iloc[0] == 0:
            df['recent_form_10'] = df['home_win_pct'] - df['away_win_pct']

        for column in FEATURE_COLUMNS:
            df[column] = pd.to_numeric(df[column], errors='coerce').fillna(FEATURE_DEFAULTS[column])

        # Normalize differences to roughly -1 to 1 for consistency
        df['off_rating_diff'] = df['off_rating_diff'].clip(lower=-1.0, upper=1.0)
        df['def_rating_diff'] = df['def_rating_diff'].clip(lower=-1.0, upper=1.0)
        return df[FEATURE_COLUMNS]

    def _get_training_frame(self, training_rows):
        if training_rows is None:
            training_rows = self._fetch_historical_training_rows()

        if training_rows:
            df = pd.DataFrame(training_rows)
            missing_columns = [column for column in FEATURE_COLUMNS + ['home_win'] if column not in df.columns]
            if not missing_columns:
                df = self._coerce_training_frame(df)
                if len(df) >= 200 and df['home_win'].nunique() == 2:
                    return df, HISTORICAL_TRAINING_SOURCE

                print("[BallDontLie] Historical NBA data did not have enough class balance for training")
            else:
                print(f"[BallDontLie] Historical NBA data missing columns: {missing_columns}")

        existing = self._load_existing_artifacts()
        if existing:
            print("Loaded existing NBA XGBoost Engine because historical training data was unavailable.")
            return None, None

        print("Falling back to synthetic NBA training data.")
        return self.generate_mock_data(), SYNTHETIC_TRAINING_SOURCE

    def _coerce_training_frame(self, df):
        for column, default in FEATURE_DEFAULTS.items():
            df[column] = pd.to_numeric(df[column], errors='coerce').fillna(default)

        df['home_win_pct'] = df['home_win_pct'].clip(lower=0.0, upper=1.0)
        df['away_win_pct'] = df['away_win_pct'].clip(lower=0.0, upper=1.0)
        df['home_win'] = pd.to_numeric(df['home_win'], errors='coerce').fillna(0).astype(int)
        return df[FEATURE_COLUMNS + ['home_win']]

    def _fetch_historical_training_rows(self):
        try:
            from app.data.nba_scraper import fetch_historical_nba_training_data

            return fetch_historical_nba_training_data()
        except Exception as e:
            print(f"[BallDontLie] Historical NBA training fetch failed: {e}")
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
                print(f"NBA model load failed from {artifact_path}: {e}")

        return False
