from fastapi import APIRouter

from app import store
from app.schemas import ChatMessage
from app.ai import azure_openai
from app.ai.risk_engine import assess_risk

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("")
def chat(payload: ChatMessage):
    message = payload.message
    conversation_id = payload.conversation_id

    # Run risk assessment first so we can pass risk_level to Azure
    assessment = assess_risk(message)

    # Build conversation history for Azure (last 10 exchanges)
    history = []
    if conversation_id is not None:
        conv = next((c for c in store.CONVERSATIONS if c["id"] == conversation_id), None)
        if conv:
            for m in conv["messages"][-10:]:
                role = "user" if m["role"] == "client" else "assistant"
                history.append({"role": role, "content": m["content"]})

    # Add current message
    history.append({"role": "user", "content": message})

    # Try Azure OpenAI, fall back to rule-based reply
    ai_reply = azure_openai.chat(history, risk_level=assessment.level)

    return store.create_chat_turn(message, conversation_id, ai_reply=ai_reply)
