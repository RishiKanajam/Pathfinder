import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app import store
from app.schemas import ChatMessage
from app.ai import azure_openai
from app.ai.risk_engine import assess_risk

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _build_history(conversation_id: int | None, limit: int = 20) -> list[dict]:
    if conversation_id is None:
        return []
    conv = next((c for c in store.CONVERSATIONS if c["id"] == conversation_id), None)
    if not conv:
        return []
    out = []
    for m in conv["messages"][-limit:]:
        if m["role"] == "client":
            out.append({"role": "user",      "content": m["content"]})
        elif m["role"] in ("ai", "assistant"):
            out.append({"role": "assistant", "content": m["content"]})
    return out


def _peak_assessment(conversation_id: int | None, current):
    """If any prior message in this conversation was HIGH, keep that level."""
    if conversation_id is None:
        return current
    conv = next((c for c in store.CONVERSATIONS if c["id"] == conversation_id), None)
    if not conv:
        return current
    for m in conv["messages"]:
        if m["role"] == "client":
            a = assess_risk(m["content"])
            if a.level == "high":
                return a
    return current


@router.post("")
def chat(payload: ChatMessage):
    """Standard non-streaming endpoint (used as fallback)."""
    assessment = _peak_assessment(payload.conversation_id, assess_risk(payload.message))
    history    = _build_history(payload.conversation_id)
    history.append({"role": "user", "content": payload.message})
    ai_reply   = azure_openai.chat(history, risk_level=assessment.level)
    return store.create_chat_turn(payload.message, payload.conversation_id, ai_reply=ai_reply)


@router.post("/stream")
async def chat_stream(payload: ChatMessage):
    """
    Server-Sent Events streaming — ChatGPT-style word-by-word delivery.
    Sends three event types:
      data: {"delta": "word "}          — text token
      data: {"meta": {...}}             — risk, matches, conversation_id (sent first)
      data: [DONE]                      — stream finished
    """
    message         = payload.message
    conversation_id = payload.conversation_id
    assessment      = _peak_assessment(conversation_id, assess_risk(message))
    history         = _build_history(conversation_id)
    history.append({"role": "user", "content": message})

    # Run program matching for meta event
    from app.ai.program_matcher import match_programs
    from app.store import PROGRAMS
    matches = match_programs(message, PROGRAMS, limit=3)

    collected: list[str] = []

    async def generate():
        import os, ssl, certifi, urllib.request, urllib.error

        try:
            ctx = ssl.create_default_context(cafile=certifi.where())
        except Exception:
            ctx = ssl.create_default_context()

        cfg       = azure_openai._env()
        oai_key   = cfg["oai_key"]
        oai_model = cfg["oai_model"]

        # ── Send metadata first (risk, matches, conversation_id) ─
        # conversation_id will be updated after turn is saved
        meta = {
            "risk":    {"level": assessment.level, "score": assessment.score, "flags": assessment.flags[:3]},
            "matches": [m.__dict__ for m in matches],
        }
        yield f"data: {json.dumps({'meta': meta})}\n\n"

        # ── Build prompt ─────────────────────────────────────────
        sys_msgs = [{"role": "system", "content": azure_openai.SYSTEM_PROMPT}]
        if assessment.level == "high":
            sys_msgs.append({
                "role": "system",
                "content": (
                    "ALERT: HIGH RISK — surface crisis numbers immediately. "
                    "Ask if person is safe and whether anyone is with them. Hold space."
                ),
            })
        full_msgs = sys_msgs + history

        streamed = False

        # ── 1. Try OpenAI streaming ───────────────────────────────
        if oai_key:
            token_key = "max_completion_tokens" if any(
                oai_model.startswith(p) for p in ("gpt-5", "o1", "o3", "o4")
            ) else "max_tokens"
            no_temp = any(oai_model.startswith(p) for p in ("o1", "o3", "o4", "gpt-5"))
            body: dict = {"model": oai_model, "messages": full_msgs, "stream": True, token_key: 300}
            if not no_temp:
                body["temperature"] = 0.82

            req = urllib.request.Request(
                "https://api.openai.com/v1/chat/completions",
                data=json.dumps(body).encode(),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {oai_key}",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
                    buf = b""
                    while True:
                        chunk = resp.read(256)
                        if not chunk:
                            break
                        buf += chunk
                        while b"\n" in buf:
                            line, buf = buf.split(b"\n", 1)
                            line = line.strip()
                            if line == b"data: [DONE]":
                                break
                            if line.startswith(b"data: "):
                                try:
                                    d = json.loads(line[6:])
                                    delta = d["choices"][0]["delta"].get("content", "")
                                    if delta:
                                        collected.append(delta)
                                        streamed = True
                                        yield f"data: {json.dumps({'delta': delta})}\n\n"
                                except (json.JSONDecodeError, KeyError, IndexError):
                                    pass
            except Exception as e:
                pass  # fall through to non-streaming

        # ── 2. Non-streaming fallback (Azure or rule-based) ───────
        if not streamed:
            reply = azure_openai.chat(history, risk_level=assessment.level)
            if not reply:
                from app.store import _fallback_chat_reply
                reply = _fallback_chat_reply(message, assessment)
            collected.append(reply)
            # Emit word-by-word to simulate streaming
            for word in reply.split(" "):
                yield f"data: {json.dumps({'delta': word + ' '})}\n\n"

        # ── Save the turn and send final conv_id ──────────────────
        full_reply = "".join(collected).strip()
        turn = store.create_chat_turn(message, conversation_id, ai_reply=full_reply)
        yield f"data: {json.dumps({'conv_id': turn['conversation_id'], 'escalation': turn.get('escalation')})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
