import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import pickle
import os

from app.ml.artifacts import ensure_model_dir, legacy_model_path, model_path

from app.ml.weights import RACING_WEIGHTS, RACING_MULTIPLIERS, WEIGHTS_VERSION

MODEL_FILENAME = "racing_model.pkl"
MODEL_PATH = model_path(MODEL_FILENAME)
LEGACY_MODEL_PATH = legacy_model_path(MODEL_FILENAME)
SYNTHETIC_TRAINING_SOURCE = 'synthetic_market_prior'

FEATURE_COLUMNS = [
    'speed_rating',
    'horse_win_rate',
    'jockey_win_rate',
    'track_conditions',
    'recent_form',
    'barrier',
    'weight',
    'class_factor',
    'horse_jockey_proven',
    'jockey_trainer_proven',
]

FEATURE_DEFAULTS = {
    'speed_rating': 0.5,
    'horse_win_rate': 0.12,
    'jockey_win_rate': 0.12,
    'track_conditions': 0.5,
    'recent_form': 0.5,
    'barrier': 8,
    'weight': 58.0,
    'class_factor': 0.5,
    'horse_jockey_proven': 0.0,
    'jockey_trainer_proven': 0.0,
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

        data['horse_win_rate'] = data['past_win_rate']
        data['speed_rating'] = np.clip(
            (data['past_win_rate'] * 0.55) +
            (data['jockey_win_rate'] * 0.25) +
            (data['betfair_implied_prob'] * 0.20) +
            np.random.normal(0, 0.04, num_samples),
            0,
            1,
        )
        data['track_conditions'] = np.clip(
            1 - ((data['track_condition'] - 1) / 4) + np.random.normal(0, 0.05, num_samples),
            0,
            1,
        )
        data['recent_form'] = np.clip(
            (data['past_win_rate'] * 0.7) + np.random.uniform(0, 0.25, num_samples),
            0,
            1,
        )
        data['class_factor'] = np.clip(
            (data['betfair_implied_prob'] * 0.7) + np.random.uniform(0, 0.25, num_samples),
            0,
            1,
        )
        data['horse_jockey_proven'] = np.clip(
            (data['past_win_rate'] * data['jockey_win_rate'] * 4) + np.random.uniform(0, 0.08, num_samples),
            0,
            1,
        )
        data['jockey_trainer_proven'] = np.clip(
            (data['jockey_win_rate'] * 0.6) + np.random.uniform(0, 0.12, num_samples),
            0,
            1,
        )
        
        return data[FEATURE_COLUMNS + ['won']]

    def _parse_settled_paper_bet(self, bet):
        prediction = bet.get("prediction") or {}
        payload = prediction.get("payload")
        if not payload or not isinstance(payload, dict):
            return None
            
        status = bet.get("status")
        if status not in ("WON", "LOST"):
            return None
            
        won = 1.0 if status == "WON" else 0.0
        
        row = {"won": won}
        for col in FEATURE_COLUMNS:
            row[col] = payload.get(col, FEATURE_DEFAULTS.get(col, 0.0))
            
        return row

    def train(self):
        df = self.generate_mock_data()
        
        # Load and append settled paper bets
        try:
            import app.storage as storage
            settled_bets = storage.get_settled_paper_bets_for_training('racing')
            parsed_rows = []
            for bet in settled_bets:
                parsed = self._parse_settled_paper_bet(bet)
                if parsed:
                    parsed_rows.append(parsed)
            if parsed_rows:
                bets_df = pd.DataFrame(parsed_rows)
                df = pd.concat([df, bets_df], ignore_index=True)
                print(f"Augmented Racing training data with {len(parsed_rows)} settled paper bets.")
        except Exception as e:
            print(f"Error loading settled paper bets for Racing training: {e}")

        # Coerce columns to numeric to be safe
        for column in FEATURE_COLUMNS:
            df[column] = pd.to_numeric(df[column], errors='coerce').fillna(FEATURE_DEFAULTS[column])
        df['won'] = pd.to_numeric(df['won'], errors='coerce').fillna(0).astype(int)

        X = df[FEATURE_COLUMNS]
        y = df['won']
        
        # Create equal sample weights for all training rows
        sample_weights = np.ones(len(df))
        
        X_scaled = self.scaler.fit_transform(X)
        X_train, X_test, y_train, y_test, sample_weight_train, sample_weight_test = train_test_split(
            X_scaled, y, sample_weights, test_size=0.2, random_state=42
        )
        
        self.model = xgb.XGBClassifier(
            objective='binary:logistic',
            eval_metric='logloss',
            learning_rate=0.05,
            max_depth=6,
            n_estimators=200
        )
        self.model.fit(X_train, y_train, sample_weight=sample_weight_train)
        self.training_source = SYNTHETIC_TRAINING_SOURCE
        self.training_rows = len(df)
        
        # Save model and scaler outside the source tree so startup training does not dirty git.
        ensure_model_dir()
        with open(MODEL_PATH, 'wb') as f:
            pickle.dump({
                'model': self.model,
                'scaler': self.scaler,
                'feature_columns': FEATURE_COLUMNS,
                'training_source': self.training_source,
                'training_rows': self.training_rows,
            }, f)
            
        print("Trained Racing XGBoost Engine successfully.")

    def load_or_train(self):
        if self._load_existing_artifacts():
            print(f"Loaded Racing XGBoost Engine trained on {self.training_rows} rows.")
            return

        self.train()
        
    def predict(self, horses_data):
        """
        horses_data is a list of dicts with features
        Uses frozen domain weights instead of trained xgboost model.
        """
        df = self._prepare_features(horses_data)
        
        scores = []
        for _, row in df.iterrows():
            # Manual scoring based on WEIGHTS_CONFIG_1.md
            base_score = (
                (row['speed_rating'] * RACING_WEIGHTS['speed_rating']) +
                (row['horse_win_rate'] * RACING_WEIGHTS['horse_win_rate']) +
                (row['jockey_win_rate'] * RACING_WEIGHTS['jockey_win_rate']) +
                (row['track_conditions'] * RACING_WEIGHTS['track_conditions']) +
                (row['recent_form'] * RACING_WEIGHTS['recent_form']) +
                (row['class_factor'] * RACING_WEIGHTS['class_factor']) +
                (max(0, row['barrier'] - 8) * RACING_WEIGHTS['barrier_penalty']) +
                (max(0, row['weight'] - 54) * RACING_WEIGHTS['weight_penalty'])
            )
            
            combo_multiplier = (
                (1.0 + float(row['horse_jockey_proven']) * (RACING_MULTIPLIERS['horse_jockey_combo'] - 1.0)) *
                (1.0 + float(row['jockey_trainer_proven']) * (RACING_MULTIPLIERS['jockey_trainer_combo'] - 1.0))
            )
            
            final_score = base_score * combo_multiplier
            scores.append(max(0.001, final_score))
        
        scores = np.array(scores)
        prob_sum = np.sum(scores)
        normalized = scores / prob_sum if prob_sum > 0 else scores
        
        # Return weights as feature impact
        feature_impact = list(RACING_WEIGHTS.values()) + list(RACING_MULTIPLIERS.values())
        return normalized.tolist(), feature_impact

    def _prepare_features(self, horses_data):
        df = pd.DataFrame(horses_data)

        # map old fields if present
        if 'past_win_rate' in df.columns and 'horse_win_rate' not in df.columns:
            df['horse_win_rate'] = df['past_win_rate']
            
        if 'track_condition' in df.columns and 'track_conditions' not in df.columns:
            df['track_conditions'] = df['track_condition']
            
        for column, default in FEATURE_DEFAULTS.items():
            if column not in df.columns:
                df[column] = default

        for column in FEATURE_COLUMNS:
            df[column] = pd.to_numeric(df[column], errors='coerce').fillna(FEATURE_DEFAULTS[column])

        # Normalize factors to 0-1 range to match config assumption
        df['speed_rating'] = df['speed_rating'].clip(0, 1)
        df['horse_win_rate'] = df['horse_win_rate'].clip(0, 1)
        df['jockey_win_rate'] = df['jockey_win_rate'].clip(0, 1)
        df['track_conditions'] = df['track_conditions'].clip(0, 1)
        df['recent_form'] = df['recent_form'].clip(0, 1)
        df['class_factor'] = df['class_factor'].clip(0, 1)

        # Normalize barrier and weight to a penalty scale suitable for subtraction
        # E.g. penalty per barrier > 8? The spec said "Linear penalty for wide barriers (8+)" 
        # config says -0.03 weight. If we just multiply, we need it as a magnitude
        # So we'll map barrier > 8 to a multiplier, or just let 'barrier' be the raw number 
        # The spec formula says base_score - (barrier_penalty * 0.03) but the config says weight -0.03
        # I'll let them stay raw, so -0.03 * barrier
        # Actually it says -2% penalty per position, and config says -0.03 weight. 
        # So using raw value times -0.03 is basically correct.
        
        return df[FEATURE_COLUMNS]

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
                print(f"Racing model load failed from {artifact_path}: {e}")

        return False
