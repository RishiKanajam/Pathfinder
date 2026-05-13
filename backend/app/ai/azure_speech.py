"""
Voice transcription via Azure AI Foundry — Whisper model.

Accepts raw audio bytes (webm/ogg/wav/mp3) from the browser mic.
Returns transcribed text + basic voice metrics proxy.

Falls back gracefully if Azure not configured.
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


def _cfg() -> dict:
    from app.env import load_local_env
    load_local_env()
    return {
        "endpoint":   os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/"),
        "key":        os.getenv("AZURE_OPENAI_KEY", ""),
        "whisper":    os.getenv("AZURE_WHISPER_DEPLOYMENT", "gpt-4o-transcribe"),
        "api_ver":    os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21"),
        "oai_key":    os.getenv("OPENAI_API_KEY", ""),
    }


def transcribe(audio_bytes: bytes, content_type: str = "audio/webm") -> dict | None:
    """
    Transcribe audio via Whisper. Returns:
      { "text": str, "language": str, "duration": float }
    or None on failure.

    content_type examples: "audio/webm", "audio/wav", "audio/ogg", "audio/mpeg"
    """
    cfg = _cfg()
    # Strip codec suffix e.g. "audio/webm;codecs=opus" → "audio/webm"
    base_ct = content_type.split(";")[0].strip()
    ext_map = {
        "audio/webm": "webm",
        "audio/wav":  "wav",
        "audio/ogg":  "ogg",
        "audio/mpeg": "mp3",
        "audio/mp4":  "mp4",
    }
    ext = ext_map.get(base_ct, "webm")

    # Multipart form-data body
    boundary = "----PathFinderAudioBoundary"
    body_parts = [
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"audio.{ext}\"\r\nContent-Type: {content_type}\r\n\r\n".encode(),
        audio_bytes,
        f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\nwhisper-1\r\n".encode(),
        f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"response_format\"\r\n\r\njson\r\n".encode(),
        f"\r\n--{boundary}--\r\n".encode(),
    ]
    body = b"".join(body_parts)

    # Azure Whisper/gpt-4o-transcribe not available in australiaeast — skip to OpenAI directly
    # Try OpenAI Whisper (always active when OPENAI_API_KEY is set)
    if cfg["oai_key"]:
        url = "https://api.openai.com/v1/audio/transcriptions"
        headers = {
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Authorization": f"Bearer {cfg['oai_key']}",
        }
        result = _post_multipart(url, headers, body)
        if result:
            return result

    return None


def _post_multipart(url: str, headers: dict, body: bytes) -> dict | None:
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30, context=_SSL_CTX) as r:
            data = json.loads(r.read())
            return {
                "text":     data.get("text", "").strip(),
                "language": data.get("language", "en"),
                "duration": data.get("duration", 0.0),
                "words":    data.get("words", []),
            }
    except urllib.error.HTTPError as e:
        _log.warning("Whisper HTTP %s: %s", e.code, e.read().decode()[:200])
    except Exception as ex:
        _log.warning("Whisper failed: %s", ex)
    return None
