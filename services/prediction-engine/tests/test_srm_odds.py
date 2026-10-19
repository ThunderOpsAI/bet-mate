from unittest.mock import patch

import pytest

from app import srm_odds
from app.srm_odds import LiveOddsUnavailable, normalise_name, price_srm

RUNNERS = [
    {"runner_id": "a", "name": "1. Fast Horse", "win_price": 2.5},
    {"runner_id": "b", "name": "Slow Horse", "win_price": 4.0},
    {"runner_id": "c", "name": "Other One", "win_price": 6.0},
    {"runner_id": "d", "name": "Long Shot", "win_price": 15.0},
]
LEGS = [{"runner_id": "a", "position": "top2"}, {"runner_id": "b", "position": "top3"}]


def test_normalise_name_strips_saddlecloth():
    assert normalise_name("1. Fast Horse") == normalise_name("FAST HORSE") == "fasthorse"


def test_uses_live_ladbrokes_inputs_when_available():
    live = {"fasthorse": 3.0, "slowhorse": 3.5, "otherone": 6.0, "longshot": 12.0}
    with patch.object(srm_odds, "fetch_ladbrokes_win_odds", return_value=live):
        result = price_srm("Flemington", 1, LEGS, RUNNERS)
    assert result["input_source"] == "LADBROKES"
    assert result["is_live"] is True
    assert result["adjusted_odds"] > 1


def test_falls_back_to_model_when_blocked():
    with patch.object(srm_odds, "fetch_ladbrokes_win_odds", side_effect=LiveOddsUnavailable("HTTP 403", blocked=True)):
        result = price_srm("Flemington", 1, LEGS, RUNNERS)
    assert result["input_source"] == "MODEL"
    assert result["is_live"] is False
    assert result["blocked"] is True
    assert result["fallback_reason"] == "HTTP 403"


def test_falls_back_when_runner_not_matched():
    with patch.object(srm_odds, "fetch_ladbrokes_win_odds", return_value={"fasthorse": 3.0, "zzz": 2.0}):
        result = price_srm("Flemington", 1, LEGS, RUNNERS)
    assert result["input_source"] == "MODEL"


def test_errors_when_no_prices_at_all():
    runners = [{"runner_id": "a", "name": "A"}, {"runner_id": "b", "name": "B"}]
    with patch.object(srm_odds, "fetch_ladbrokes_win_odds", side_effect=LiveOddsUnavailable("down")):
        with pytest.raises(ValueError):
            price_srm("X", 1, LEGS, runners)
