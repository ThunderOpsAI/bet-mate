from app.exotics import (
    exacta_combinations,
    first4_combinations,
    flexi_percentage,
    multi_race_combinations,
    quinella_combinations,
    same_race_multi_odds,
    trifecta_combinations,
)
from app.sgm import calculate_sgm_odds


def test_exotic_combination_formulas():
    assert quinella_combinations(4) == 6
    assert exacta_combinations(4) == 12
    assert trifecta_combinations(4) == 24
    assert first4_combinations(5) == 120
    assert multi_race_combinations([['a', 'b'], ['c'], ['d', 'e'], ['f', 'g']]) == 8


def test_flexi_percentage_enforces_real_thresholds():
    assert flexi_percentage(5, 10) == 0.5


def test_same_race_multi_returns_correlation_adjusted_odds():
    priced = same_race_multi_odds(
        [{'runner_id': 'a', 'top_n': 2}, {'runner_id': 'b', 'top_n': 4}],
        {'a': 0.4, 'b': 0.3, 'c': 0.2, 'd': 0.1},
    )
    assert priced['fair_probability'] > 0
    assert priced['adjusted_odds'] < priced['fair_odds']
    assert priced['correlation_haircut'] == 0.15


def test_sgm_correlation_matrix_prices_inside_one_event():
    priced = calculate_sgm_odds(
        [
            {'market_type': 'head_to_head', 'odds': 1.7},
            {'market_type': 'spread', 'odds': 1.9},
            {'market_type': 'total_points', 'odds': 1.95},
        ],
        'nba',
    )
    assert priced['fair_probability'] > 0
    assert priced['adjusted_probability'] > priced['fair_probability']
    assert 0.12 <= priced['correlation_haircut'] <= 0.18
