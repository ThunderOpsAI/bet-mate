import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import pickle
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), "racing_model.pkl")
SYNTHETIC_TRAINING_SOURCE = 'synthetic_market_prior'

FEATURE_COLUMNS = [
    'barrier',
    'weight',
    'past_win_rate',
    'jockey_win_rate',
    'track_condition',
    'days_since_last_race',
    'betfair_back_price',
    'betfair_implied_prob',
]

FEATURE_DEFAULTS = {
    'barrier': 8,
    'weight': 58.0,
    'past_win_rate': 0.12,
    'jockey_win_rate': 0.12,
    'track_condition': 2,
    'days_since_last_race': 21,
    'betfair_back_price': 10.0,
    'betfair_implied_prob': 0.1,
}

class RacingPredictor:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_columns = FEATURE_COLUMNS
        self.training_source = None
        self.training_rows = 0
        
    def generate_mock_data(self, num_samples=10000):
        """Generate pseudo-random historical data for training since we lack an API key."""
        np.random.seed(42)
        data = pd.DataFrame({
            'barrier': np.random.randint(1, 15, num_samples),
            'weight': np.random.normal(58, 2.5, num_samples),
            'past_win_rate': np.random.uniform(0, 0.4, num_samples),
            'jockey_win_rate': np.random.uniform(0.05, 0.3, num_samples),
            'track_condition': np.random.randint(1, 5, num_samples), # 1: Fast, 4: Heavy
            'days_since_last_race': np.random.randint(7, 180, num_samples),
        })
        
        # Target: probability of winning based on a secret formula to simulate real-world physics/stats
        raw_score = (
            (data['jockey_win_rate'] * 40) + 
            (data['past_win_rate'] * 30) - 
            (data['barrier'] * 1.5) - 
            ((data['weight'] - 54) * 0.5)
        )

        # Betfair market prices are a strong ensemble signal when available.
        market_logit = (raw_score - raw_score.mean()) / 8 + np.random.normal(0, 0.8, num_samples)
        data['betfair_implied_prob'] = np.clip(1 / (1 + np.exp(-market_logit)), 0.02, 0.75)
        data['betfair_back_price'] = 1 / data['betfair_implied_prob']
        base_score = raw_score + (data['betfair_implied_prob'] * 25)
        
        # Add noise
        base_score += np.random.normal(0, 5, num_samples)
        
        # Turn into classification (top 15% scores win)
        threshold = np.percentile(base_score, 85)
        data['won'] = (base_score >= threshold).astype(int)
        
        return data[FEATURE_COLUMNS + ['won']]

    def train(self):
        df = self.generate_mock_data()
        X = df[FEATURE_COLUMNS]
        y = df['won']
        
        X_scaled = self.scaler.fit_transform(X)
        X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)
        
        self.model = xgb.XGBClassifier(
            objective='binary:logistic',
            eval_metric='logloss',
            learning_rate=0.05,
            max_depth=6,
            n_estimators=200
        )
        self.model.fit(X_train, y_train)
        self.training_source = SYNTHETIC_TRAINING_SOURCE
        self.training_rows = len(df)
        
        # Save model and scaler
        with open(MODEL_PATH, 'wb') as f:
            pickle.dump({
                'model': self.model,
                'scaler': self.scaler,
                'feature_columns': FEATURE_COLUMNS,
                'training_source': self.training_source,
                'training_rows': self.training_rows,
            }, f)
            
        print("Trained Racing XGBoost Engine successfully.")
        
    def predict(self, horses_data):
        """
        horses_data is a list of dicts with features
        """
        if self.model is None:
            if os.path.exists(MODEL_PATH):
                with open(MODEL_PATH, 'rb') as f:
                    artifacts = pickle.load(f)
                    if artifacts.get('feature_columns') != FEATURE_COLUMNS:
                        self.train()
                    else:
                        self.model = artifacts['model']
                        self.scaler = artifacts['scaler']
                        self.training_source = artifacts.get('training_source')
                        self.training_rows = artifacts.get('training_rows', 0)
            else:
                self.train()
                
        df = self._prepare_features(horses_data)
        X = self.scaler.transform(df)
        probas = self.model.predict_proba(X)[:, 1]
        
        # Normalize probabilities so they sum up to roughly 1 (100% logic for a race)
        prob_sum = np.sum(probas)
        normalized = probas / prob_sum if prob_sum > 0 else probas
        
        return normalized.tolist(), self.model.feature_importances_.tolist()

    def _prepare_features(self, horses_data):
        df = pd.DataFrame(horses_data)

        for column, default in FEATURE_DEFAULTS.items():
            if column not in df.columns:
                df[column] = default

        for column in FEATURE_COLUMNS:
            df[column] = pd.to_numeric(df[column], errors='coerce').fillna(FEATURE_DEFAULTS[column])

        missing_market_prob = df['betfair_implied_prob'] <= 0
        if missing_market_prob.any():
            df.loc[missing_market_prob, 'betfair_implied_prob'] = df.loc[
                missing_market_prob, 'past_win_rate'
            ].clip(lower=0.01, upper=0.8)

        missing_back_price = df['betfair_back_price'] <= 1
        if missing_back_price.any():
            df.loc[missing_back_price, 'betfair_back_price'] = 1 / df.loc[
                missing_back_price, 'betfair_implied_prob'
            ].clip(lower=0.01)

        return df[FEATURE_COLUMNS]
