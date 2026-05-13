from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass


STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "have", "from", "been", "about",
    "into", "they", "their", "someone", "looking", "support", "help", "feel",
    "has", "was", "are", "will", "just", "she", "her", "him", "his", "who",
    "can", "our", "out", "but", "not", "all", "its", "very",
}

PROGRAM_PROFILES: dict[int, dict] = {
    1: {  # Psychology — Kara Thomson
        "signals": [
            ("psychology", 3), ("psychologist", 3), ("psychological", 3),
            ("anxiety", 2), ("depression", 2), ("trauma", 2),
            ("mental health plan", 3), ("gp", 2), ("structured", 1),
            ("clinical", 2), ("planning", 1), ("long history", 2),
        ],
        "risk_fit":    {"low": 0.7, "medium": 0.9, "high": 0.6},
        "emotion_fit": {"sadness": 0.8, "fear": 0.7, "hopelessness": 0.6},
        "specialty_tag": "General psychology and mental health planning",
    },
    2: {  # Kintsugi OT
        "signals": [
            ("neurodivergent", 4), ("neurodiversity", 4), ("autism", 4), ("autistic", 4),
            ("adhd", 4), ("occupational", 3), ("sensory", 3), ("functioning", 2),
            ("neurodiverse", 4), ("executive function", 3), ("daily tasks", 2),
            ("support worker", 2),
        ],
        "risk_fit":    {"low": 0.9, "medium": 0.7, "high": 0.2},
        "emotion_fit": {"stress": 0.7, "fear": 0.4},
        "specialty_tag": "Neurodivergent specialist — autism, ADHD, occupational therapy",
    },
    3: {  # Walk Within
        "signals": [
            ("meaning", 2), ("identity", 3), ("transition", 3), ("purpose", 2),
            ("spiritual", 3), ("direction", 2), ("existential", 3), ("lost", 2),
            ("life change", 3), ("who am", 3), ("transpersonal", 4),
            ("overseas", 2), ("everything changed", 3), ("returned", 2),
        ],
        "risk_fit":    {"low": 0.9, "medium": 0.7, "high": 0.2},
        "emotion_fit": {"sadness": 0.7, "hopelessness": 0.6},
        "specialty_tag": "Life transitions, meaning and identity exploration",
    },
    4: {  # Art Therapy
        "signals": [
            ("art", 2), ("creative", 3), ("express", 2), ("draw", 2), ("paint", 2),
            ("hard to talk", 4), ("hard to express", 3), ("words difficult", 4),
            ("can't talk", 3), ("cant talk", 3), ("nonverbal", 3),
            ("talking difficult", 3), ("find it hard", 2),
        ],
        "risk_fit":    {"low": 0.9, "medium": 0.7, "high": 0.2},
        "emotion_fit": {"sadness": 0.7, "stress": 0.5},
        "specialty_tag": "Creative and expressive therapy",
    },
    5: {  # Constructive Thinking
        "signals": [
            ("anxiety", 2), ("depression", 2), ("relationship", 2), ("cope", 2),
            ("coping", 2), ("stress", 2), ("panic", 2), ("worry", 2),
            ("partner", 1), ("work", 1), ("sleep", 1), ("overwhelm", 2),
            ("counsell", 2), ("burnout", 2), ("general", 1),
        ],
        "risk_fit":    {"low": 0.9, "medium": 0.8, "high": 0.3},
        "emotion_fit": {"stress": 0.8, "fear": 0.7, "sadness": 0.6, "anger": 0.5},
        "specialty_tag": "General counselling — anxiety, relationships and coping",
    },
    6: {  # Well Education
        "signals": [
            ("education", 2), ("workshop", 3), ("learn", 1), ("understand", 1),
            ("psychoeducation", 4), ("literacy", 3), ("group", 2), ("skills", 2),
            ("community", 1), ("awareness", 2),
        ],
        "risk_fit":    {"low": 0.9, "medium": 0.4, "high": 0.1},
        "emotion_fit": {"stress": 0.4},
        "specialty_tag": "Wellbeing education and psychoeducation programs",
    },
    7: {  # Bright Feathers
        "signals": [
            ("school", 3), ("student", 3), ("study", 2), ("youth", 3), ("young", 2),
            ("teen", 3), ("teenager", 3), ("year 10", 3), ("year 11", 3), ("year 12", 3),
            ("hsc", 3), ("uni", 2), ("university", 2), ("academic", 2),
            ("learning", 2), ("grade", 2), ("17", 2), ("18", 2),
        ],
        "risk_fit":    {"low": 0.9, "medium": 0.7, "high": 0.3},
        "emotion_fit": {"stress": 0.8, "fear": 0.7},
        "specialty_tag": "Youth and educational support",
    },
    8: {  # The Rosewood Centre
        "signals": [
            ("suicide", 4), ("suicidal", 4), ("crisis", 4), ("high risk", 4),
            ("complex", 3), ("trauma", 3), ("severe", 3), ("urgent", 3),
            ("danger", 3), ("ideation", 4), ("self harm", 3), ("self-harm", 3),
            ("overdose", 4), ("have a plan", 4), ("nothing to live", 4),
            ("want to die", 4), ("end it", 3),
        ],
        "risk_fit":    {"low": 0.1, "medium": 0.5, "high": 1.0},
        "emotion_fit": {"hopelessness": 0.9, "fear": 0.7},
        "specialty_tag": "Complex and high-risk — clinical psychology and crisis",
    },
    9: {  # Phoenix Assist
        "signals": [
            ("ndis", 5), ("disability", 4), ("support coordination", 5),
            ("disabled", 4), ("funding", 3), ("navigate", 2), ("plan", 2),
            ("services", 1), ("confusing", 1), ("access", 1),
        ],
        "risk_fit":    {"low": 0.9, "medium": 0.7, "high": 0.3},
        "emotion_fit": {"stress": 0.5},
        "specialty_tag": "NDIS support coordination and disability services",
    },
    10: {  # Gamble Aware
        "signals": [
            ("gambl", 5), ("gambling", 5), ("debt", 4), ("financial", 3),
            ("money", 2), ("bet", 4), ("poker", 4), ("casino", 4),
            ("afford", 2), ("owe", 3), ("loan", 3), ("in over his head", 3),
            ("spending", 2), ("thousands", 2),
        ],
        "risk_fit":    {"low": 0.9, "medium": 0.8, "high": 0.4},
        "emotion_fit": {"stress": 0.8, "fear": 0.6},
        "specialty_tag": "Gambling harm and financial counselling",
    },
    11: {  # Fearless Therapies
        "signals": [
            ("emotion", 2), ("regulate", 2), ("trauma", 2), ("therapy", 1),
            ("practical", 2), ("resilience", 2), ("distress", 2),
            ("general", 1), ("wellbeing", 1), ("support", 1),
        ],
        "risk_fit":    {"low": 0.8, "medium": 0.9, "high": 0.4},
        "emotion_fit": {"fear": 0.8, "stress": 0.7, "sadness": 0.6},
        "specialty_tag": "Emotional regulation and trauma-informed therapy",
    },
    12: {  # Top Blokes Foundation
        "signals": [
            ("men", 3), ("male", 3), ("man", 2), ("bloke", 4), ("masculin", 3),
            ("young men", 4), ("young man", 4), ("father", 2), ("dad", 2),
            ("husband", 2), ("boyfriend", 2), ("footy", 3), ("mate", 2),
            ("mine", 2), ("miner", 3), ("isolation", 2),
        ],
        "risk_fit":    {"low": 0.9, "medium": 0.8, "high": 0.3},
        "emotion_fit": {"anger": 0.8, "stress": 0.6},
        "specialty_tag": "Men's mental health and peer connection",
    },
    13: {  # SandWaves Therapy
        "signals": [
            ("resilience", 2), ("counsel", 1), ("wellbeing", 1), ("accessible", 2),
            ("emotional", 1), ("carer", 2), ("burnout", 2), ("older", 1),
            ("adult", 1), ("general", 1), ("dementia", 2),
        ],
        "risk_fit":    {"low": 0.9, "medium": 0.7, "high": 0.2},
        "emotion_fit": {"sadness": 0.7, "stress": 0.6},
        "specialty_tag": "General therapy and emotional wellbeing",
    },
    14: {  # Name.Narrate.Navigate
        "signals": [
            ("narrative", 4), ("story", 3), ("identity", 3), ("transition", 3),
            ("meaning", 2), ("grief", 3), ("loss", 2), ("bereave", 3),
            ("widow", 3), ("widowed", 3), ("death", 2), ("died", 2),
            ("personal", 2), ("life story", 3), ("sense of", 2),
        ],
        "risk_fit":    {"low": 0.9, "medium": 0.7, "high": 0.2},
        "emotion_fit": {"sadness": 0.9, "hopelessness": 0.6},
        "specialty_tag": "Narrative therapy — meaning, identity and life transitions",
    },
}


@dataclass
class ProgramMatch:
    id: int
    name: str
    provider: str
    category: str
    confidence: float
    reason: str


def _tokens(text: str) -> Counter[str]:
    words = re.findall(r"[a-zA-Z]{3,}", text.lower())
    return Counter(w for w in words if w not in STOPWORDS)


def _matches_keyword(text: str, keyword: str) -> bool:
    if len(keyword) <= 4:
        return bool(re.search(rf"\b{re.escape(keyword)}\b", text))
    return keyword in text


def _signal_score(text: str, signals: list[tuple[str, int]]) -> tuple[float, list[str]]:
    lower = text.lower()
    matched: list[str] = []
    total_weight = 0
    for keyword, weight in signals:
        if _matches_keyword(lower, keyword):
            matched.append(keyword)
            total_weight += weight
    max_possible = sum(w for _, w in sorted(signals, key=lambda x: -x[1])[:5])
    score = min(total_weight / max(max_possible, 1), 1.0)
    return score, matched


def _build_reason(
    matched_kws: list[str],
    specialty_tag: str,
    capacity_note: str,
    risk_note: str,
) -> str:
    parts = []
    if matched_kws:
        kws = ", ".join(f"'{k}'" for k in matched_kws[:3])
        parts.append(f"Referral mentions {kws}")
    if risk_note:
        parts.append(risk_note)
    if capacity_note:
        parts.append(capacity_note)
    if not parts:
        parts.append(f"General fit: {specialty_tag}")
    return ". ".join(parts) + "."


def match_programs(
    situation: str,
    programs: list[dict],
    limit: int = 3,
    risk_level: str = "low",
    emotions: dict[str, float] | None = None,
) -> list[ProgramMatch]:
    if emotions is None:
        emotions = {}

    scored: list[ProgramMatch] = []

    for program in programs:
        prog_id = program["id"]
        profile = PROGRAM_PROFILES.get(prog_id, {})
        signals       = profile.get("signals", [])
        risk_fit      = profile.get("risk_fit", {"low": 0.5, "medium": 0.5, "high": 0.5})
        emotion_fit   = profile.get("emotion_fit", {})
        specialty_tag = profile.get("specialty_tag", program["description"][:60])

        sig_score, matched_kws = _signal_score(situation, signals)
        risk_score = risk_fit.get(risk_level, 0.5)

        emotion_score = 0.0
        active_emotions = [(e, v) for e, v in emotions.items() if v > 0.2 and e != "joy"]
        for emotion, intensity in active_emotions:
            emotion_score += emotion_fit.get(emotion, 0.0) * intensity
        emotion_score = min(emotion_score, 1.0)

        available = program["capacity"] - program["current_load"]
        capacity_score = available / max(program["capacity"], 1)

        query = _tokens(situation)
        prog_tokens = _tokens(f"{program['name']} {program['description']}")
        overlap_score = min(sum((query & prog_tokens).values()) / 8, 1.0)

        raw = (
            sig_score     * 0.45
            + risk_score    * 0.25
            + emotion_score * 0.15
            + capacity_score * 0.10
            + overlap_score * 0.05
        )
        confidence = round(min(max(0.35 + raw * 0.62, 0.35), 0.97), 2)

        risk_note = ""
        if risk_level == "high" and risk_score >= 0.8:
            risk_note = "Prioritised for high-risk presentations"
        elif risk_level == "high" and risk_score < 0.4:
            risk_note = "Note: better suited to lower-risk cases"

        capacity_note = ""
        if available == 0:
            capacity_note = "No spots currently available"
        elif available == 1:
            capacity_note = "Only 1 spot remaining — consider alternatives"
        elif available <= 3:
            capacity_note = f"{available} spots available"

        scored.append(ProgramMatch(
            id=prog_id,
            name=program["name"],
            provider=program["provider"],
            category=program["category"],
            confidence=confidence,
            reason=_build_reason(matched_kws, specialty_tag, capacity_note, risk_note),
        ))

    return sorted(scored, key=lambda m: m.confidence, reverse=True)[:limit]
