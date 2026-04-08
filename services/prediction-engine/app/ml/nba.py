import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import pickle
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), "nba_model.pkl")
HISTORICAL_TRAINING_SOURCE = 'balldontlie_historical'
SYNTHETIC_TRAINING_SOURCE = 'synthetic'

FEATURE_COLUMNS = [
    'home_b2b',
    'away_b2b',
    'home_win_pct',
    'away_win_pct',
    'home_ortg',
    'home_drtg',
    'away_ortg',
    'away_drtg',
    'home_injuries_impact',
    'away_injuries_impact',
]

FEATURE_DEFAULTS = {
    'home_b2b': 0,
    'away_b2b': 0,
    'home_win_pct': 0.5,
    'away_win_pct': 0.5,
    'home_ortg': 110.0,
    'home_drtg': 110.0,
    'away_ortg': 110.0,
    'away_drtg': 110.0,
    'home_injuries_impact': 0.0,
    'away_injuries_impact': 0.0,
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
        return data[FEATURE_COLUMNS + ['home_win']]

    def train(self, training_rows=None):
        df, training_source = self._get_training_frame(training_rows)
        if df is None:
            return

        X = df[FEATURE_COLUMNS]
        y = df['home_win']
        
        X_scaled = self.scaler.fit_transform(X)
        X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)
        
        self.model = xgb.XGBClassifier(
            objective='binary:logistic',
            eval_metric='logloss',
            learning_rate=0.04,
            max_depth=5,
            n_estimators=200
        )
        self.model.fit(X_train, y_train)
        self.training_source = training_source
        self.training_rows = len(df)
        
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
        if self.model is None:
            if not self._load_existing_artifacts():
                self.train()
                
        df = self._prepare_features(game_features)
        X = self.scaler.transform(df)
        probas = self.model.predict_proba(X)[0]
        
        return {
            "home_win_prob": float(probas[1]),
            "away_win_prob": float(probas[0]),
            "feature_impact": self.model.feature_importances_.tolist(),
            "feature_names": FEATURE_COLUMNS,
        }

    def _prepare_features(self, game_features):
        df = pd.DataFrame([game_features])

        for column, default in FEATURE_DEFAULTS.items():
            if column not in df.columns:
                df[column] = default

        for column in FEATURE_COLUMNS:
            df[column] = pd.to_numeric(df[column], errors='coerce').fillna(FEATURE_DEFAULTS[column])

        df['home_win_pct'] = df['home_win_pct'].clip(lower=0.0, upper=1.0)
        df['away_win_pct'] = df['away_win_pct'].clip(lower=0.0, upper=1.0)
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
        if not os.path.exists(MODEL_PATH):
            return False

        try:
            with open(MODEL_PATH, 'rb') as f:
                artifacts = pickle.load(f)

            if artifacts.get('feature_columns') != FEATURE_COLUMNS:
                return False

            self.model = artifacts['model']
            self.scaler = artifacts['scaler']
            self.training_source = artifacts.get('training_source')
            self.training_rows = artifacts.get('training_rows', 0)
            return True
        except Exception as e:
            print(f"NBA model load failed: {e}")
            return False
