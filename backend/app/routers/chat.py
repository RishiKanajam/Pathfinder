from datetime import datetime
from fastapi import APIRouter

from app import store
from app.schemas import ChatMessage
from app.ai import azure_openai
from app.ai.risk_engine import assess_risk

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _build_live_context() -> str:
    """Inject real-time state: clock, on-call staff, program availability."""
    now = datetime.now()
    is_ah = store.is_after_hours()
    time_str = now.strftime("%A %d %B, %I:%M %p")
    hours_label = "AFTER HOURS (outside 9am–5pm)" if is_ah else "business hours (9am–5pm)"

    on_call = [s["name"] for s in store.STAFF if s.get("is_on_call")]
    on_call_str = ", ".join(on_call) if on_call else "no staff currently on call"

    available = sorted(
        [p for p in store.PROGRAMS if p["current_load"] < p["capacity"]],
        key=lambda p: p["capacity"] - p["current_load"],
        reverse=True,
    )
    prog_lines = "\n".join(
        f"  • {p['name']} ({p['provider']}): "
        f"{p['capacity'] - p['current_load']} spots available — {p['description']}"
        for p in available[:6]
    )

    after_hours_note = (
        "It is currently after hours. Reassure the person that an Evolve Hub team member "
        "will follow up with them first thing in the morning. Emphasise that Lifeline "
        "(13 11 14) is available right now, 24/7."
        if is_ah else
        "The Evolve Hub is open. Staff can be reached on 02 4096 1100 today."
    )

    return (
        f"[LIVE SYSTEM CONTEXT — {time_str}]\n"
        f"Status: {hours_label}\n"
        f"On-call staff right now: {on_call_str}\n"
        f"Programs with available capacity (use these exact names when suggesting support):\n"
        f"{prog_lines}\n"
        f"{after_hours_note}"
    )


def _build_conversation_context(conversation_id: int | None) -> str:
    """Summarise cumulative themes and emotions from the whole conversation so far."""
    if conversation_id is None:
        return ""
    conv = next((c for c in store.CONVERSATIONS if c["id"] == conversation_id), None)
    if not conv:
        return ""
    client_msgs = [m["content"] for m in conv["messages"] if m["role"] == "client"]
    if len(client_msgs) < 2:
        return ""

    full = assess_risk(" ".join(client_msgs))
    parts = []
    if full.flags:
        parts.append(f"Themes raised so far: {', '.join(full.flags)}")
    emotions = {k: v for k, v in (full.emotions or {}).items() if v > 0.4}
    if emotions:
        parts.append(
            "Emotional signals: "
            + ", ".join(f"{k} ({v:.0%})" for k, v in emotions.items())
        )
    if not parts:
        return ""

    return (
        f"\n[CONVERSATION MEMORY — {len(client_msgs)} turns in]\n"
        + "\n".join(parts)
        + f"\nOverall conversation risk so far: {full.level}. "
        "Reference what the person has already shared rather than asking them to repeat themselves."
    )


_RISK_ORDER = {"low": 0, "medium": 1, "high": 2}


def _peak_risk(conversation_id: int | None) -> str:
    """Return the highest risk level seen so far in this conversation."""
    if conversation_id is None:
        return "low"
    conv = next((c for c in store.CONVERSATIONS if c["id"] == conversation_id), None)
    return conv.get("peak_risk_level", "low") if conv else "low"


@router.post("")
def chat(payload: ChatMessage):
    message = payload.message
    conversation_id = payload.conversation_id

    assessment = assess_risk(message)

    # Never let risk drop mid-conversation — elevate to the peak seen so far
    peak = _peak_risk(conversation_id)
    if _RISK_ORDER.get(peak, 0) > _RISK_ORDER.get(assessment.level, 0):
        assessment.level = peak
        assessment.escalation_required = (peak == "high")

    history = []
    if conversation_id is not None:
        conv = next((c for c in store.CONVERSATIONS if c["id"] == conversation_id), None)
        if conv:
            for m in conv["messages"][-10:]:
                role = "user" if m["role"] == "client" else "assistant"
                history.append({"role": role, "content": m["content"]})

    history.append({"role": "user", "content": message})

    ai_reply = azure_openai.chat(
        history,
        risk_level=assessment.level,
        live_context=_build_live_context(),
        conversation_context=_build_conversation_context(conversation_id),
    )

    return store.create_chat_turn(message, conversation_id, ai_reply=ai_reply)
