import re
from pathlib import Path
from typing import Optional

import requests

from app.data import scraper


class _DummyLoginResponse:
    def __init__(self, payload: dict, error: Optional[Exception] = None):
        self._payload = payload
        self._error = error

    def raise_for_status(self):
        if self._error:
            raise self._error
        return None

    def json(self):
        return self._payload


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


def test_target_day_keeps_mapped_qld_wa_and_unmapped_meetings(monkeypatch):
    monkeypatch.setattr(scraper, "_get_api_headers", lambda: {"ok": True})
    monkeypatch.setattr(
        scraper,
        "_fetch_live_races",
        lambda _headers, _target_date: [
            _build_live_race("Flemington", "2026-07-01T23:30:00Z", ["Silver Comet", "Night Parade"]),
            _build_live_race("Eagle Farm", "2026-07-02T00:30:00Z", ["Golden Ember", "Harbour King"]),
            _build_live_race("Belmont (WA)", "2026-07-01T23:30:00Z", ["Blue Monarch", "Velvet Charge"]),
            _build_live_race("Mystery Park", "2026-07-01T23:30:00Z", ["Desert Anthem", "Velvet Charge"]),
        ],
    )

    def raise_timeout(_url: str):
        raise requests.Timeout("skip enrichment")

    monkeypatch.setattr(scraper, "_fetch_racing_australia_html", raise_timeout)

    races = scraper.fetch_today_races(run_date="2026-07-02")

    assert {race["venue"] for race in races} == {"Flemington", "Eagle Farm", "Belmont (WA)", "Mystery Park"}
    by_venue = {race["venue"]: race for race in races}

    flemington = by_venue["Flemington"]
    assert flemington["meeting_type"] == "metro"
    assert flemington["meeting_region"] == "VIC"
    assert flemington["state"] == "VIC"
    assert flemington["meeting_date"] == "2026-07-02"

    eagle_farm = by_venue["Eagle Farm"]
    assert eagle_farm["meeting_type"] == "metro"
    assert eagle_farm["meeting_region"] == "QLD"
    assert eagle_farm["state"] == "QLD"

    belmont = by_venue["Belmont (WA)"]
    assert belmont["meeting_type"] == "metro"
    assert belmont["meeting_region"] == "WA"
    assert belmont["state"] == "WA"

    mystery = by_venue["Mystery Park"]
    assert mystery["meeting_type"] == "unknown"
    assert mystery["meeting_region"] == ""
    assert mystery["state"] == ""


def test_registry_supports_provincial_and_country_tags(monkeypatch):
    monkeypatch.setattr(scraper, "_get_api_headers", lambda: {"ok": True})
    monkeypatch.setattr(
        scraper,
        "_fetch_live_races",
        lambda _headers, _target_date: [
            _build_live_race("Bendigo", "2026-07-01T23:30:00Z", ["Silver Comet", "Night Parade"]),
            _build_live_race("Warrnambool", "2026-07-01T23:30:00Z", ["Golden Ember", "Harbour King"]),
        ],
    )
    monkeypatch.setattr(scraper, "_fetch_racing_australia_html", lambda _url: "")

    races = scraper.fetch_today_races(run_date="2026-07-02")

    assert len(races) == 2
    assert races[0]["meeting_type"] == "provincial"
    assert races[0]["meeting_region"] == "VIC"
    assert races[0]["state"] == "VIC"
    assert races[1]["meeting_type"] == "country"
    assert races[1]["meeting_region"] == "VIC"
    assert races[1]["state"] == "VIC"


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
                "meeting_type": "metro",
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
    scraper._fetch_racing_australia_acceptances.cache_clear()

    def raise_timeout(_url: str):
        raise requests.Timeout("skip enrichment")

    monkeypatch.setattr(scraper, "_fetch_racing_australia_html", raise_timeout)

    races = scraper.fetch_today_races(run_date="2026-07-02")

    assert len(races) == 1
    assert races[0]["data_source"] == "betfair"
    assert [horse["name"] for horse in races[0]["horses"]] == ["Silver Comet", "Night Parade"]
    assert all(horse["jockey_name"] is None for horse in races[0]["horses"])


def test_unauthenticated_fetch_returns_empty_list(monkeypatch):
    monkeypatch.setattr(scraper, "_get_api_headers", lambda: None)

    races = scraper.fetch_today_races(run_date="2026-07-02")

    assert races == []


def test_fetch_today_races_returns_empty_when_live_api_returns_no_markets(monkeypatch):
    class DummyResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return []

    monkeypatch.setattr(scraper, "_get_api_headers", lambda: {"ok": True})
    monkeypatch.setattr(scraper.requests, "post", lambda *args, **kwargs: DummyResponse())

    races = scraper.fetch_today_races(run_date="2026-07-02")

    assert races == []


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


def test_login_uses_certificate_auth_when_configured(monkeypatch):
    monkeypatch.setattr(scraper, "BETFAIR_APP_KEY", "app-key")
    monkeypatch.setattr(scraper, "BETFAIR_USERNAME", "user")
    monkeypatch.setattr(scraper, "BETFAIR_PASSWORD", "pass")
    monkeypatch.setattr(scraper, "_session_token", None)
    monkeypatch.setenv("BETFAIR_AUTH_MODE", "certificate")
    monkeypatch.setenv("BETFAIR_CERT_PEM", "-----BEGIN CERTIFICATE-----\\ncert\\n-----END CERTIFICATE-----")
    monkeypatch.setenv("BETFAIR_KEY_PEM", "-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----")

    captured = {}

    def fake_post(url, data=None, headers=None, timeout=None, cert=None):
        captured["url"] = url
        captured["data"] = data
        captured["headers"] = headers
        captured["timeout"] = timeout
        captured["cert"] = cert
        return _DummyLoginResponse({"sessionToken": "cert-token", "loginStatus": "SUCCESS"})

    monkeypatch.setattr(scraper.requests, "post", fake_post)

    token = scraper._login()

    assert token == "cert-token"
    assert captured["url"] == scraper.BETFAIR_CERT_LOGIN_URL
    assert captured["data"] == {"username": "user", "password": "pass"}
    assert captured["headers"]["X-Application"] == "app-key"
    assert isinstance(captured["cert"], tuple)
    assert all(Path(path).is_file() for path in captured["cert"])
    assert scraper._session_token == "cert-token"


def test_login_auto_falls_back_to_interactive_after_certificate_failure(monkeypatch):
    monkeypatch.setattr(scraper, "BETFAIR_APP_KEY", "app-key")
    monkeypatch.setattr(scraper, "BETFAIR_USERNAME", "user")
    monkeypatch.setattr(scraper, "BETFAIR_PASSWORD", "pass")
    monkeypatch.setattr(scraper, "_session_token", None)
    monkeypatch.setenv("BETFAIR_AUTH_MODE", "auto")
    monkeypatch.setenv("BETFAIR_CERT_PEM", "-----BEGIN CERTIFICATE-----\\ncert\\n-----END CERTIFICATE-----")
    monkeypatch.setenv("BETFAIR_KEY_PEM", "-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----")

    calls = []

    def fake_post(url, data=None, headers=None, timeout=None, cert=None):
        calls.append({"url": url, "cert": cert})
        if url == scraper.BETFAIR_CERT_LOGIN_URL:
            return _DummyLoginResponse({}, error=requests.HTTPError("403 Client Error: Forbidden"))
        return _DummyLoginResponse({"token": "interactive-token", "status": "SUCCESS", "error": ""})

    monkeypatch.setattr(scraper.requests, "post", fake_post)

    token = scraper._login()

    assert token == "interactive-token"
    assert [call["url"] for call in calls] == [
        scraper.BETFAIR_CERT_LOGIN_URL,
        scraper.BETFAIR_INTERACTIVE_LOGIN_URL,
    ]
    assert calls[0]["cert"] is not None
    assert calls[1]["cert"] is None


def test_login_certificate_mode_requires_certificate_material(monkeypatch):
    monkeypatch.setattr(scraper, "BETFAIR_APP_KEY", "app-key")
    monkeypatch.setattr(scraper, "BETFAIR_USERNAME", "user")
    monkeypatch.setattr(scraper, "BETFAIR_PASSWORD", "pass")
    monkeypatch.setattr(scraper, "_session_token", None)
    monkeypatch.setenv("BETFAIR_AUTH_MODE", "certificate")
    monkeypatch.delenv("BETFAIR_CERT_PATH", raising=False)
    monkeypatch.delenv("BETFAIR_KEY_PATH", raising=False)
    monkeypatch.delenv("BETFAIR_CERT_PEM", raising=False)
    monkeypatch.delenv("BETFAIR_KEY_PEM", raising=False)
    monkeypatch.delenv("BETFAIR_CERT_PEM_B64", raising=False)
    monkeypatch.delenv("BETFAIR_KEY_PEM_B64", raising=False)

    def fail_post(*args, **kwargs):
        raise AssertionError("requests.post should not be called without certificate material")

    monkeypatch.setattr(scraper.requests, "post", fail_post)

    assert scraper._login() is None
    assert scraper._session_token is None


def test_parse_racing_australia_results_html_extracts_places_and_exotic_scaffold():
    html = """
        <h3>Race 6 - 3:40PM Example Stakes</h3>
        <table>
          <tr><th>Colour</th><th>Finish</th><th>No.</th><th>Horse</th><th>Trainer</th><th>Jockey</th></tr>
          <tr><td>Image</td><td>1</td><td>4</td><td>Late Charger</td><td>T A</td><td>J Rider</td></tr>
          <tr><td>Image</td><td>2</td><td>2</td><td>Swift Star</td><td>T B</td><td>K Rider</td></tr>
          <tr><td>Image</td><td>3</td><td>6</td><td>Harbour Light</td><td>T C</td><td>L Rider</td></tr>
          <tr><td>Image</td><td>4</td><td>1</td><td>Coastal Theory</td><td>T D</td><td>M Rider</td></tr>
          <tr><td>Image</td><td>5</td><td>3</td><td>Royal Ledger</td><td>T E</td><td>N Rider</td></tr>
          <tr><td>Image</td><td>6</td><td>5</td><td>Golden Static</td><td>T F</td><td>O Rider</td></tr>
          <tr><td>Image</td><td>7</td><td>7</td><td>Midnight Signal</td><td>T G</td><td>P Rider</td></tr>
          <tr><td>Image</td><td>8</td><td>8</td><td>Orbit Parade</td><td>T H</td><td>Q Rider</td></tr>
          <tr><td>Image</td><td>SB</td><td>9</td><td>Scratched Runner</td><td>T I</td><td>R Rider</td></tr>
        </table>
    """

    parsed = scraper._parse_racing_australia_results_html(html)

    assert parsed[6]["winner_selection"] == "Late Charger"
    assert parsed[6]["finish_order"][:4] == ["Late Charger", "Swift Star", "Harbour Light", "Coastal Theory"]
    assert parsed[6]["place_getters"] == ["Late Charger", "Swift Star", "Harbour Light"]
    assert parsed[6]["starter_count"] == 8
    assert parsed[6]["exotic_outcomes"]["quinella"] == ["Late Charger", "Swift Star"]
    assert parsed[6]["exotic_outcomes"]["first4"] == [
        "Late Charger",
        "Swift Star",
        "Harbour Light",
        "Coastal Theory",
    ]


def test_fetch_completed_racing_results_uses_target_metadata(monkeypatch):
    monkeypatch.setattr(
        scraper,
        "_fetch_racing_australia_results",
        lambda meeting_date, state, venue: {
            6: {
                "winner_selection": "Late Charger",
                "finish_order": ["Late Charger", "Swift Star", "Harbour Light"],
                "place_getters": ["Late Charger", "Swift Star", "Harbour Light"],
                "starter_count": 9,
                "exotic_outcomes": {
                    "quinella": ["Late Charger", "Swift Star"],
                    "exacta": ["Late Charger", "Swift Star"],
                    "trifecta": ["Late Charger", "Swift Star", "Harbour Light"],
                },
            }
        },
    )

    results = scraper.fetch_completed_racing_results(
        [
            {
                "event_id": "race_ingest_1",
                "event_name": "Randwick R6",
                "venue": "Randwick",
                "meeting_date": "2026-04-09",
                "state": "NSW",
                "race_number": 6,
            }
        ]
    )

    assert len(results) == 1
    assert results[0]["sport"] == "racing"
    assert results[0]["winner_selection"] == "Late Charger"
    assert results[0]["result_payload"]["place_getters"] == ["Late Charger", "Swift Star", "Harbour Light"]


def test_load_metro_allowlist_file_not_found(monkeypatch):
    from pathlib import Path
    monkeypatch.setattr(scraper, "ALLOWLIST_PATH", Path("non_existent_file_path_12345.json"))
    monkeypatch.setattr(scraper, "_metro_allowlist_cache", None)

    res = scraper.load_metro_allowlist(force_reload=True)
    assert res == {}


def test_fetch_live_races_paginates_beyond_single_page(monkeypatch):
    calls = []

    def fake_post(url, data=None, headers=None, timeout=None):
        payload = scraper.json.loads(data)
        calls.append(payload)
        from_record = int(payload.get("from", 0))
        if url.endswith("listMarketCatalogue/"):
            if from_record == 0:
                # Return page size (1000) mock items to trigger next page fetch
                return _DummyLoginResponse([{"marketId": f"m_{i}", "marketName": f"R1 1200m", "event": {"venue": "Flemington"}} for i in range(1000)])
            else:
                # Return 2 items on second page
                return _DummyLoginResponse([{"marketId": f"m_{1000+i}", "marketName": f"R1 1200m", "event": {"venue": "Caulfield"}} for i in range(2)])
        elif url.endswith("listMarketBook/"):
            return _DummyLoginResponse([])
        raise ValueError(f"Unexpected url {url}")

    monkeypatch.setattr(scraper.requests, "post", fake_post)
    races = scraper._fetch_live_races(headers={"X-Authentication": "token"}, target_date=scraper.date(2026, 7, 2))

    assert len(calls) >= 2
    assert len(races) == 1002
    assert calls[0]["from"] == "0"
    assert calls[1]["from"] == "1000"

