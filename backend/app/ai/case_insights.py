"""
Case Insights Engine — pure Python, no external API dependency.

Generates AI-powered analysis of a referral for staff use:
- Case complexity score (0-1)
- Junior psychologist fit % vs Senior/experienced fit %
- Urgency classification
- Key themes extracted from the situation text
- Estimated sessions and modality recommendations
- Suggested next action

Fit percentages are calculated from the empirical relationship between
case complexity, risk level, clinical themes, and what level of experience
a clinician needs to work safely with that presentation.
"""
from __future__ import annotations

import re

# ── Theme detection ──────────────────────────────────────────
THEMES = {
    "suicide_risk":        ["kill myself", "want to die", "end it", "suicide", "suicidal", "overdose", "pills", "no point living"],
    "self_harm":           ["self harm", "self-harm", "hurt myself", "cutting", "burning myself"],
    "trauma":              ["trauma", "ptsd", "abuse", "assault", "violence", "accident", "flashback", "nightmare"],
    "grief_loss":          ["grief", "bereaved", "died", "death", "lost my", "passed away", "widow", "mourning"],
    "relationship":        ["breakup", "divorce", "relationship", "partner", "marriage", "family conflict", "domestic"],
    "substance_use":       ["alcohol", "drinking", "drugs", "weed", "gambling", "addiction", "dependent"],
    "work_stress":         ["work", "job", "career", "unemployed", "boss", "workplace", "burnout", "fired"],
    "anxiety":             ["anxiety", "anxious", "panic", "panic attack", "worry", "overthinking", "fear"],
    "depression":          ["depressed", "depression", "hopeless", "worthless", "empty", "sad", "low mood", "no motivation"],
    "isolation":           ["alone", "lonely", "isolated", "no one", "no friends", "no support", "disconnected"],
    "youth_challenges":    ["school", "uni", "university", "student", "hsc", "year 12", "bullying", "teenager"],
    "financial_stress":    ["debt", "money", "financial", "bills", "evicted", "rent", "loan"],
    "identity":            ["identity", "who i am", "purpose", "meaning", "belong", "neurodivergent", "adhd", "autism"],
    "carer_burden":        ["carer", "caring for", "caregiver", "looking after", "parent with", "dementia"],
    "veteran_first_resp":  ["veteran", "military", "army", "navy", "police", "paramedic", "firefighter", "first responder"],
    "cultural_factors":    ["aboriginal", "indigenous", "atsi", "cultural", "refugee", "immigrant", "cultural background"],
}

# Themes that require senior / experienced clinician
SENIOR_REQUIRED_THEMES = {
    "suicide_risk", "self_harm", "trauma", "veteran_first_resp",
}

# Themes that add complexity
HIGH_COMPLEXITY_THEMES = {
    "suicide_risk", "self_harm", "trauma", "substance_use",
    "veteran_first_resp", "cultural_factors",
}

SESSION_TYPES = {
    "suicide_risk":     ("Individual therapy", "Clinical psychology / crisis intervention"),
    "self_harm":        ("Individual therapy", "Clinical psychology with DBT skills"),
    "trauma":           ("Individual therapy", "Trauma-informed EMDR or somatic approach"),
    "grief_loss":       ("Individual or group", "Grief counselling"),
    "relationship":     ("Individual or couples", "Relationship and systemic counselling"),
    "substance_use":    ("Individual + group", "AOD counselling, peer support"),
    "youth_challenges": ("Individual or group", "Youth-focused counselling"),
    "anxiety":          ("Individual therapy", "CBT / mindfulness-based therapy"),
    "depression":       ("Individual therapy", "Integrative counselling or psychology"),
    "financial_stress": ("Individual", "Financial counselling + wellbeing support"),
    "cultural_factors": ("Individual", "Culturally safe counselling — consider ATSI-specific services"),
    "carer_burden":     ("Individual or group", "Carer support and psychoeducation"),
    "veteran_first_resp":("Individual", "Trauma-informed psychology"),
}


def detect_themes(text: str) -> list[str]:
    lowered = text.lower()
    return [theme for theme, keywords in THEMES.items() if any(kw in lowered for kw in keywords)]


def compute_complexity(risk_score: float, themes: list[str], situation: str) -> float:
    """
    Complexity reflects how much clinical skill the presentation requires.
    0.0 = very straightforward, 1.0 = extremely complex.
    """
    base = risk_score * 0.45  # Risk is the strongest driver

    # Each detected high-complexity theme adds to the score
    for theme in themes:
        if theme in HIGH_COMPLEXITY_THEMES:
            base += 0.12
        else:
            base += 0.04

    # Multiple themes = more complex
    if len(themes) >= 4:
        base += 0.08
    elif len(themes) >= 2:
        base += 0.04

    # Situation length: longer, more detailed descriptions often = more complex
    word_count = len(situation.split())
    if word_count > 60:
        base += 0.04

    return round(min(base, 0.98), 2)


def compute_clinician_fit(complexity: float, themes: list[str], risk_score: float) -> dict:
    """
    Returns fit percentages for:
    - new_professional: early-career psychologist, lower complexity
    - experienced_professional: established psychologist/support worker fit
    - senior_psychologist: complex/high-risk/specialist fit
    """
    requires_senior = bool(set(themes) & SENIOR_REQUIRED_THEMES)

    if requires_senior or risk_score >= 0.72:
        # High complexity / crisis: only senior is appropriate
        senior = round(0.82 + min(complexity * 0.15, 0.13), 2)
        experienced = round(0.45 - complexity * 0.15, 2)
        new = round(max(0.08, 0.25 - complexity * 0.22), 2)
    elif complexity >= 0.55:
        # Moderate-high: senior + mid appropriate
        senior = round(0.70 + complexity * 0.20, 2)
        experienced = round(0.65 - complexity * 0.10, 2)
        new = round(max(0.10, 0.35 - complexity * 0.25), 2)
    else:
        # Low complexity: junior and mid both suitable
        senior = round(0.40 + complexity * 0.30, 2)
        experienced = round(0.75 - complexity * 0.10, 2)
        new = round(max(0.35, 0.80 - complexity * 0.45), 2)

    # Clamp all to [0.05, 0.99]
    return {
        "new_professional": round(min(max(new, 0.05), 0.99), 2),
        "experienced_professional": round(min(max(experienced, 0.05), 0.99), 2),
        "senior_psychologist": round(min(max(senior, 0.05), 0.99), 2),
    }


def get_workforce_recommendation(clinician_fit: dict) -> dict:
    labels = {
        "new_professional": "New professional psychologist",
        "experienced_professional": "Experienced professional psychologist",
        "senior_psychologist": "Senior / specialist psychologist",
    }
    best_key = max(clinician_fit, key=clinician_fit.get)
    return {
        "recommended_level": best_key,
        "label": labels[best_key],
        "confidence": clinician_fit[best_key],
        "rationale": (
            "Complexity and risk indicators point to senior clinical ownership."
            if best_key == "senior_psychologist"
            else "The case appears suitable for an experienced professional with standard review."
            if best_key == "experienced_professional"
            else "The case appears suitable for a newer professional with supervision available."
        ),
    }


def get_urgency(risk_score: float, themes: list[str]) -> dict:
    if risk_score >= 0.72 or "suicide_risk" in themes or "self_harm" in themes:
        return {
            "level": "immediate",
            "label": "Immediate — same day contact required",
            "color": "high",
            "hours": 0,
        }
    elif risk_score >= 0.45 or len(set(themes) & HIGH_COMPLEXITY_THEMES) >= 1:
        return {
            "level": "priority",
            "label": "Priority — within 24 hours",
            "color": "medium",
            "hours": 24,
        }
    else:
        return {
            "level": "routine",
            "label": "Routine — within 3 business days",
            "color": "low",
            "hours": 72,
        }


def get_session_recommendation(themes: list[str]) -> dict:
    for theme in SENIOR_REQUIRED_THEMES:
        if theme in themes:
            modality, notes = SESSION_TYPES[theme]
            return {"modality": modality, "notes": notes}
    for theme in themes:
        if theme in SESSION_TYPES:
            modality, notes = SESSION_TYPES[theme]
            return {"modality": modality, "notes": notes}
    return {
        "modality": "Individual counselling",
        "notes": "General wellbeing support — assess and adapt after first session",
    }


def get_next_action(urgency_level: str, assigned_to: int | None, status: str) -> str:
    if urgency_level == "immediate":
        if not assigned_to:
            return "UNASSIGNED — assign to a high-risk capable staff member immediately"
        return "Call client directly — do not wait for them to re-contact"
    if urgency_level == "priority":
        if status == "new":
            return "Assign and send introduction email / SMS within 4 hours"
        return "Follow up within 24 hours if no response received"
    if status == "new":
        return "Review and assign within 1 business day"
    return "Schedule first session or call within 3 business days"


def generate_insights(referral: dict, programs: list[dict]) -> dict:
    situation    = referral.get("situation", "")
    risk_score   = referral.get("risk_score", 0.1)
    risk_level   = referral.get("risk_level", "low")
    status       = referral.get("status", "new")
    assigned_to  = referral.get("assigned_to")

    themes = detect_themes(situation)
    complexity = compute_complexity(risk_score, themes, situation)
    clinician_fit = compute_clinician_fit(complexity, themes, risk_score)
    workforce_rec = get_workforce_recommendation(clinician_fit)
    urgency = get_urgency(risk_score, themes)
    session_rec = get_session_recommendation(themes)
    next_action = get_next_action(urgency["level"], assigned_to, status)

    # Partner-matched programs (verified Connected to Care partners only)
    from app.ai.program_matcher import match_programs
    matches = match_programs(situation, [p for p in programs if p.get("is_partner", True)], limit=3)

    complexity_label = (
        "High"   if complexity >= 0.65 else
        "Medium" if complexity >= 0.35 else
        "Low"
    )

    # Estimated sessions based on complexity and themes
    base_sessions = 6
    if complexity >= 0.65: base_sessions = 16
    elif complexity >= 0.40: base_sessions = 10
    if "trauma" in themes:     base_sessions += 6
    if "substance_use" in themes: base_sessions += 4
    est_sessions = f"{base_sessions}–{base_sessions + 6} sessions"

    return {
        "complexity_score":   complexity,
        "complexity_label":   complexity_label,
        "clinician_fit":      clinician_fit,
        "workforce_recommendation": workforce_rec,
        "themes":             themes,
        "urgency":            urgency,
        "session_recommendation": session_rec,
        "estimated_sessions": est_sessions,
        "next_action":        next_action,
        "matched_programs":   [m.__dict__ for m in matches],
        "senior_required":    bool(set(themes) & SENIOR_REQUIRED_THEMES),
        "notes": (
            "This case has SENIOR-REQUIRED themes — assign to Kara Thomson or The Rosewood Centre."
            if bool(set(themes) & SENIOR_REQUIRED_THEMES)
            else f"Case complexity is {complexity_label.lower()} — {base_sessions}-session engagement expected."
        ),
    }
