# Deployment

How to configure and run PathFinder beyond the local demo. This document is written for the current prototype; items that must be built before genuine production use are marked **[required for production]**.

> PathFinder is a safety-critical system. Do not deploy it to handle real people in crisis without clinical oversight, legal and privacy review, and the production-readiness items below.

---

## Environment variables

All configuration is supplied via environment variables (loaded by `backend/app/env.py`). Never commit real values — use `.env` locally and a secrets manager in production. A `.env.example` documents the keys.

**AI chat (reply layer).** The chain tries OpenAI first, then Azure AI Services, then a rule-based fallback.

```
# OpenAI (primary)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# Azure AI Services (fallback)
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-oss-120b
AZURE_OPENAI_API_VERSION=2024-05-01-preview
```

If none are set, the system runs on rule-based replies — degraded but functional. Voice transcription (`/api/transcribe`) and text-to-speech (`/api/tts`) use OpenAI (Whisper and TTS) and require `OPENAI_API_KEY`.

**Notifications (Twilio — SMS and phone call).**

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=      # e.g. +61400000000
```

**Notifications (Web Push — VAPID).**

```
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=
```

**Staff phone numbers** (keyed to seeded staff IDs; move to the datastore for production):

```
PHONE_BRADLEY=
PHONE_CAMERON=
PHONE_TEYARNEE=
PHONE_JANE=
PHONE_KARA=
```

**Deployment checklist for credentials:** verify AI keys, Twilio credentials, VAPID keys, and staff phone numbers are all set *before* going live. A channel with missing credentials is silently skipped — in a fully unconfigured environment, no external alert reaches staff. This is the single most important pre-launch check.

---

## Production server configuration

- Run the API behind a production ASGI server (e.g. `uvicorn` workers managed by a process supervisor, or `gunicorn` with uvicorn workers) rather than `--reload`.
- Terminate TLS at a reverse proxy (nginx/Caddy) in front of the app. All traffic must be HTTPS — this is health data.
- Tighten CORS. The prototype allows only local dev origins in `app.main`; set the real frontend origin for production and remove localhost.
- Build the frontend (`npm --prefix frontend run build`) and serve the static assets from the proxy/CDN, not the dev server.
- Ensure crisis-resource static markup is served even if the API is unavailable — it is the last line of resilience.

---

## Database schema and migrations **[required for production]**

The prototype keeps all state in memory (`backend/app/store.py`) — referrals, staff, volunteers, programs, escalations, and the audit log. **This is lost on every restart and is the top blocker for real use.** Before production:

- Introduce a persistent datastore (e.g. PostgreSQL) with tables mirroring the current in-memory structures: referrals, staff, volunteers, programs, escalation logs, audit log entries, conversations.
- Store the **audit log in write-once/append-only storage** so it can withstand legal scrutiny — in-memory append-only is not tamper-evident.
- Add a migration tool (e.g. Alembic) and version the schema.
- Encrypt client data at rest.
- Build a **data-deletion / right-to-be-forgotten workflow** — absent in the prototype, mandatory for handling real personal data.

---

## Staff training requirements

Routing assumes responders are trained to the level of the risk they receive:

| Risk | Responder | Training |
|------|-----------|----------|
| HIGH | Psychologist or suicide-prevention peer worker | Clinical supervision |
| MEDIUM | Support worker | Intermediate mental-health training |
| LOW | Community engagement or volunteers | Basic mental-health literacy |

Before launch, confirm every on-call staff member is trained to handle the risk tier that can be routed to them, and that `can_handle_high_risk` flags reflect real qualifications.

---

## On-call rotation

The escalation model depends on someone actually being on call, especially after hours.

- Maintain an accurate on-call roster; only `is_on_call` staff receive routine alerts, and HIGH always includes high-risk-capable staff plus the CEO.
- Keep staff phone numbers current (they drive the SMS and phone-call channels).
- Use the overnight/after-hours summary (`GET /api/escalations/overnight-summary`) for a morning review of what came in, what went unacknowledged, and any logged system failures.
- Define clearly who covers nights and weekends — the "Never Alone" design only works if a human is reachable at the end of the chain.

---

## Incident response

When an escalation is logged as a **system failure** (Layer 4 — 15 minutes unacknowledged):

1. Treat it as a failure of the system, not the person (design principle 6).
2. Review the append-only audit log for the full escalation timeline — when each layer fired, which channels were attempted, when/whether acknowledgement occurred.
3. Run a blameless post-incident review: why did no one acknowledge in time? Roster gap? Failed channel? Missing credential?
4. Feed fixes back into the roster, credential checks, and escalation timings.

Regularly test the whole notification chain end-to-end (Web Push → SMS → phone call) so a real emergency isn't the first time a channel is exercised.

---

## Pre-launch summary — the must-dos

1. Persistent, encrypted datastore with append-only audit storage **[required for production]**
2. Data-deletion workflow **[required for production]**
3. Minor / mandatory-reporting handling (see EDGE_CASES.md) **[required for production]**
4. All credentials verified (AI, Twilio, VAPID, staff phones)
5. HTTPS everywhere, CORS locked to the real origin
6. Clinical governance and legal/privacy sign-off
7. On-call roster staffed and trained; notification chain tested end-to-end

---

## Status

Prototype, built for the LMNSPN NGM Group Hackathon (May 2026). The items marked **[required for production]** are not optional hardening — they are prerequisites for handling real people safely and lawfully.
