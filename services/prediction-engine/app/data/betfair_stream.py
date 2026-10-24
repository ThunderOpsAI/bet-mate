"""Betfair Exchange Stream API (ESA) client connecting over persistent TLS sockets."""
from __future__ import annotations

import asyncio
import json
import logging
import ssl
from typing import Any, AsyncGenerator, Callable, Dict, List

LOGGER = logging.getLogger("betmate.betfair_stream")
BETFAIR_STREAM_HOST = "stream-api.betfair.com"
BETFAIR_STREAM_PORT = 443


class BetfairStreamClient:
    """Asynchronous Betfair Exchange Stream API client."""

    def __init__(self, app_key: str, session_token: str, conflate_ms: int = 250):
        self.app_key = app_key
        self.session_token = session_token
        self.conflate_ms = conflate_ms
        self.reader: asyncio.StreamReader | None = None
        self.writer: asyncio.StreamWriter | None = None
        self.req_id = 1
        self.market_cache: Dict[str, Dict[str, Any]] = {}
        self.subscribers: List[Callable[[Dict[str, Any]], Any]] = []
        self._running = False

    async def connect(self):
        """Establish TLS socket connection and authenticate."""
        ssl_ctx = ssl.create_default_context()
        self.reader, self.writer = await asyncio.open_connection(
            BETFAIR_STREAM_HOST, BETFAIR_STREAM_PORT, ssl=ssl_ctx
        )
        line = await self.reader.readline()
        if not line:
            raise ConnectionError("Empty connection response from Betfair Stream API")
        conn_msg = json.loads(line.decode("utf-8").strip())
        LOGGER.info("[Betfair Stream] Connected with connId: %s", conn_msg.get("connId"))

        # Send authentication command terminated with CRLF \r\n
        auth_payload = {
            "op": "authentication",
            "id": self.req_id,
            "appKey": self.app_key,
            "sessionToken": self.session_token,
        }
        await self._send(auth_payload)
        auth_resp = await self._read_message()
        if auth_resp.get("statusCode") != "SUCCESS":
            raise RuntimeError(f"Betfair Stream Auth Failed: {auth_resp}")
        LOGGER.info("[Betfair Stream] Authenticated successfully.")
        self._running = True

    async def subscribe_markets(self, market_ids: list[str], conflate_ms: int | None = None):
        """Subscribe to live market changes with conflation."""
        self.req_id += 1
        effective_conflate = conflate_ms if conflate_ms is not None else self.conflate_ms
        sub_payload = {
            "op": "marketSubscription",
            "id": self.req_id,
            "marketFilter": {"marketIds": market_ids},
            "marketDataFilter": {
                "fields": ["EX_BEST_OFFERS", "EX_TRADED", "EX_MARKET_DEF"],
                "ladderLevels": 3,
            },
            "conflateMs": effective_conflate,
        }
        await self._send(sub_payload)

    def on_market_change(self, callback: Callable[[Dict[str, Any]], Any]):
        """Register callback listener for incoming market changes."""
        self.subscribers.append(callback)

    async def listen(self) -> AsyncGenerator[dict, None]:
        """Continuous generator yielding parsed market change messages (mcm)."""
        while self._running:
            msg = await self._read_message()
            if not msg:
                break
            op = msg.get("op")
            if op == "heartbeat":
                # Acknowledge heartbeat
                await self._send({"op": "heartbeat", "id": self.req_id})
            elif op == "mcm":
                self._process_mcm(msg)
                for cb in self.subscribers:
                    try:
                        res = cb(msg)
                        if asyncio.iscoroutine(res):
                            await res
                    except Exception as err:
                        LOGGER.warning("[Betfair Stream] Callback error: %s", err)
                yield msg

    def _process_mcm(self, msg: dict):
        """Update in-memory market book cache with deltas."""
        mc = msg.get("mc", [])
        for market in mc:
            m_id = market.get("id")
            if not m_id:
                continue
            if m_id not in self.market_cache:
                self.market_cache[m_id] = {}
            # Update market cache with runner changes
            rc = market.get("rc", [])
            for runner in rc:
                r_id = str(runner.get("id"))
                if r_id not in self.market_cache[m_id]:
                    self.market_cache[m_id][r_id] = {}
                if "btr" in runner:
                    self.market_cache[m_id][r_id]["btr"] = runner["btr"]
                if "atb" in runner:
                    self.market_cache[m_id][r_id]["atb"] = runner["atb"]
                if "atl" in runner:
                    self.market_cache[m_id][r_id]["atl"] = runner["atl"]

    async def _send(self, payload: dict):
        if not self.writer:
            raise ConnectionError("Betfair stream writer not connected")
        raw = json.dumps(payload) + "\r\n"
        self.writer.write(raw.encode("utf-8"))
        await self.writer.drain()

    async def _read_message(self) -> dict:
        if not self.reader:
            return {}
        line = await self.reader.readline()
        if not line:
            return {}
        return json.loads(line.decode("utf-8").strip())

    async def close(self):
        """Close connection cleanly."""
        self._running = False
        if self.writer:
            try:
                self.writer.close()
                await self.writer.wait_closed()
            except Exception:
                pass
