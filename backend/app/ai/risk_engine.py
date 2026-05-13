from __future__ import annotations

import re
from dataclasses import dataclass

# ── Signal 1: Crisis keywords (weight 40%) ────────────────────
# ANY high keyword → minimum HIGH risk (per spec: borderlines round UP)
HIGH_RISK_KEYWORDS = [
    # Direct suicide language
    "kill myself", "killing myself", "suicide", "suicidal", "suiciding",
    "want to die", "wants to die", "going to die", "going to kill",
    "end it all", "end my life", "ending my life", "ended my life",
    "take my life", "taking my life",
    "no point living", "no reason to live", "no point in living",
    "better off dead", "better off without me",
    # Self-harm / methods
    "hurt myself", "hurting myself", "harm myself",
    "pills", "overdose", "bridge", "hang", "hanging",
    "gun", "slit", "slash", "jump off", "jumped off",
    # Planning language
    "have a plan", "planned it", "made a plan", "i have a method",
    "final note", "last message", "goodbye forever", "goodbye everyone",
    "goodbye letter", "note to family",
    # State language
    "can't go on", "cant go on", "cannot go on",
    "won't be here", "wont be here", "won't be around",
    "not safe", "unsafe right now",
    # Common natural phrases
    "don't want to be here", "dont want to be here",
    "don't want to live", "dont want to live",
    "can't live like this", "cant live like this",
    "don't want to exist", "want to disappear forever",
]

MEDIUM_RISK_KEYWORDS = [
    "hopeless", "worthless", "pointless", "can't cope", "cant cope",
    "no one cares", "nobody cares", "no one loves me", "nobody loves me",
    "no one likes me", "unlovable", "unloved", "not loved", "burden",
    "trapped", "no way out", "give up", "lonely",
    "exhausted", "can't sleep", "cant sleep", "crying", "panic", "scared",
    "overwhelming", "overwhelmed", "depressed", "depression", "alone",
    "isolated", "nobody", "nothing to live for", "dark thoughts",
    "self harm", "self-harm", "harm myself",
]

RELATIONAL_DISTRESS_KEYWORDS = [
    "no one loves me", "nobody loves me", "no one likes me", "unlovable",
    "unloved", "not loved", "nobody cares about me", "no one cares about me",
]

# ── Signal 4: Linguistic markers (weight 15%) ─────────────────
ABSOLUTIST_WORDS = ["always", "never", "nothing", "everyone", "no one", "everything", "forever", "nowhere"]
FAREWELL_PHRASES = ["goodbye", "thank you for everything", "take care of my", "look after", "this is the end"]

EMOTION_KEYWORDS = {
    "sadness":     ["sad", "crying", "empty", "grief", "lost", "miserable", "heartbroken", "unloved", "lonely", "no one loves me", "nobody loves me"],
    "fear":        ["scared", "afraid", "panic", "anxious", "unsafe", "worried", "terrified"],
    "anger":       ["angry", "furious", "rage", "frustrated", "livid"],
    "hopelessness":["hopeless", "pointless", "nothing", "never", "can't go on", "cant go on", "no point", "no one loves me", "nobody loves me"],
    "stress":      ["stressed", "overwhelmed", "pressure", "burnt out", "can't cope", "cant cope"],
    "joy":         ["okay", "good", "better", "hopeful", "fine", "happy", "well"],
}


@dataclass
class RiskAssessment:
    level: str
    score: float
    confidence: float
    flags: list[str]
    emotions: dict[str, float]
    summary: str
    keywords_detected: list[str]
    escalation_required: bool


def _kw_score(text: str, words: list[str]) -> float:
    lowered = text.lower()
    matches = sum(1 for w in words if w in lowered)
    return min(matches / max(len(words), 1), 1.0)


def detect_emotions(text: str) -> dict[str, float]:
    return {emotion: round(_kw_score(text, words), 2) for emotion, words in EMOTION_KEYWORDS.items()}


def assess_risk(text: str, urgency: str | None = None) -> RiskAssessment:
    lowered = text.lower()
    flags: list[str] = []
    keywords_detected: list[str] = []
    score = 0.08
    confidence = 0.45

    # ── Signal 1: High-risk keywords (most powerful signal) ──
    high_count = 0
    for kw in HIGH_RISK_KEYWORDS:
        if kw in lowered:
            flags.append(f"Crisis language detected: '{kw}'")
            keywords_detected.append(kw)
            high_count += 1
            confidence += 0.18

    # Per spec: ANY high keyword = minimum HIGH; multiple = more certain
    if high_count >= 1:
        score = max(score, 0.72)    # Guarantee HIGH threshold is met
        score += 0.08 * (high_count - 1)  # Extra weight for multiple

    # ── Signal 1: Medium-risk keywords ───────────────────────
    medium_count = 0
    for kw in MEDIUM_RISK_KEYWORDS:
        if kw in lowered:
            flags.append(f"Elevated concern: '{kw}'")
            keywords_detected.append(kw)
            medium_count += 1
            score += 0.14
            confidence += 0.07

    if any(kw in lowered for kw in RELATIONAL_DISTRESS_KEYWORDS):
        flags.append("Relational distress detected")
        score = max(score, 0.36)
        confidence += 0.08

    # ── Signal 3 (proxy): Urgency flag from referrer ─────────
    if urgency in {"today", "urgent", "immediate"}:
        flags.append("Referrer marked urgency as immediate")
        score += 0.20
        confidence += 0.10

    # ── Signal 4: Linguistic markers ─────────────────────────
    absolutist_count = sum(1 for w in ABSOLUTIST_WORDS if re.search(rf"\b{re.escape(w)}\b", lowered))
    if absolutist_count >= 2:
        flags.append(f"Absolutist language detected ({absolutist_count} markers)")
        score += 0.06
        confidence += 0.05

    for phrase in FAREWELL_PHRASES:
        if phrase in lowered:
            flags.append(f"Farewell-type language: '{phrase}'")
            keywords_detected.append(phrase)
            score += 0.15
            confidence += 0.12

    # Very short message = limited data
    if len(text.strip()) < 20:
        confidence -= 0.08

    # ── Signal 2 proxy: Emotion intensity ────────────────────
    emotions = detect_emotions(text)
    score += emotions["hopelessness"] * 0.18
    score += emotions["fear"] * 0.10
    score += emotions["stress"] * 0.08
    if emotions["hopelessness"] > 0.4:
        confidence += 0.08

    # ── Clamp ────────────────────────────────────────────────
    confidence = round(min(max(confidence, 0.0), 1.0), 2)
    score = round(min(score, 0.99), 2)

    # ── Borderline rounding UP (per spec) ────────────────────
    if 0.65 < score < 0.72:
        score = 0.72
        flags.append("Borderline case — rounded UP for safety")
        confidence = min(confidence + 0.05, 1.0)
    elif 0.28 < score < 0.36:
        score = 0.36
        flags.append("Borderline case — rounded UP for safety")

    # ── Classification ────────────────────────────────────────
    if score >= 0.72:
        level = "high"
        escalation_required = True
    elif score >= 0.36:
        level = "medium"
        escalation_required = confidence >= 0.65
    else:
        level = "low"
        escalation_required = False

    summary = {
        "high":   "Immediate human review required. Crisis resources must remain visible.",
        "medium": "Elevated distress detected. Notify on-call staff and prioritise follow-up.",
        "low":    "Routine support request. Queue for next business-day follow-up.",
    }[level]

    return RiskAssessment(
        level=level,
        score=score,
        confidence=confidence,
        flags=flags,
        emotions=emotions,
        summary=summary,
        keywords_detected=keywords_detected,
        escalation_required=escalation_required,
    )
