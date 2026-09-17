THOROUGHBRED_WEIGHTS = {
    "speed_rating": 0.25,
    "recent_form": 0.20,
    "live_odds_signal": 0.15,
    "class_factor": 0.10,
    "horse_win_rate": 0.10,
    "jockey_trainer_combo": 0.10,
    "jockey_win_rate": 0.05,
    "track_conditions": 0.05,
}

THOROUGHBRED_MULTIPLIERS = {
    "barrier_penalty": 0.97,
    "weight_penalty": 0.97,
    "horse_jockey_combo": 2.0,
}

HARNESS_WEIGHTS = {
    "speed_rating": 0.25,
    "recent_form": 0.20,
    "driver_win_rate": 0.15,
    "live_odds_signal": 0.15,
    "barrier_draw": 0.10,
    "horse_win_rate": 0.10,
    "class_factor": 0.05,
}

GREYHOUND_WEIGHTS = {
    "speed_rating": 0.30,
    "box_draw": 0.20,
    "recent_form": 0.20,
    "early_speed": 0.15,
    "live_odds_signal": 0.15,
}

NBA_WEIGHTS = {
    "off_rating": 0.20,
    "def_rating": 0.20,
    "recent_form_10": 0.20,
    "live_odds_signal": 0.15,
    "head_to_head": 0.10,
    "usage_rates": 0.10,
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
    "live_odds_signal": 0.10,
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
    "live_odds_signal": 0.15,
    "win_streak": 0.10,
    "player_availability": 0.10,
    "home_advantage_base": 0.05,
}

NRL_MULTIPLIERS = {
    "interstate_travel": 0.90,
}

SOCCER_WEIGHTS = {
    "goal_difference": 0.25,
    "recent_form": 0.20,
    "head_to_head": 0.15,
    "expected_goals_diff": 0.15,
    "live_odds_signal": 0.15,
    "home_advantage_base": 0.10,
}

GOLF_WEIGHTS = {
    "recent_finishes": 0.30,
    "course_history": 0.25,
    "sg_approach": 0.20,
    "live_odds_signal": 0.15,
    "sg_off_the_tee": 0.10,
}

MMA_WEIGHTS = {
    "recent_form": 0.20,
    "live_odds_signal": 0.15,
    "reach_advantage": 0.10,
    "strength_of_schedule": 0.10,
    "striking_accuracy": 0.08,
    "takedown_defense": 0.08,
    "striking_power": 0.06,
    "takedowns": 0.05,
    "grappling": 0.05,
    "submission_defense": 0.05,
    "age_advantage": 0.05,
    "submission": 0.03,
}

WEIGHTS_VERSION = "v2.0_auto_2026-08-04"

