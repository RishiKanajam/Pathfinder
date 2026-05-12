from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass


STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "have", "from", "been", "about",
    "into", "they", "their", "someone", "looking", "support", "help", "feel",
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
    return Counter(word for word in words if word not in STOPWORDS)


def match_programs(situation: str, programs: list[dict], limit: int = 3) -> list[ProgramMatch]:
    query = _tokens(situation)
    if not query:
        query = Counter({"general": 1})

    scored: list[ProgramMatch] = []
    for program in programs:
        profile = " ".join(
            [
                program["name"],
                program["provider"],
                program["category"],
                program["description"],
            ]
        )
        program_tokens = _tokens(profile)
        overlap = sum((query & program_tokens).values())
        category_boost = 0.0
        category = program["category"].lower()
        lower = situation.lower()
        if "gambl" in lower and "gambl" in profile.lower():
            category_boost += 2.0
        if any(term in lower for term in ["men", "young man", "male"]) and "men" in profile.lower():
            category_boost += 1.5
        if any(term in lower for term in ["neurodiverg", "autism", "adhd"]) and "neuro" in profile.lower():
            category_boost += 2.0
        if any(term in lower for term in ["complex", "suicide", "high risk", "crisis"]) and (
            "clinical" in profile.lower() or "high-risk" in profile.lower()
        ):
            category_boost += 2.5

        raw = overlap + category_boost + (0.3 if category in lower else 0)
        confidence = min(round(0.42 + raw / 10, 2), 0.96)
        reason = "Strong language overlap with the referral description"
        if category_boost:
            reason = "Matched because the referral includes a clear specialty signal"
        elif overlap == 0:
            reason = "General wellbeing fit while staff review the referral"

        scored.append(
            ProgramMatch(
                id=program["id"],
                name=program["name"],
                provider=program["provider"],
                category=program["category"],
                confidence=confidence,
                reason=reason,
            )
        )

    return sorted(scored, key=lambda item: item.confidence, reverse=True)[:limit]
