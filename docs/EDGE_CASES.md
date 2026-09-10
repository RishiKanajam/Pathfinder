# Edge Cases

A catalogue of situations PathFinder must handle carefully, grouped by domain. Each entry states the case, the risk it poses, and how the system is designed to respond. Where an item is a known limitation of the prototype rather than a solved problem, it is marked **[gap]** — these are deliberately visible so they can be addressed before any production use.

The guiding rule throughout: when uncertain, escalate to a human and keep crisis resources visible.

---

## Crisis-detection edge cases

1. **Indirect or coded language.** A person expresses intent without any keyword ("I've written letters to everyone"). *Risk:* HIGH case scored LOW. *Response:* farewell-phrase and absolutist markers catch some of these; MEDIUM triggers on distress language. **[gap]** — keyword matching will miss novel phrasing; this is the main argument for human review of MEDIUM cases, not just HIGH.
2. **Sarcasm or quoting.** "Everyone always says I should just kill myself, ha." *Risk:* false HIGH. *Response:* by design, borderline cases round up — a false positive is acceptable per the "err on the side of alarm" principle. Staff acknowledgement resolves it quickly.
3. **Third-party concern.** A referrer describes someone *else* ("she said everything feels pointless"). *Response:* the referral portal captures third-party reports and scores the described situation; routing still applies.
4. **Escalating mid-conversation.** Person starts LOW, becomes HIGH. *Response:* every message is re-scored independently, so a later HIGH message triggers escalation regardless of how the conversation began.
5. **De-escalation.** Person expresses HIGH intent, then says they're safe now. *Response:* the earlier HIGH escalation is *not* cancelled automatically — acknowledgement and resolution are explicit human actions. The system does not let a reassuring message quietly close an open high-risk case.
6. **Non-English or mixed language.** **[gap]** — keyword lists are English-only; risk detection degrades for other languages. Must be flagged before deploying to any multilingual community.
7. **Very short messages.** "done." / "goodbye" *Response:* farewell phrases are in the marker set; short ambiguous messages lean toward MEDIUM rather than LOW.

---

## AI-layer edge cases

8. **All AI providers unavailable.** *Response:* fallback chain ends in a rule-based responder; the conversation continues with safe canned replies and risk scoring is unaffected (it never used the LLM).
9. **Model produces an unsafe or off-guardrail reply.** *Risk:* diagnosis, false comfort, attempting therapy. *Response:* system-prompt guardrails constrain wording; risk scoring and escalation are independent so a bad reply can't suppress an alert. **[gap]** — guardrails are prompt-level, not hard-filtered; a determined jailbreak of the reply layer is possible and should be monitored.
10. **Model latency spike.** *Response:* the person may wait for a reply, but Layer 1 crisis resources and the risk-based escalation already fired on message receipt — help paths do not wait on the model.
11. **Model contradicts the risk engine** (soothing reply on a HIGH message). *Response:* acceptable by design — the reply is cosmetic; the HIGH escalation still runs. The human, not the model, owns the outcome.
12. **Prompt injection via user message.** **[gap]** — a user could attempt to manipulate the reply layer. Because the reply layer has no authority over risk or escalation and holds no secrets, the blast radius is limited to reply wording, but it should still be tested.

---

## Referral edge cases

13. **Duplicate referral.** Same person referred by a gaming centre and self-referral. **[gap]** — no dedup in the prototype; both create records. Staff reconcile manually.
14. **No matching program.** Situation doesn't fit any of the 14 programs well. *Response:* the matcher returns best-effort scores; a low top score should prompt staff to route manually rather than trust the suggestion.
15. **Program at capacity.** Suggested program's `current_load` ≥ `capacity`. **[gap]** — matching considers risk-fit and signals but capacity handling is minimal; staff should check load before assigning.
16. **Referral with no contact details.** *Response:* schema allows null contact fields; the record still enters the queue so staff can act on the situation text.
17. **High-risk referral outside hours.** *Response:* after-hours escalation routes to on-call staff via the notification chain; the overnight summary surfaces it for morning review.

---

## Technical edge cases

18. **Backend unreachable from the client.** *Response:* static crisis resources (000, Lifeline) are hardcoded in markup and render without the API.
19. **In-memory store resets on restart.** **[gap]** — the prototype has no persistent database; all referrals/escalations are lost on process restart. This is the top item to fix before any real use.
20. **Notification credential missing** (Twilio/VAPID not set). *Response:* channels that lack credentials are skipped; the escalation still advances through remaining channels and logs which fired. **[gap]** — a fully unconfigured environment means no external alert reaches staff; deployment checklist must verify credentials.
21. **Audit log integrity.** *Response:* the audit log is append-only by design. **[gap]** — in-memory append-only is not tamper-proof storage; production needs a write-once persistent store for legal scrutiny.
22. **Concurrent acknowledgements.** Two staff acknowledge the same escalation. *Response:* first acknowledgement records the responder; the design tolerates the race without losing the record.

---

## Ethical and privacy edge cases

23. **Minor in crisis.** **[gap]** — the prototype does not special-case age or mandatory-reporting obligations. This must be addressed with clinical and legal guidance before production.
24. **Person expects confidentiality.** *Response:* the assistant is instructed not to promise confidentiality it can't guarantee, per the transparency principle.
25. **PII minimisation.** *Response:* first name only, no Medicare numbers, no clinical records; PathFinder is explicitly not an EHR.
26. **Someone treats the bot as a friend / becomes attached.** *Response:* the bot identifies as AI and is instructed never to present as a friend or companion — a direct guard against the parasocial failure mode.
27. **Data-subject request / right to be forgotten.** **[gap]** — no deletion workflow in the prototype; needs to exist before handling real personal data.
28. **Staff safety and load.** Repeated HIGH escalations to the same responder. *Response:* roster and caseload fields exist; **[gap]** — automated load-balancing across on-call staff is minimal and should be strengthened.

---

## Using this catalogue

The **[gap]** items are the honest to-do list for moving PathFinder from hackathon prototype to something deployable. The most urgent, in order: a persistent secured datastore (19, 21), minor/mandatory-reporting handling (23), credential verification in deployment (20), and a data-deletion workflow (27). None of these are hidden — surfacing them is itself part of the safety-critical design.

---

## Status

Prototype, built for the LMNSPN NGM Group Hackathon (May 2026). This catalogue is illustrative, not exhaustive, and is not a substitute for formal clinical risk assessment.
