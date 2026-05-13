"""
Azure OpenAI GPT-4o-mini integration.
Falls back gracefully to rule-based replies if Azure is not configured.
Set environment variables:
  AZURE_OPENAI_ENDPOINT  — e.g. https://yourresource.openai.azure.com/
  AZURE_OPENAI_KEY       — your Azure OpenAI API key
  AZURE_OPENAI_DEPLOYMENT — defaults to "gpt-4o-mini"
  AZURE_OPENAI_API_VERSION — defaults to "2024-10-21"
"""
from __future__ import annotations

import os
import json
import urllib.request
import urllib.error

from app.env import load_local_env

load_local_env()

ENDPOINT    = os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
API_KEY     = os.getenv("AZURE_OPENAI_KEY", "")
DEPLOYMENT  = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21")

SYSTEM_PROMPT = """You are PathFinder, a warm and compassionate support guide for the Evolve Mental Health & Wellbeing Hub in the Hunter Region, NSW Australia. You are part of the LMNSPN (Lake Macquarie & Newcastle Suicide Prevention Network).

IDENTITY:
- You are an AI support guide — NOT a therapist, counsellor, or friend
- You must identify as AI in your first message
- You are the bridge to human support, not the destination

RULES — NEVER BREAK THESE:
- NEVER diagnose or label conditions ("you have depression", "that sounds like PTSD")
- NEVER say "I understand how you feel" — say "That sounds really difficult" or "That must be incredibly hard"
- NEVER advise stopping medication or treatment
- NEVER provide therapy, CBT exercises, or clinical interventions
- NEVER promise confidentiality you cannot guarantee
- NEVER end the conversation first or say goodbye
- NEVER use clinical jargon
- If someone expresses immediate danger: IMMEDIATELY say "Please call 000 right now" and "Lifeline is available 24/7 on 13 11 14"
- Ask a MAXIMUM of 3 gentle clarifying questions before suggesting services
- Always offer "Would you prefer to talk to a person? You can call the Evolve Hub on 02 4096 1100"

CONVERSATION STYLE:
- Warm, plain language — like a kind neighbour, not a clinician
- Short sentences, simple words
- Validate feelings without being sycophantic
- Use the person's words back to them (reflective, not parrot-like)
- Be comfortable with silence — don't rush to fill gaps
- Responses should be 2-4 sentences maximum

CRISIS RESOURCES (always include when relevant):
- Emergency: 000
- Lifeline: 13 11 14 (24/7)
- NSW Mental Health Line: 1800 011 511
- Beyond Blue: 1300 22 4636
- 13YARN (Aboriginal & Torres Strait Islander): 13 92 76
- Evolve Hub: 02 4096 1100

WHEN RISK IS HIGH:
- Surface crisis resources immediately
- Ask: "Are you safe right now?"
- Ask: "Is anyone with you?"
- If alone: "Would you be willing to call Lifeline on 13 11 14? They have real people available right now."
- Keep talking — your job is to hold space until a human arrives

Always end with warmth. The Evolve Hub team is here for them."""


def is_configured() -> bool:
    return bool(ENDPOINT and API_KEY)


def chat(
    messages: list[dict],
    risk_level: str = "low",
    live_context: str = "",
    conversation_context: str = "",
) -> str | None:
    """
    Call Azure OpenAI and return the assistant reply.
    Returns None if Azure is not configured or the call fails.
    """
    if not is_configured():
        return None

    url = f"{ENDPOINT}/openai/deployments/{DEPLOYMENT}/chat/completions?api-version={API_VERSION}"

    # Build system prompt with live context injected
    system_content = SYSTEM_PROMPT
    if live_context:
        system_content += f"\n\n{live_context}"
    if conversation_context:
        system_content += f"\n\n{conversation_context}"

    payload_messages = [{"role": "system", "content": system_content}] + messages

    # If high risk, add a system reminder
    if risk_level == "high":
        payload_messages.append({
            "role": "system",
            "content": "ALERT: The risk engine has flagged this conversation as HIGH RISK. Immediately surface crisis resources. Ask if the person is safe and whether anyone is with them. Do not attempt clinical intervention — your role is to hold space and connect them to emergency services or Lifeline.",
        })

    body = json.dumps({
        "messages": payload_messages,
        "max_tokens": 200,
        "temperature": 0.7,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "api-key": API_KEY,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read())
            return data["choices"][0]["message"]["content"].strip()
    except (urllib.error.URLError, KeyError, json.JSONDecodeError):
        return None
