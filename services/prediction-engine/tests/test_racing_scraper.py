import re

import requests

from app.data import scraper


def _build_live_race(venue: str, start_time: str, horse_names: list[str]):
    return {
        "race_id": f"{venue.lower().replace(' ', '_')}-r1",
        "venue": venue,
        "race_number": 1,
        "distance": 1400,
        "start_time": start_time,
        "market_name": "R1 1400m",
        "source": "betfair_live",
        "horses": [
            {
                "horse_id": f"{venue}-{index}",
                "name": name,
                "barrier": index + 1,
                "weight": 56.5 + index,
                "past_win_rate": 0.2 + (index * 0.01),
                "jockey_win_rate": 0.1 + (index * 0.01),
                "track_condition": 2,
                "days_since_last_race": 14 + index,
                "betfair_back_price": 3.0 + index,
                "betfair_implied_prob": 0.33,
            }
            for index, name in enumerate(horse_names)
        ],
    }


def test_target_day_keeps_known_qld_wa_and_unknown_meetings(monkeypatch):
    monkeypatch.setattr(scraper, "_get_api_headers", lambda: {"ok": True})
    monkeypatch.setattr(
        scraper,
        "_fetch_live_races",
        lambda _headers, _target_date: [
            _build_live_race("Flemington", "2026-07-01T23:30:00Z", ["Silver Comet", "Night Parade"]),
            _build_live_race("Eagle Farm", "2026-07-02T00:30:00Z", ["Golden Ember", "Harbour King"]),
            _build_live_race("Bendigo", "2026-07-01T23:30:00Z", ["Blue Monarch", "Velvet Charge"]),
        ],
    )

    def raise_timeout(_url: str):
        raise requests.Timeout("skip enrichment")

    monkeypatch.setattr(scraper, "_fetch_racing_australia_html", raise_timeout)

    races = scraper.fetch_today_races(run_date="2026-07-02")

    assert [race["venue"] for race in races] == ["Flemington", "Eagle Farm", "Bendigo"]
    assert races[0]["meeting_type"] == "metro"
    assert races[0]["meeting_region"] == "VIC"
    assert races[0]["meeting_date"] == "2026-07-02"
    assert races[1]["meeting_type"] == "metro"
    assert races[1]["meeting_region"] == "QLD"
    assert races[2]["meeting_type"] == "unknown"


def test_allowlist_active_days_still_apply_when_config_is_restricted(monkeypatch):
    monkeypatch.setattr(scraper, "_get_api_headers", lambda: {"ok": True})
    monkeypatch.setattr(
        scraper,
        "_fetch_live_races",
        lambda _headers, _target_date: [
            _build_live_race("Eagle Farm", "2026-07-02T00:30:00Z", ["Golden Ember", "Harbour King"]),
        ],
    )
    monkeypatch.setattr(
        scraper,
        "load_metro_allowlist",
        lambda force_reload=False: {
            scraper._normalize_name("Eagle Farm"): {
                "venue": "Eagle Farm",
                "state": "QLD",
                "region": "QLD",
                "active_days": ["wed"],
                "aliases": ["eagle farm"],
            }
        },
    )
    monkeypatch.setattr(scraper, "_fetch_racing_australia_html", lambda _url: "")

    races = scraper.fetch_today_races(run_date="2026-07-02")

    assert races == []


def test_meeting_context_uses_melbourne_timezone_and_handles_dst_boundary():
    thursday_context = scraper._meeting_context_for_start_time("2026-07-01T23:30:00Z")
    assert thursday_context["date"] == "2026-07-02"
    assert thursday_context["weekday"] == "thu"

    dst_boundary_context = scraper._meeting_context_for_start_time("2026-04-04T15:30:00Z")
    assert dst_boundary_context["date"] == "2026-04-05"
    assert dst_boundary_context["weekday"] == "sun"


def test_betfair_and_racing_australia_merge_produces_horse_and_jockey_names(monkeypatch):
    monkeypatch.setattr(scraper, "_get_api_headers", lambda: {"ok": True})
    monkeypatch.setattr(
        scraper,
        "_fetch_live_races",
        lambda _headers, _target_date: [
            _build_live_race("Flemington", "2026-07-01T23:30:00Z", ["Silver Comet", "Night Parade"]),
        ],
    )
    monkeypatch.setattr(
        scraper,
        "_fetch_racing_australia_html",
        lambda _url: """
            <table>
              <tr><th>Horse</th><th>Jockey</th></tr>
              <tr><td>Silver Comet</td><td>J. McNeil</td></tr>
              <tr><td>Night Parade</td><td>B. Melham</td></tr>
            </table>
        """,
    )

    races = scraper.fetch_today_races(run_date="2026-07-02")

    assert len(races) == 1
    assert races[0]["data_source"] == "racing_australia"
    horse_map = {horse["name"]: horse for horse in races[0]["horses"]}
    assert horse_map["Silver Comet"]["jockey_name"] == "J. McNeil"
    assert horse_map["Silver Comet"]["data_source"] == "racing_australia"
    assert horse_map["Night Parade"]["jockey_name"] == "B. Melham"


def test_failed_enrichment_returns_betfair_card_unchanged(monkeypatch):
    base_race = _build_live_race("Flemington", "2026-07-01T23:30:00Z", ["Silver Comet", "Night Parade"])

    monkeypatch.setattr(scraper, "_get_api_headers", lambda: {"ok": True})
    monkeypatch.setattr(scraper, "_fetch_live_races", lambda _headers, _target_date: [base_race])

    def raise_timeout(_url: str):
        raise requests.Timeout("skip enrichment")

    monkeypatch.setattr(scraper, "_fetch_racing_australia_html", raise_timeout)

    races = scraper.fetch_today_races(run_date="2026-07-02")

    assert len(races) == 1
    assert races[0]["data_source"] == "betfair"
    assert [horse["name"] for horse in races[0]["horses"]] == ["Silver Comet", "Night Parade"]
    assert all(horse["jockey_name"] is None for horse in races[0]["horses"])


def test_mock_responses_do_not_use_placeholder_horse_numbering(monkeypatch):
    monkeypatch.setattr(scraper, "_get_api_headers", lambda: None)

    races = scraper.fetch_today_races()

    assert races
    for race in races:
        for horse in race["horses"]:
            assert not re.fullmatch(r"Horse \d+", horse["name"])


def test_fetch_today_races_filters_out_non_target_dates(monkeypatch):
    monkeypatch.setattr(scraper, "_get_api_headers", lambda: {"ok": True})
    monkeypatch.setattr(
        scraper,
        "_fetch_live_races",
        lambda _headers, _target_date: [
            _build_live_race("Flemington", "2026-07-01T23:30:00Z", ["Silver Comet", "Night Parade"]),
            _build_live_race("Flemington", "2026-07-03T01:30:00Z", ["Golden Ember", "Harbour King"]),
        ],
    )
    monkeypatch.setattr(scraper, "_fetch_racing_australia_html", lambda _url: "")

    races = scraper.fetch_today_races(run_date="2026-07-02")

    assert len(races) == 1
    assert races[0]["meeting_date"] == "2026-07-02"
