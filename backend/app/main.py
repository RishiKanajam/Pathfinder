from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.env import load_local_env

load_local_env()

from app.routers import analytics, chat, conversations, notifications, programs, referrals, escalations

app = FastAPI(title="PathFinder API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(referrals.router)
app.include_router(chat.router)
app.include_router(analytics.router)
app.include_router(programs.router)
app.include_router(escalations.router)
app.include_router(conversations.router)
app.include_router(notifications.router)


@app.get("/api/health")
def health():
    from app.ai.azure_openai import _env
    from app.store import REFERRALS, PROGRAMS, STAFF
    cfg = _env()

    azure_ready  = bool(cfg["endpoint"] and cfg["key"])
    openai_ready = bool(cfg["oai_key"])
    endpoint_type = (
        "ai-services"   if "services.ai.azure.com" in cfg["endpoint"] else
        "foundry-v1"    if "/v1" in cfg["endpoint"] else
        "classic-openai" if cfg["endpoint"] else "none"
    )
    ai_source = (
        f"azure/{endpoint_type}" if azure_ready  else
        "openai"                  if openai_ready else
        "rule-based-fallback"
    )
    return {
        "status":       "ok",
        "service":      "PathFinder API",
        "ai_chat":      ai_source,
        "azure_endpoint": cfg["endpoint"] or "not set",
        "azure_deployment": cfg["deployment"],
        "openai_key_set": bool(cfg["oai_key"]),
        "referrals":    len(REFERRALS),
        "programs":     len(PROGRAMS),
        "staff":        len(STAFF),
    }


@app.post("/api/transcribe")
async def transcribe_audio(request: Request):
    """
    Accept raw audio from the browser mic button and return transcribed text.
    Frontend POSTs multipart or raw audio bytes.
    """
    from app.ai.azure_speech import transcribe
    from fastapi import Request as Req
    body = await request.body()
    content_type = request.headers.get("content-type", "audio/webm")
    if not body:
        return {"error": "No audio data received"}
    result = transcribe(body, content_type)
    if result:
        return result
    return {"text": "", "error": "Transcription unavailable — check Azure Whisper deployment"}


# FastAPI Request import needed above
from fastapi import Request  # noqa: E402 (after app definition is fine)


@app.post("/api/tts")
async def text_to_speech(request: Request):
    """
    Convert AI reply text to speech via OpenAI TTS.
    Returns audio/mpeg for the browser to play back.
    """
    import json, os, ssl, urllib.request
    try:
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ctx = ssl.create_default_context()

    from app.env import load_local_env
    load_local_env()
    oai_key = os.getenv("OPENAI_API_KEY", "")
    if not oai_key:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="TTS not available")

    body = await request.json()
    text = (body.get("text") or "")[:600].strip()
    if not text:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No text provided")

    payload = json.dumps({"model": "tts-1", "input": text, "voice": "shimmer", "response_format": "mp3"}).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/speech",
        data=payload,
        headers={"Authorization": f"Bearer {oai_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
            audio = r.read()
        from fastapi.responses import Response
        return Response(content=audio, media_type="audio/mpeg")
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail=f"TTS failed: {e}")
