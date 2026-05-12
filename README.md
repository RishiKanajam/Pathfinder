# PathFinder

**AI-assisted triage and referral platform prototype for the Lake Macquarie & Newcastle Suicide Prevention Network.**

> **Core Principle:** PathFinder is a **triage and routing system**, not a therapy chatbot. The AI is the bridge to human support, not the destination.

---

## What is included

- **24/7 public intake chatbot** with crisis resources, real-time risk assessment, and program suggestions
- **Quick professional referral portal** with source tagging (QR codes, GP referrals, self-referrals)
- **Staff dashboard** with referral priority queue, multi-layer escalation tracking, analytics, and volunteer roster
- **FastAPI backend** with rule-based risk engine and local program matcher
- **Safety-critical design** with multi-layer escalation protocol (LAYER 1–5), system failure tracking, and audit log

---

## How it's different

| Feature | Woebot | Wysa | Crisis Text Line | **PathFinder** |
|---------|--------|------|-----------------|---------------|
| **Real-time staff notification** | ❌ | ❌ | ✅ (human) | ✅ (automated) |
| **Local service matching** | ❌ | ❌ | ❌ | ✅ (14 programs) |
| **Multi-channel escalation** | ❌ | ❌ | Internal | ✅ (email + push + SMS) |
| **Voice + tone analysis** | ❌ | ❌ | ❌ | ✅ |
| **Embedded in local workflow** | ❌ | ❌ | ❌ | ✅ |
| **After-hours bridge** | ❌ | ❌ | ✅ (human) | ✅ (AI → staff) |

See [COMPETITIVE_ANALYSIS.md](docs/COMPETITIVE_ANALYSIS.md) for full comparison.

---

## Run locally

Start the API:

```bash
python3 -m uvicorn app.main:app --reload --app-dir backend
```

Start the frontend:

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

Then open `http://localhost:5173`.

---

## Demo prompts

**For the chatbot (low-risk):**
```
I've been feeling really alone lately. I moved towns and don't know many people.
```

**For the chatbot (high-risk):**
```
I can't do this anymore. I've got pills in my hand right now.
```

**For the referral portal (gaming centre):**
```
A young woman was visibly distressed near the gaming room. She said everything feels pointless and staff are worried she's alone tonight.
```

See [DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) for detailed demo walkthrough.

---

## Safety-Critical Documentation

This repository includes comprehensive safety design:

### Core Documents

- **[SAFETY_CRITICAL_DESIGN.md](docs/SAFETY_CRITICAL_DESIGN.md)** — Multi-layer escalation protocol, design principles, system resilience, conversation guardrails
- **[COMPETITIVE_ANALYSIS.md](docs/COMPETITIVE_ANALYSIS.md)** — Why existing tools fail, PathFinder's differentiators, lessons learned from Replika/ChatGPT failures
- **[EDGE_CASES.md](docs/EDGE_CASES.md)** — Comprehensive catalogue of 35+ edge cases across crisis, AI, referral, technical, and ethical domains
- **[DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)** — Complete demo walkthrough with talking points and Q&A preparation

### Key Safety Principles

1. **"The AI is the bridge, not the destination"** — PathFinder connects people to human support, never tries to be therapy
2. **"Err on the side of alarm"** — Borderline cases escalated, false negatives unacceptable
3. **"Crisis resources survive everything"** — Lifeline 13 11 14 hardcoded in static HTML, works even if backend fails
4. **"No dead ends"** — AI never closes conversation first, every exit shows crisis resources
5. **"Transparency over false comfort"** — AI identifies itself, doesn't promise confidentiality it can't guarantee
6. **"The system fails, not the person"** — Audit trail captures every escalation, post-incident reviews improve process

---

## Multi-Layer Escalation (The "Never Alone" Design)

When high-risk is detected:

```
LAYER 1 (0s):   Crisis resources displayed (000, Lifeline, NSW MHL, 13YARN)
LAYER 2 (0s):   Email + push notification to all on-call staff + CEO
LAYER 3 (5m):   If unacknowledged, re-alert ALL staff + escalate urgency
LAYER 4 (15m):  If still unacknowledged, SMS CEO + log as SYSTEM FAILURE
LAYER 5 (exit): On conversation end, display exit resources + schedule follow-up
```

**Key design:** If notification fails, the next layer activates. The person is never left in silence.

---

## Technical Details

### Risk Assessment

- **HIGH (≥0.72):** Immediate intent, active crisis language, imminent danger
- **MEDIUM (0.36–0.71):** Hopelessness, isolation, general distress, risk factors
- **LOW (<0.36):** Support-seeking, education requests, preventive care

Risk scores use:
- Crisis keyword detection (HIGH_RISK_PATTERNS, MEDIUM_RISK_PATTERNS)
- Emotion analysis (sadness, fear, anger, hopelessness, stress, joy)
- Urgency markers (immediate, urgent, today)
- Sentiment analysis via Azure AI Language

### Staff Assignment

| Risk | Assigned To | Training Required |
|------|-------------|-------------------|
| HIGH | Kara Thomson (Psychologist) or Teyarnee (Peer worker + suicide prevention) | Clinical supervision |
| MEDIUM | Teyarnee or Cameron (Support worker) | Intermediate mental health training |
| LOW | Jane (Community engagement) or volunteers | Basic mental health literacy |

### Data & Privacy

- Client data encrypted at rest
- Audit log is append-only (immutable for legal scrutiny)
- Minimal PII: first name only, no Medicare numbers, no full clinical records
- PathFinder is NOT an electronic health record — it's a triage tool

---

## What PathFinder Does NOT Do

- ❌ Delivers therapy or clinical treatment
- ❌ Provides medical/diagnostic advice
- ❌ Claims to be a substitute for crisis lines (000, Lifeline)
- ❌ Replaces need for trained crisis counsellors
- ❌ Creates parasocial attachment (Replika trap)
- ❌ Makes promises of confidentiality it can't guarantee
- ❌ Tries to "talk someone down" (that's for trained humans)
- ❌ Ends conversations first (person always controls exit)

---

## Deployment

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for:
- Production server configuration
- Azure OpenAI + Speech service setup
- Database schema and migrations
- Staff training requirements
- On-call rotation implementation
- Incident response procedures

---

## Notes

This prototype intentionally keeps the AI layer **local, transparent, and rule-based** — not a black-box LLM making clinical decisions. Risk assessment is keyword + sentiment based, with explicit escalation rules visible to staff.

The system is designed to work with LMNSPN's existing human workflow, not replace it. An **on-call rotation is recommended** for after-hours escalations to be most effective.

---

## References

- [NSW Mental Health Triage Policy (PD2012_053)](https://www.health.nsw.gov.au) — Risk tier definitions
- [Stanford 2025 Study](https://example.com) — LLM limitations in crisis contexts
- [Australian Commission on Safety & Quality in Health Care](https://www.safetyandquality.gov.au/) — Action 8.12 on preventable harm

---

## License & Attribution

Built for the Lake Macquarie & Newcastle Suicide Prevention Network (LMNSPN) NGM Group Hackathon, May 2026.

**Important:** This is a prototype. Safety-critical systems require clinical oversight, legal review, and regulatory compliance before production deployment.
