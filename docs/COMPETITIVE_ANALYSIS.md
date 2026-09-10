# Competitive Analysis

Why existing mental-health chatbots don't fit the problem PathFinder addresses, what PathFinder does differently, and the failure modes of consumer AI companions that shaped its design.

---

## The problem existing tools don't solve

Most mental-health chatbots are built to be a *destination* — the person talks to the app, and the app tries to help them feel better. PathFinder is built to be a *bridge* — it connects a distressed person to the right human at a specific local organisation, fast, and gets out of the way.

That difference in intent explains almost every feature gap below. A destination tool optimises for engagement and retention. A bridge optimises for speed-to-human and correct routing.

---

## Feature comparison

| Feature | Woebot | Wysa | Crisis Text Line | PathFinder |
|---------|--------|------|------------------|------------|
| Real-time staff notification | No | No | Yes (human-operated) | Yes (automated) |
| Local service matching | No | No | No | Yes (14 local programs) |
| Multi-channel escalation | No | No | Internal only | Yes (Web Push → SMS → phone call) |
| Voice input + output | No | No | No | Yes |
| Embedded in a local org's workflow | No | No | No | Yes |
| After-hours bridge | No | No | Yes (human) | Yes (AI → staff) |
| Rule-based, auditable risk scoring | No | No | n/a | Yes |

The point of the table is not that PathFinder is "better" in the abstract — Crisis Text Line's human-staffed model is excellent at what it does. It is that PathFinder fills a specific gap: a small local prevention network that needs an always-on front door wired directly into *its own* staff, roster, and partner programs.

---

## Where each category falls short for this use case

**Self-help chatbots (Woebot, Wysa).** These deliver CBT-style exercises and mood tracking. They are designed to keep the user inside the app and generally do not notify a human in real time, do not know about a specific town's services, and are not embedded in any local organisation's workflow. For a person in acute distress, an exercise is not a warm handoff to a named support worker.

**Crisis lines (Crisis Text Line, Lifeline).** Human-staffed and highly effective, but they are national and generic — they do not route into a particular local network's roster or match a person to one of *that network's* 14 partner programs. They also don't give a local organisation visibility over who from their community reached out.

**Consumer AI companions (Replika, general ChatGPT use).** Not built for crisis at all, and their failure modes are instructive — see below.

---

## Lessons learned from Replika / ChatGPT failure modes

PathFinder's guardrails are a direct response to documented ways consumer AI has gone wrong in emotionally vulnerable contexts.

- **Parasocial attachment.** Companion apps are engineered to feel like a relationship, which can deepen isolation rather than resolve it. → PathFinder is instructed to identify as AI, never present as a friend, and always push toward human connection. It is a bridge, not a companion.
- **Sycophancy and validation loops.** General-purpose models tend to agree and affirm, which is dangerous when someone expresses harmful intent. → Risk detection is handled by an independent rule-based engine, not by the conversational model, so a warm reply can never override a HIGH classification.
- **Attempting to counsel.** Consumer chatbots will happily attempt therapy-like conversation they aren't qualified to give. → Hard guardrails forbid diagnosis, clinical intervention, and "talking someone down."
- **False confidentiality.** Users often assume a chatbot conversation is private and protected. → PathFinder is explicit that it cannot promise confidentiality it can't guarantee.
- **Silent failure.** A model that goes down or refuses simply leaves the user with nothing. → Crisis resources are hardcoded in static markup and the escalation chain self-advances on failure, so the person is never left in silence.
- **No human in the loop.** The core failure — no path to a real person. → Every HIGH case triggers automated, multi-channel notification to named, on-call, appropriately-trained staff.

---

## PathFinder's differentiators, summarised

1. **Bridge, not destination** — optimised for speed-to-human, not engagement.
2. **Independent, auditable risk scoring** — rule-based, not delegated to an LLM, so it can't be talked out of an alarm.
3. **Wired into a specific local network** — its staff, roster, training levels, and 14 partner programs.
4. **Resilient by design** — static crisis resources, provider fallback, self-advancing escalation.
5. **Honest** — identifies as AI, refuses to counsel, makes no false privacy promises.

---

## Status

Prototype, built for the LMNSPN NGM Group Hackathon (May 2026). Comparisons reflect the categories' general design intent, not a formal clinical evaluation.
