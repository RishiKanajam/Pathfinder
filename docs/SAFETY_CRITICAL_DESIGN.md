# Safety-Critical Design

PathFinder handles suicide-prevention and mental-health intake. This document describes the design decisions that make it safe to operate, the escalation protocol, and the guardrails that constrain the AI layer.

> **First, the disclaimer that governs everything below.** PathFinder is a triage and routing prototype. It is not a crisis service, a diagnostic tool, or a replacement for a trained human responder. If you or someone you know is in crisis, contact **000** (emergencies) or **Lifeline 13 11 14**.

---

## Design principles

These six principles are the reason the system is shaped the way it is. Every architectural decision traces back to one of them.

1. **The AI is the bridge, not the destination.** PathFinder connects a person to human support. It never attempts to be therapy, and it is explicitly instructed never to try to "talk someone down" — that is the work of trained humans.
2. **Err on the side of alarm.** Borderline cases round *up*, not down. A false positive costs a staff member a few minutes; a false negative is unacceptable. This is enforced mechanically (see Risk assessment below), not left to a model's judgement.
3. **Crisis resources survive everything.** Lifeline 13 11 14 and 000 are present in static markup and shown regardless of backend or AI availability. If every server-side component fails, the person still sees where to get help.
4. **No dead ends.** The AI never closes a conversation first. Every exit path surfaces crisis resources.
5. **Transparency over false comfort.** The assistant identifies itself as AI and does not promise confidentiality it cannot guarantee.
6. **The system fails, not the person.** Every escalation is written to an append-only audit log. When a notification path fails, that failure is recorded and reviewed — the burden is on the system to improve, never on the person who reached out.

---

## The separation that makes it safe

The single most important structural decision is that **the safety-critical layer does not depend on an LLM.**

- **Risk scoring** (`backend/app/ai/risk_engine.py`) is pure Python — keyword matching, emotion detection, urgency and linguistic markers. No network call, no model inference.
- **Escalation** (`backend/app/routers/escalations.py`, `backend/app/store.py`) is deterministic state tracking.
- **Program matching** (`backend/app/ai/program_matcher.py`) is local scoring against a fixed program list.

The LLM is used *only* to phrase conversational replies, and it sits behind a fallback chain (OpenAI → Azure AI Services → rule-based). If the model is slow, wrong, or entirely unavailable, risk detection and escalation are unaffected. A black-box model never decides whether someone is at risk.

---

## Risk assessment

Every inbound message is scored locally and classified into one of three tiers:

| Tier | Score | Meaning |
|------|-------|---------|
| HIGH | ≥ 0.72 | Immediate intent, active crisis language, imminent danger |
| MEDIUM | 0.36 – 0.71 | Hopelessness, isolation, general distress, risk factors |
| LOW | < 0.36 | Support-seeking, education requests, preventive care |

Signals combined into the score:

- **Crisis keywords** — `HIGH_RISK_KEYWORDS` and `MEDIUM_RISK_KEYWORDS`. The critical rule: **any single high-risk keyword forces the score to at least 0.72**, guaranteeing a HIGH classification. Multiple high-risk keywords raise confidence further. This is principle 2 made mechanical.
- **Emotion detection** — six emotions (sadness, fear, anger, hopelessness, stress, joy) scored by keyword presence.
- **Urgency markers** — immediate/urgent/today language.
- **Linguistic markers** — absolutist words (always, never, no one) and farewell phrases (goodbye, this is the end), which are known correlates of acute risk.

Because the mechanism is rule-based and visible, staff can audit *why* any given message was scored HIGH — the flags are attached to the assessment.

---

## Multi-layer escalation — the "Never Alone" design

When a HIGH classification fires, escalation begins and is tracked as an `EscalationLog` record with per-layer timestamps.

```
LAYER 1 (0s):    Crisis resources shown to the person (000, Lifeline 13 11 14, NSW MHL, 13YARN)
LAYER 2 (0s):    Alert on-call staff + CEO across notification channels
LAYER 3 (5m):    If unacknowledged, re-alert all staff and escalate urgency
LAYER 4 (15m):   If still unacknowledged, escalate to CEO and log as SYSTEM FAILURE
LAYER 5 (exit):  On conversation end, show exit resources and schedule follow-up
```

**The core property:** if a layer is not acknowledged, the next layer activates automatically. A failed or ignored notification advances escalation rather than silently dropping it. Acknowledgement is an explicit action a staff member takes (`POST /api/escalations/{id}/acknowledge`), which records who responded and the response time measured from the Layer 2 timestamp.

Layer 4 marks the record `is_system_failure = true` and `post_incident_review_required = true`. A person going unacknowledged for 15 minutes is treated as a failure *of the system* to be reviewed, per principle 6.

---

## Notification channels

Alerts are availability-based and multi-channel, ordered so that reliability increases as the channel escalates (`backend/app/routers/notifications.py`):

1. **Web Push** — to on-call staff browsers; works in the background, respects silent mode.
2. **SMS** — to on-call staff phones (via Twilio); reliable, respects silent mode.
3. **Phone call** — to on-call staff (via Twilio); **deliberately bypasses silent mode** so it rings regardless.

Only on-call staff receive routine alerts. For HIGH risk, staff flagged `can_handle_high_risk` and the CEO are always included. Twilio and VAPID (Web Push) credentials are supplied via environment variables and are never committed.

---

## Staff assignment

Routing respects training level — higher risk goes to more qualified responders:

| Risk | Assigned to | Training |
|------|-------------|----------|
| HIGH | Kara Thomson (Psychologist) or Teyarnee (peer worker + suicide prevention) | Clinical supervision |
| MEDIUM | Teyarnee or Cameron (support worker) | Intermediate mental-health training |
| LOW | Jane (community engagement) or volunteers | Basic mental-health literacy |

---

## Conversation guardrails

The AI reply layer operates under a system prompt with hard rules (`backend/app/ai/azure_openai.py`). Among them:

- Identify as an AI support guide — never a therapist, counsellor, or friend.
- Never diagnose or label ("you have depression").
- Never claim to understand how the person feels.
- Never deliver therapy or clinical intervention.
- Never end the conversation or say goodbye first.
- On immediate danger, direct the person to call 000 and Lifeline 13 11 14.
- Keep replies short and specific to what the person just said; do not loop the same phrase.

These guardrails shape *wording only*. They do not participate in the risk decision, which is made upstream and independently.

---

## System resilience

Resilience is layered so that failure at any single point degrades gracefully rather than catastrophically:

- **AI provider down** → fallback chain moves OpenAI → Azure → rule-based canned replies. Conversation continues.
- **Backend down** → static crisis resources still render (principle 3).
- **Notification channel fails** → next escalation layer activates (the "Never Alone" property).
- **No acknowledgement** → escalation self-advances and eventually logs a system failure for review.

---

## What PathFinder does NOT do

- Deliver therapy or clinical treatment
- Provide medical or diagnostic advice
- Substitute for crisis lines (000, Lifeline)
- Replace trained crisis counsellors
- Create parasocial attachment (the "Replika trap")
- Promise confidentiality it can't guarantee
- Attempt to "talk someone down"
- End conversations first

---

## Status

Prototype, built for the LMNSPN NGM Group Hackathon (May 2026). Production deployment of a safety-critical system requires clinical governance, legal and privacy review, a persistent and secured datastore, and regulatory compliance beyond the scope of this prototype.
