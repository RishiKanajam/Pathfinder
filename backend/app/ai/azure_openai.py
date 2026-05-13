"""
AI Chat engine — priority: OpenAI → Azure AI Services → rule-based fallback.

OpenAI leads because gpt-5.5 gives better empathetic, context-aware replies.
Azure gpt-oss-120b is the backup if OpenAI is unavailable.
"""
from __future__ import annotations

import json
import logging
import os
import ssl
import urllib.error
import urllib.request

try:
    import certifi
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL_CTX = ssl.create_default_context()

_log = logging.getLogger(__name__)


def _env() -> dict:
    from app.env import load_local_env
    load_local_env()
    return {
        "endpoint":   os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/"),
        "key":        os.getenv("AZURE_OPENAI_KEY", ""),
        "deployment": os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-oss-120b"),
        "api_ver":    os.getenv("AZURE_OPENAI_API_VERSION", "2024-05-01-preview"),
        "oai_key":    os.getenv("OPENAI_API_KEY", ""),
        "oai_model":  os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
    }


SYSTEM_PROMPT = """You are PathFinder, a warm and compassionate support guide for the Evolve Mental Health & Wellbeing Hub in the Hunter Region, NSW Australia. You are part of LMNSPN (Lake Macquarie & Newcastle Suicide Prevention Network).

IDENTITY:
- You are an AI support guide — NOT a therapist, counsellor, or friend
- You identified as AI in your first message already — do not repeat this
- You are the bridge to human support, not the destination

CRITICAL CONVERSATION RULES:
- NEVER start your reply with "Thank you for telling me" more than once per conversation
- NEVER repeat the same phrase you used in the previous message
- Read what the person just said and respond SPECIFICALLY to their words
- If they say they are in their room and safe, acknowledge that specifically — don't ask the same question again
- If they say hopeless, reflect that word back — "That feeling of hopelessness sounds really heavy"
- Keep responses SHORT: 2-3 sentences maximum
- Each reply must move the conversation forward — ask ONE new question or offer ONE next step

ABSOLUTE RULES:
- NEVER diagnose or label ("you have depression", "that sounds like PTSD")
- NEVER say "I understand how you feel"
- NEVER provide therapy or clinical interventions
- NEVER end the conversation first or say goodbye
- NEVER use clinical jargon
- Crisis/immediate danger: "Please call 000 right now" and "Lifeline 13 11 14"

STYLE:
- Warm, plain language — like a kind neighbour
- Short sentences. Simple words.
- Use the person's exact words back to them (e.g. if they say "hopeless", say "hopeless")
- Be comfortable with silence — don't rush to fill every gap
- After crisis keywords, always ask: "Are you safe right now?" and "Is anyone with you?"

WHEN HIGH RISK (suicide / self-harm mentioned):
- Surface crisis numbers: 000 · Lifeline 13 11 14 · NSW MH Line 1800 011 511
- Ask "Are you safe right now?"
- Ask "Is anyone with you?"
- After they answer, follow up on THEIR specific answer — don't repeat the crisis script
- Keep them talking

CRISIS CONTACTS: 000 · Lifeline 13 11 14 · NSW MH Line 1800 011 511 · Beyond Blue 1300 22 4636 · 13YARN 13 92 76 · Evolve Hub 02 4096 1100"""


def _post(url: str, headers: dict, body: dict) -> str | None:
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as r:
            resp = json.loads(r.read())
            return resp["choices"][0]["message"]["content"].strip()
    except urllib.error.HTTPError as e:
        _log.warning("HTTP %s from %s: %s", e.code, url[:60], e.read().decode()[:200])
    except Exception as ex:
        _log.warning("Request failed: %s", ex)
    return None


def chat(messages: list[dict], risk_level: str = "low") -> str | None:
    cfg = _env()

    sys_msgs = [{"role": "system", "content": SYSTEM_PROMPT}]
    if risk_level == "high":
        sys_msgs.append({
            "role": "system",
            "content": (
                "ALERT: HIGH RISK detected. The person has expressed suicidal thoughts. "
                "Surface crisis resources. Check they are safe. Check if anyone is with them. "
                "After they answer those questions, respond to what they specifically said — "
                "do NOT keep repeating the crisis script. Hold space. Keep them talking."
            ),
        })

    full_msgs = sys_msgs + messages

    # ── 1. OpenAI (gpt-5.5 or configured model) — best conversation quality ──
    oai_key   = cfg["oai_key"]
    oai_model = cfg["oai_model"]
    if oai_key:
        # gpt-5.x / o-series use max_completion_tokens; gpt-4.x use max_tokens
        token_key = "max_completion_tokens" if any(
            oai_model.startswith(p) for p in ("gpt-5", "o1", "o3", "o4")
        ) else "max_tokens"
        body: dict = {"model": oai_model, "messages": full_msgs, token_key: 200}
        # gpt-5.x and o-series only support default temperature (1) — omit it
        no_temp_models = ("o1", "o3", "o4", "gpt-5")
        if not any(oai_model.startswith(p) for p in no_temp_models):
            body["temperature"] = 0.82
        reply = _post(
            "https://api.openai.com/v1/chat/completions",
            {"Authorization": f"Bearer {oai_key}"},
            body,
        )
        if reply:
            _log.info("OpenAI %s reply (%d chars)", oai_model, len(reply))
            return reply

    # ── 2. Azure AI Services (gpt-oss-120b) — backup ─────────────────────────
    endpoint = cfg["endpoint"]
    key      = cfg["key"]
    if endpoint and key:
        dep = cfg["deployment"]
        ver = cfg["api_ver"]
        body = {"model": dep, "messages": full_msgs, "max_tokens": 200, "temperature": 0.8}

        if "services.ai.azure.com" in endpoint:
            reply = (
                _post(f"{endpoint}/models/chat/completions?api-version={ver}",
                      {"Authorization": f"Bearer {key}"}, body) or
                _post(f"{endpoint}/models/chat/completions?api-version={ver}",
                      {"api-key": key}, body)
            )
        elif "/v1" in endpoint:
            reply = _post(f"{endpoint}/chat/completions",
                          {"Authorization": f"Bearer {key}"}, body)
        else:
            body_no_model = {k: v for k, v in body.items() if k != "model"}
            reply = _post(
                f"{endpoint}/openai/deployments/{dep}/chat/completions?api-version={ver}",
                {"api-key": key}, body_no_model,
            )
        if reply:
            _log.info("Azure reply (%d chars)", len(reply))
            return reply

    _log.info("All AI providers unavailable — rule-based fallback")
    return None


def is_configured() -> bool:
    cfg = _env()
    return bool(cfg["oai_key"] or (cfg["endpoint"] and cfg["key"]))
