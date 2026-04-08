import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import pickle
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), "racing_model.pkl")

class RacingPredictor:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        
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
        base_score = (
            (data['jockey_win_rate'] * 40) + 
            (data['past_win_rate'] * 30) - 
            (data['barrier'] * 1.5) - 
            ((data['weight'] - 54) * 0.5)
        )
        
        # Add noise
        base_score += np.random.normal(0, 5, num_samples)
        
        # Turn into classification (top 15% scores win)
        threshold = np.percentile(base_score, 85)
        data['won'] = (base_score >= threshold).astype(int)
        
        return data

    def train(self):
        df = self.generate_mock_data()
        X = df.drop('won', axis=1)
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
        
        # Save model and scaler
        with open(MODEL_PATH, 'wb') as f:
            pickle.dump({'model': self.model, 'scaler': self.scaler}, f)
            
        print("Trained Racing XGBoost Engine successfully.")
        
    def predict(self, horses_data):
        """
        horses_data is a list of dicts with features
        """
        if self.model is None:
            if os.path.exists(MODEL_PATH):
                with open(MODEL_PATH, 'rb') as f:
                    artifacts = pickle.load(f)
                    self.model = artifacts['model']
                    self.scaler = artifacts['scaler']
            else:
                self.train()
                
        df = pd.DataFrame(horses_data)
        X = self.scaler.transform(df)
        probas = self.model.predict_proba(X)[:, 1]
        
        # Normalize probabilities so they sum up to roughly 1 (100% logic for a race)
        prob_sum = np.sum(probas)
        normalized = probas / prob_sum if prob_sum > 0 else probas
        
        return normalized.tolist(), self.model.feature_importances_.tolist()
