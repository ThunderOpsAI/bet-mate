import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import pickle
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), "afl_model.pkl")

FEATURE_COLUMNS = [
    'home_win_streak',
    'away_win_streak',
    'home_avg_points_for',
    'away_avg_points_for',
    'home_avg_points_against',
    'away_avg_points_against',
    'home_rest_days',
    'away_rest_days',
    'weather_condition',
    'travel_distance_away',
    'squiggle_home_signal',
]

FEATURE_DEFAULTS = {
    'home_win_streak': 0.0,
    'away_win_streak': 0.0,
    'home_avg_points_for': 85.0,
    'away_avg_points_for': 85.0,
    'home_avg_points_against': 80.0,
    'away_avg_points_against': 80.0,
    'home_rest_days': 7.0,
    'away_rest_days': 7.0,
    'weather_condition': 1.0,
    'travel_distance_away': 500.0,
    'squiggle_home_signal': 0.5,
}

class AFLPredictor:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_columns = FEATURE_COLUMNS
        
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
        
        return data[FEATURE_COLUMNS + ['home_win']]

    def train(self):
        df = self.generate_mock_data()
        X = df[FEATURE_COLUMNS]
        y = df['home_win']
        
        X_scaled = self.scaler.fit_transform(X)
        X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)
        
        self.model = xgb.XGBClassifier(
            objective='binary:logistic',
            eval_metric='logloss',
            learning_rate=0.03,
            max_depth=5,
            n_estimators=250
        )
        self.model.fit(X_train, y_train)
        
        with open(MODEL_PATH, 'wb') as f:
            pickle.dump({
                'model': self.model,
                'scaler': self.scaler,
                'feature_columns': FEATURE_COLUMNS,
            }, f)
            
        print("Trained AFL XGBoost Engine successfully.")
        
    def predict(self, game_features):
        """game_features is a dict of features for a single game"""
        if self.model is None:
            if os.path.exists(MODEL_PATH):
                with open(MODEL_PATH, 'rb') as f:
                    artifacts = pickle.load(f)
                    if artifacts.get('feature_columns') != FEATURE_COLUMNS:
                        self.train()
                    else:
                        self.model = artifacts['model']
                        self.scaler = artifacts['scaler']
            else:
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

        df['squiggle_home_signal'] = df['squiggle_home_signal'].clip(lower=0.0, upper=1.0)
        return df[FEATURE_COLUMNS]
