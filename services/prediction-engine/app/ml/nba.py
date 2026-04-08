import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import pickle
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), "nba_model.pkl")

class NBAPredictor:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        
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
        return data

    def train(self):
        df = self.generate_mock_data()
        X = df.drop('home_win', axis=1)
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
        
        with open(MODEL_PATH, 'wb') as f:
            pickle.dump({'model': self.model, 'scaler': self.scaler}, f)
            
        print("Trained NBA XGBoost Engine successfully.")
        
    def predict(self, game_features):
        if self.model is None:
            if os.path.exists(MODEL_PATH):
                with open(MODEL_PATH, 'rb') as f:
                    artifacts = pickle.load(f)
                    self.model = artifacts['model']
                    self.scaler = artifacts['scaler']
            else:
                self.train()
                
        df = pd.DataFrame([game_features])
        X = self.scaler.transform(df)
        probas = self.model.predict_proba(X)[0]
        
        return {
            "home_win_prob": float(probas[1]),
            "away_win_prob": float(probas[0]),
            "feature_impact": self.model.feature_importances_.tolist()
        }
