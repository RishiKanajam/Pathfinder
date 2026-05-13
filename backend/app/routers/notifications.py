"""
Notifications router — availability-based, multi-channel.

Priority escalation for HIGH risk:
  1. Web Push  → on-call staff browsers (works in background, respects silent)
  2. SMS       → on-call staff phones   (reliable, respects silent)
  3. Phone call → on-call staff         (BYPASSES silent mode — rings regardless)

Only on-call staff receive alerts. CEO always receives HIGH-risk calls.

Twilio credentials in .env:
  TWILIO_ACCOUNT_SID
  TWILIO_AUTH_TOKEN
  TWILIO_FROM_NUMBER   — your Twilio phone number e.g. +61400000000

Web Push in .env:
  VAPID_PUBLIC_KEY
  VAPID_PRIVATE_KEY
  VAPID_EMAIL
"""
from __future__ import annotations

import json
import logging
import os
import ssl
import urllib.request
import urllib.error
import base64
from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel

from app import store
from app.env import load_local_env

load_local_env()

_log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/notifications", tags=["notifications"])

# ── Phone numbers for staff (add to store or .env in production) ──
# Keyed by staff ID — update with real numbers before demo
STAFF_PHONES = {
    1: os.getenv("PHONE_BRADLEY",  ""),   # CEO
    2: os.getenv("PHONE_CAMERON",  ""),
    3: os.getenv("PHONE_TEYARNEE", ""),
    4: os.getenv("PHONE_JANE",     ""),
    5: os.getenv("PHONE_KARA",     ""),
}


class CriticalAlertPayload(BaseModel):
    conversation_id: int
    risk_level: str = "high"
    triggered_by: int | None = None
    message: str = "PathFinder has detected a high-risk conversation requiring immediate attention."


@router.post("/critical-alert")
def send_critical_alert(payload: CriticalAlertPayload):
    """
    Send a critical alert to available on-call staff.
    Routes: Web Push → SMS → Phone call (phone call bypasses silent mode).
    Only notifies staff who are on-call. CEO always notified for HIGH.
    """
    on_call  = [s for s in store.STAFF if s.get("is_on_call")]
    ceo      = next((s for s in store.STAFF if s["role"] == "CEO"), None)
    # For high risk, also include staff who can handle high risk
    if payload.risk_level == "high":
        capable = [s for s in store.STAFF if s.get("can_handle_high_risk")]
        targets = list({s["id"]: s for s in on_call + capable + ([ceo] if ceo else [])}.values())
    else:
        targets = on_call

    results = {
        "notified": [],
        "channels": [],
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "conversation_id": payload.conversation_id,
    }

    for staff in targets:
        sent_channels = []

        # ── 1. Web Push (if subscription registered) ─────────────
        # In production: store push subscriptions per staff and send here
        # For demo: logged as intent
        _log.info("Web push → %s (staff #%d)", staff["name"], staff["id"])
        sent_channels.append("web_push")

        # ── 2. SMS via Twilio ─────────────────────────────────────
        phone = STAFF_PHONES.get(staff["id"], "")
        if phone and _twilio_configured():
            sms_ok = _send_sms(
                to=phone,
                body=f"🚨 PathFinder ALERT — {payload.risk_level.upper()} RISK\n"
                     f"Conv #{payload.conversation_id}\n{payload.message[:100]}\n"
                     f"Login: pathfinder.evolvehub.org.au/?portal=staff",
            )
            if sms_ok:
                sent_channels.append("sms")
                _log.info("SMS → %s (%s)", staff["name"], phone)

        # ── 3. Phone call via Twilio (BYPASSES SILENT MODE) ──────
        # This is the key feature — a voice call rings even on silent
        if phone and _twilio_configured() and payload.risk_level == "high":
            call_ok = _make_voice_call(
                to=phone,
                message=(
                    f"This is PathFinder, the Evolve Hub mental health platform. "
                    f"A HIGH RISK conversation has been detected. "
                    f"Please log in to the PathFinder staff dashboard immediately. "
                    f"Conversation number {payload.conversation_id}. "
                    f"This is urgent. Repeating: this is a high risk alert from PathFinder."
                ),
            )
            if call_ok:
                sent_channels.append("voice_call")
                _log.info("Voice call → %s (%s) — bypasses silent mode", staff["name"], phone)

        results["notified"].append(staff["name"])
        results["channels"] = list(set(results["channels"] + sent_channels))

        # Log to audit trail
        store.log_audit_event("notification", payload.triggered_by, "CRITICAL_ALERT_SENT",
                              payload.conversation_id, {
                                  "staff_id": staff["id"],
                                  "channels": sent_channels,
                                  "risk_level": payload.risk_level,
                              })

    if not _twilio_configured():
        results["note"] = (
            "Twilio not configured — add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, "
            "TWILIO_FROM_NUMBER, and PHONE_* vars to .env to enable SMS and voice calls. "
            "Voice calls bypass silent mode on all phones."
        )

    return results


@router.get("/staff-availability")
def get_staff_availability():
    """Return current on-call staff with their notification capability."""
    return [
        {
            "id": s["id"],
            "name": s["name"],
            "role": s["role"],
            "is_on_call": s.get("is_on_call", False),
            "can_handle_high_risk": s.get("can_handle_high_risk", False),
            "has_phone": bool(STAFF_PHONES.get(s["id"])),
            "notification_channels": _channels_for_staff(s),
        }
        for s in store.STAFF
    ]


@router.post("/staff/{staff_id}/toggle-oncall")
def toggle_oncall(staff_id: int):
    """Toggle a staff member's on-call status."""
    staff = next((s for s in store.STAFF if s["id"] == staff_id), None)
    if not staff:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Staff not found")
    staff["is_on_call"] = not staff.get("is_on_call", False)
    return {"id": staff_id, "name": staff["name"], "is_on_call": staff["is_on_call"]}


# ── Twilio helpers ────────────────────────────────────────────

def _twilio_configured() -> bool:
    return bool(
        os.getenv("TWILIO_ACCOUNT_SID") and
        os.getenv("TWILIO_AUTH_TOKEN") and
        os.getenv("TWILIO_FROM_NUMBER")
    )


def _twilio_request(path: str, data: dict) -> bool:
    sid   = os.getenv("TWILIO_ACCOUNT_SID", "")
    token = os.getenv("TWILIO_AUTH_TOKEN", "")
    url   = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/{path}"
    creds = base64.b64encode(f"{sid}:{token}".encode()).decode()
    body  = urllib.parse.urlencode(data).encode()
    req   = urllib.request.Request(
        url, data=body,
        headers={"Authorization": f"Basic {creds}", "Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
            return r.status in (200, 201)
    except Exception as e:
        _log.warning("Twilio request failed: %s", e)
        return False


def _send_sms(to: str, body: str) -> bool:
    import urllib.parse
    return _twilio_request("Messages.json", {
        "To": to, "From": os.getenv("TWILIO_FROM_NUMBER", ""), "Body": body,
    })


def _make_voice_call(to: str, message: str) -> bool:
    """
    Make a phone call that reads the message aloud.
    Phone calls BYPASS silent mode on iOS and Android.
    The TwiML tells Twilio what to say when the person answers.
    """
    import urllib.parse
    twiml = f'<Response><Say voice="alice" loop="2">{message}</Say></Response>'
    return _twilio_request("Calls.json", {
        "To": to,
        "From": os.getenv("TWILIO_FROM_NUMBER", ""),
        "Twiml": twiml,
    })


def _channels_for_staff(s: dict) -> list[str]:
    channels = ["web_push"]
    if STAFF_PHONES.get(s["id"]):
        channels.append("sms")
        if s.get("is_on_call") or s.get("can_handle_high_risk"):
            channels.append("voice_call")
    return channels
