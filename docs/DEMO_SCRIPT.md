# Demo Script

A walkthrough for demonstrating PathFinder, with talking points and Q&A preparation. Target length: about 5–7 minutes.

> Keep the framing consistent throughout: PathFinder is a **bridge to human support**, not a therapy bot. Lead with that and return to it.

---

## Before you start

- API running: `python3 -m uvicorn app.main:app --reload --app-dir backend`
- Frontend running: `npm --prefix frontend run dev`, open `http://localhost:5173`
- Have three browser views ready if possible: the public chatbot, the referral portal, and the staff dashboard.
- Sanity check `GET /api/health` — it reports which AI source is active (OpenAI, Azure, or rule-based fallback). The demo works on any of them; if no keys are set it falls back to rule-based replies, which is worth mentioning as a resilience feature rather than hiding.

---

## Opening (30 seconds)

> "This is PathFinder — built for the Lake Macquarie & Newcastle Suicide Prevention Network. The problem it solves is the gap between someone reaching out and reaching the right person. Existing tools either try to *be* the help, or they're national and generic. PathFinder is an always-on front door wired directly into this network's own staff and local programs. The core rule: the AI is the bridge, never the destination."

---

## Scene 1 — Low-risk intake (90 seconds)

Open the chatbot. Enter the low-risk demo prompt:

```
I've been feeling really alone lately. I moved towns and don't know many people.
```

**Talking points while it responds:**
- The message is scored LOW locally — support-seeking, isolation, no crisis language.
- Note the reply is short, specific, and doesn't try to counsel. It moves toward connection.
- Point out the assistant identifies as AI and crisis resources are visible on screen regardless of risk level.

---

## Scene 2 — High-risk detection and escalation (2 minutes)

This is the centrepiece. Enter the high-risk demo prompt:

```
I can't do this anymore. I've got pills in my hand right now.
```

**Talking points as it fires:**
- "'pills' and 'can't do this anymore' are high-risk signals. Any single high-risk keyword forces a HIGH classification — we round *up*, always. A false alarm costs a staff member a few minutes; a missed case is unacceptable."
- **Layer 1 (instant):** crisis resources surface immediately — 000, Lifeline 13 11 14, NSW MHL, 13YARN.
- **Layer 2 (instant):** on-call staff and the CEO are alerted. Explain the channel order — Web Push, then SMS, then a phone call that deliberately bypasses silent mode.
- Switch to the **staff dashboard** — show the escalation appearing in the priority queue, assigned to a high-risk-capable responder (Kara or Teyarnee).
- Explain layers 3–5 verbally: "If no one acknowledges in 5 minutes, everyone is re-alerted. At 15 minutes, it escalates to the CEO and is logged as a *system failure* requiring review. The person is never left in silence — a failed notification advances escalation, it doesn't get dropped."
- If you can, acknowledge the escalation from the dashboard to show the response-time capture.

**The line to land:** "The risk decision was made by a transparent rule-based engine, not a black-box model. Even if every AI provider were down, this escalation still fires."

---

## Scene 3 — Professional referral + local matching (90 seconds)

Open the referral portal. Enter the gaming-centre prompt:

```
A young woman was visibly distressed near the gaming room. She said everything feels pointless and staff are worried she's alone tonight.
```

**Talking points:**
- This is a third-party referral with a source tag (the gaming centre) — PathFinder handles referrals from partner venues, GPs, and self-referrals, all tagged by source.
- The situation is scored and matched against the network's 14 local programs. Point out that matching considers both the signals in the text and the risk level — high-risk situations weight toward complex/high-risk-capable programs like The Rosewood Centre.
- Emphasise: "This is the differentiator. A national crisis line can't route this into *this* network's roster and *this* town's services."

---

## Closing (30 seconds)

> "So — three things. One, an always-on front door that identifies as AI and never pretends to be therapy. Two, a safety-critical layer that's rule-based, auditable, and independent of the AI, with escalation that self-advances so no one is left waiting. Three, it's wired into this network's real staff and local programs. It's a prototype — production needs clinical oversight and a real datastore — but the design puts safety first at every layer."

---

## Q&A preparation

**"What if the AI says something harmful?"**
The AI only phrases replies; it never makes the risk decision. Guardrails forbid diagnosis, false comfort, and attempting to counsel. Risk scoring and escalation run independently, so a bad reply can't suppress an alert. We're candid that guardrails are prompt-level, so monitoring matters.

**"What if the AI is down?"**
Replies fall back OpenAI → Azure → rule-based canned responses, and crisis resources are hardcoded in static markup. Risk scoring is local Python and never depended on the model. The system degrades gracefully.

**"How do you know the risk scoring is accurate?"**
It's rule-based and auditable — every HIGH classification carries the flags that triggered it, so staff can see *why*. We deliberately bias toward false positives. It will miss coded or non-English phrasing — which is exactly why MEDIUM cases also get human review, and why we don't claim it replaces clinical judgement.

**"Is this a medical device / does it diagnose?"**
No. PathFinder is explicitly not an EHR and does not diagnose or treat. It's a triage and routing tool that connects people to humans.

**"What about privacy?"**
Minimal PII — first name only, no Medicare numbers, no clinical records. Audit log is append-only. We're upfront that the prototype's in-memory store and lack of a deletion workflow must be replaced before handling real personal data.

**"What's not done yet?"**
A persistent secured datastore, minor/mandatory-reporting handling, a data-deletion workflow, and deployment-time credential verification. These are catalogued in EDGE_CASES.md — surfacing them is part of the design, not an afterthought.

---

## Status

Prototype, built for the LMNSPN NGM Group Hackathon (May 2026).
