RACING_WEIGHTS = {
    "speed_rating": 0.15,
    "horse_win_rate": 0.10,
    "jockey_win_rate": 0.05,
    "track_conditions": 0.08,
    "recent_form": 0.08,
    "barrier_penalty": -0.03,
    "weight_penalty": -0.03,
    "class_factor": 0.04,
}

RACING_MULTIPLIERS = {
    "horse_jockey_combo": 2.0,  # TRUE if won together in last 12mo
    "jockey_trainer_combo": 1.5,  # TRUE if 20%+ strike rate together
}

NBA_WEIGHTS = {
    "off_rating": 0.20,
    "def_rating": 0.20,
    "recent_form_10": 0.15,
    "head_to_head": 0.10,
    "usage_rates": 0.10,
    "live_odds_signal": 0.15,
    "home_court_base": 0.05,
}

NBA_MULTIPLIERS = {
    "back_to_back": 0.85,
}

NBA_HOME_FACTORS = {
    "toronto_international": 0.10,  # Toronto vs US team or vice versa
    "standard": 0.05,
}

AFL_WEIGHTS = {
    "points_differential": 0.25,
    "squiggle_signal": 0.25,
    "recent_form_5": 0.20,
    "win_streak": 0.15,
    "home_advantage_base": 0.05,
}

AFL_TRAVEL_FACTORS = {
    "interstate_long": 0.10,  # WA/QLD/SA vs VIC
    "standard": 0.05,
}

NRL_WEIGHTS = {
    "points_differential": 0.25,
    "recent_form": 0.20,
    "head_to_head": 0.15,
    "home_advantage_base": 0.05,
    "live_odds_signal": 0.15,
}

SOCCER_WEIGHTS = {
    "goal_difference": 0.25,
    "recent_form": 0.20,
    "head_to_head": 0.15,
    "home_advantage_base": 0.05,
    "live_odds_signal": 0.15,
}

GOLF_WEIGHTS = {
    "recent_finishes": 0.30,
    "course_history": 0.25,
    "driving_accuracy": 0.15,
    "putting_average": 0.15,
    "live_odds_signal": 0.15,
}

MMA_WEIGHTS = {
    "striking_accuracy": 0.25,
    "takedown_defense": 0.20,
    "reach_advantage": 0.15,
    "recent_form": 0.20,
    "live_odds_signal": 0.15,
}

WEIGHTS_VERSION = "v1.0_manual_2026-07-19"

