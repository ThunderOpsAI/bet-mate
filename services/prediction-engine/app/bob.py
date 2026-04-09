from __future__ import annotations

import asyncio
import json
import os
import re
from typing import Any, Dict, List, Protocol

import requests


class BobChatProvider(Protocol):
    async def complete(
        self,
        system_prompt: str,
        messages: List[dict],
        max_tokens: int = 1000,
    ) -> str: ...


class GeminiBobProvider:
    def __init__(
        self,
        api_key: str,
        model: str = "gemini-2.5-flash",
        timeout_seconds: float = 30.0,
    ):
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds

    async def complete(
        self,
        system_prompt: str,
        messages: List[dict],
        max_tokens: int = 1000,
    ) -> str:
        payload = {
            "system_instruction": {
                "parts": [{"text": system_prompt}],
            },
            "contents": [
                {
                    "role": "model" if message.get("role") == "assistant" else "user",
                    "parts": [{"text": str(message.get("content", ""))}],
                }
                for message in messages
            ],
            "generationConfig": {
                "maxOutputTokens": max_tokens,
            },
        }
        response = await asyncio.to_thread(
            requests.post,
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent",
            headers={
                "x-goog-api-key": self.api_key,
                "content-type": "application/json",
            },
            json=payload,
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        body = response.json()
        candidates = body.get("candidates", [])
        if not candidates:
            return ""

        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
        return "\n".join(text for text in texts if text).strip()


ROLE_ALLOWLIST = {"user", "assistant"}
BLOCKED_SCOPE_PATTERNS = [
    r"\bmodify code\b",
    r"\bchange (?:the )?prompt\b",
    r"\bsystem prompt\b",
    r"\bedit config\b",
    r"\bupdate config\b",
    r"\brewrite strategy\b",
    r"\bdeploy\b",
    r"\bopen[- ]ended betting advice\b",
    r"\bbest bet(?:s)?\b",
    r"\bwhat should i bet on\b",
    r"\bwho should i back\b",
    r"\bguaranteed winner\b",
    r"\bbuild (?:a|the) feature\b",
    r"\bwrite (?:a|the) script\b",
]
ALLOWED_SCOPE_HINTS = [
    "bob",
    "card",
    "qualified",
    "qualify",
    "skipped",
    "skip",
    "bankroll",
    "allocated",
    "stake",
    "edge",
    "profile",
    "james",
    "paper bet",
    "system bet",
    "today",
]


def sanitize_bob_messages(messages: List[dict]) -> List[Dict[str, str]]:
    sanitized: List[Dict[str, str]] = []
    for raw_message in messages:
        role = str(raw_message.get("role", "user")).strip().lower()
        content = str(raw_message.get("content", "")).strip()
        if not content:
            continue
        sanitized.append(
            {
                "role": role if role in ROLE_ALLOWLIST else "user",
                "content": content[:4000],
            }
        )
    return sanitized


def bob_request_in_scope(messages: List[Dict[str, str]], card_date: str, today_date: str) -> bool:
    if not messages:
        return False
    if card_date != today_date:
        return False

    text = " ".join(message.get("content", "") for message in messages).casefold()
    if any(re.search(pattern, text) for pattern in BLOCKED_SCOPE_PATTERNS):
        return False

    return any(marker in text for marker in ALLOWED_SCOPE_HINTS)


def build_bob_system_prompt(bob_context: Dict[str, Any]) -> str:
    serialized_context = json.dumps(bob_context, default=str, sort_keys=True)
    return (
        "You are Betmate Bob, a constrained explainer for BetMate's Bob strategy profile. "
        "Answer only from the provided context for today's Bob card. "
        "Allowed topics: why a bet qualified, why an opportunity was skipped, how bankroll was allocated, "
        "how Bob compares with other strategy profiles today, and how a user paper bet relates to logged model signals. "
        "Refuse open-ended betting advice, future picks, code changes, prompt changes, configuration edits, deployment help, "
        "or anything outside today's card context. "
        "If the answer is not in the context, say you cannot answer from today's card context.\n"
        f"Context JSON: {serialized_context}"
    )


def build_local_bob_fallback(messages: List[Dict[str, str]], bob_context: Dict[str, Any]) -> str:
    bob_card = bob_context["strategy_card"]
    profile_cards = bob_context["all_profile_cards"]
    selected_bets = bob_card.get("selected_bets", [])
    skipped = bob_card.get("skipped_opportunities", [])
    latest_question = messages[-1]["content"] if messages else ""
    top_bet = selected_bets[0] if selected_bets else None
    comparison = ", ".join(
        f"{card['display_name']}: {card['selected_count']} bets"
        for card in profile_cards
    )

    if "skip" in latest_question.casefold() and skipped:
        item = skipped[0]
        return (
            f"{latest_question}\n\n"
            f"Bob skipped {item['selection']} in {item['event_name']} because {item['reason']}. "
            f"Recorded edge was {item['edge']:.4f} and odds provenance was {item['odds_source']}."
        )

    if top_bet:
        return (
            f"{latest_question}\n\n"
            f"Today's Bob card for {bob_context['card_date']} has {len(selected_bets)} bets, "
            f"${bob_card['total_allocated']:.2f} allocated, and expected edge {bob_card['expected_edge']:.4f}. "
            f"Top selection is {top_bet['selection']} in {top_bet['event_name']} at {top_bet['odds_used']:.2f} "
            f"from {top_bet['odds_source']} with stake ${top_bet['stake']:.2f}. Other profile counts: {comparison}."
        )

    return (
        f"{latest_question}\n\n"
        f"Bob has no qualifying bets on the {bob_context['card_date']} card. "
        f"Profile summary: {comparison}."
    )


def build_bob_provider_from_env():
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    model = os.getenv("BETMATE_BOB_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"
    timeout_seconds = float(os.getenv("BETMATE_BOB_TIMEOUT_SECONDS", "30") or 30)
    return GeminiBobProvider(api_key=api_key, model=model, timeout_seconds=timeout_seconds)
