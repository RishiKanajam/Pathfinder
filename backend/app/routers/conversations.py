"""
Conversations router — staff-only.
Provides live conversation data with per-message risk metadata.
Users never call this; it's consumed by the staff LiveMonitor.
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime

from app import store
from app.ai.risk_engine import assess_risk

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def _enrich_message(msg: dict) -> dict:
    """Add risk metadata to a single message (staff-only view)."""
    if msg["role"] != "client":
        return {**msg, "risk": None}
    assessment = assess_risk(msg["content"])
    return {
        **msg,
        "risk": {
            "level": assessment.level,
            "score": assessment.score,
            "flags": assessment.flags[:3],   # top 3 flags only
            "emotions": {k: v for k, v in assessment.emotions.items() if v > 0.1},
        },
    }


def _conversation_summary(conv: dict) -> dict:
    """Summarise a conversation for the monitor list view."""
    messages = conv.get("messages", [])
    client_messages = [m for m in messages if m["role"] == "client"]

    # Compute peak risk across all client messages
    peak_score = 0.0
    peak_level = "low"
    for m in client_messages:
        a = assess_risk(m["content"])
        if a.score > peak_score:
            peak_score = a.score
            peak_level = a.level

    # Latest message timestamp
    latest_ts = messages[-1]["created_at"] if messages else conv.get("started_at", "")

    # Latest client message snippet
    last_client = next((m["content"] for m in reversed(messages) if m["role"] == "client"), "")

    return {
        "id": conv["id"],
        "referral_id": conv.get("referral_id"),
        "channel": conv.get("channel", "chat"),
        "is_after_hours": conv.get("is_after_hours", False),
        "message_count": len(messages),
        "client_message_count": len(client_messages),
        "peak_risk_level": peak_level,
        "peak_risk_score": round(peak_score, 2),
        "latest_message_at": latest_ts,
        "last_client_snippet": last_client[:120] + ("…" if len(last_client) > 120 else ""),
        "risk_escalated": conv.get("risk_escalated", peak_level == "high"),
        "staff_took_over": conv.get("staff_took_over", False),
    }


@router.get("")
def list_conversations():
    """
    List all conversations with summary risk data.
    Staff-only: never exposed to the public portal.
    """
    return [_conversation_summary(c) for c in store.CONVERSATIONS]


@router.get("/{conversation_id}")
def get_conversation(conversation_id: int):
    """
    Full conversation detail with per-message risk analysis.
    Staff-only.
    """
    conv = next((c for c in store.CONVERSATIONS if c["id"] == conversation_id), None)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    enriched_messages = [_enrich_message(m) for m in conv.get("messages", [])]

    # Build risk timeline: one entry per client message
    risk_timeline = [
        {
            "index": i,
            "content_snippet": m["content"][:60] + ("…" if len(m["content"]) > 60 else ""),
            "risk_level": m["risk"]["level"],
            "risk_score": m["risk"]["score"],
            "ts": m["created_at"],
        }
        for i, m in enumerate(enriched_messages)
        if m["role"] == "client" and m["risk"]
    ]

    # Compute overall peak risk
    peak = max((m["risk"]["score"] for m in enriched_messages if m["risk"]), default=0.0)
    peak_level = "high" if peak >= 0.72 else "medium" if peak >= 0.36 else "low"

    return {
        **conv,
        "messages": enriched_messages,
        "risk_timeline": risk_timeline,
        "peak_risk_score": round(peak, 2),
        "peak_risk_level": peak_level,
    }


@router.post("/{conversation_id}/staff-takeover")
def staff_takeover(conversation_id: int, staff_id: int, message: str):
    """
    Staff sends a message directly into an active conversation.
    Marks the conversation as staff_took_over.
    """
    conv = next((c for c in store.CONVERSATIONS if c["id"] == conversation_id), None)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    staff_member = next((s for s in store.STAFF if s["id"] == staff_id), None)
    name = staff_member["name"] if staff_member else "Staff"

    conv["staff_took_over"] = True
    conv["messages"].append({
        "role": "staff",
        "staff_id": staff_id,
        "staff_name": name,
        "content": message,
        "created_at": datetime.now().isoformat(timespec="seconds"),
    })

    store.log_audit_event("conversation", staff_id, "STAFF_TAKEOVER", conversation_id, {
        "message_preview": message[:80],
    })

    return {"status": "sent", "conversation_id": conversation_id, "staff": name}
