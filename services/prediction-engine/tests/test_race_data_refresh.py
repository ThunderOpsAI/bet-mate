from unittest.mock import MagicMock
import pytest
import modal_app

def test_race_data_refresh_calls_predict_and_logs(monkeypatch):
    # Mock racing_scraper.fetch_today_races
    mock_races = [
        {
            "race_id": "test_race_123",
            "venue": "Flemington",
            "race_number": 1,
            "distance": 1200,
            "horses": [
                {
                    "name": "Runner A",
                    "barrier": 1,
                    "weight": 56.5,
                    "past_win_rate": 0.20,
                    "jockey_win_rate": 0.15,
                    "track_condition": 2,
                    "days_since_last_race": 15,
                    "betfair_back_price": 3.0,
                },
                {
                    "name": "Runner B",
                    "barrier": 2,
                    "weight": 58.0,
                    "past_win_rate": 0.10,
                    "jockey_win_rate": 0.10,
                    "track_condition": 2,
                    "days_since_last_race": 20,
                    "betfair_back_price": 5.0,
                }
            ]
        }
    ]
    monkeypatch.setattr(modal_app.racing_scraper, "fetch_today_races", lambda run_date: mock_races)
    
    # Mock RacingPredictor predict method
    mock_probs = [0.6, 0.4]
    mock_importances = [0.1] * 10
    
    class MockPredictor:
        training_source = "mock"
        training_rows = 100
        feature_columns = [
            "speed_rating", "horse_win_rate", "jockey_win_rate", "track_conditions",
            "recent_form", "barrier", "weight", "class_factor", "horse_jockey_proven",
            "jockey_trainer_proven"
        ]
        def load_or_train(self):
            pass
        def predict(self, feature_rows):
            return mock_probs, mock_importances
            
    monkeypatch.setattr(modal_app, "RacingPredictor", MockPredictor)
    
    # Run race_data_refresh locally
    summary = modal_app.race_data_refresh.local()
    
    # Assertions
    assert summary["races"] == 1
    assert summary["predictions_logged"] == 1
    assert len(summary["errors"]) == 0
    
    # Assert predictions are stored in DB
    import app.storage as storage
    stored = storage.get_recent_predictions()
    assert len(stored) == 2
    
    # Check probabilities are logged correctly (ordered by DESC COALESCE(updated_at, created_at) DESC, id DESC so it might be Runner B first or Runner A depending on insertion)
    selections = {p["selection"]: p["probability"] for p in stored}
    assert selections["Runner A"] == 60.0
    assert selections["Runner B"] == 40.0
