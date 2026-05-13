from __future__ import annotations

from datetime import datetime, time
from itertools import count

from app.ai.program_matcher import match_programs
from app.ai.risk_engine import assess_risk

# ── ID counters ──────────────────────────────────────────────
_escalation_ids   = count(1)
_audit_log_ids    = count(1)
_referral_ids     = count(126)   # next auto ID after seeded data
_conversation_ids = count(503)  # seeded conversations use 500-502
_staff_ids        = count(6)     # next after seeded staff (1-5)


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _dt(s: str) -> str:
    return s  # pre-formatted ISO strings


# ── Master data: programs ────────────────────────────────────
PROGRAMS = [
    {
        "id": 1, "name": "Psychology — Kara Thomson", "provider": "Kara Thomson",
        "category": "psychology",
        "description": "General psychology, distress support, mental health planning, experienced clinician.",
        "specialty": "General", "capacity": 12, "current_load": 7,
        "connected_to_care_url": "https://www.connectedtocare.com.au",
    },
    {
        "id": 2, "name": "Kintsugi OT", "provider": "Nicholas Volcan",
        "category": "occupational_therapy",
        "description": "Neurodivergent specialist — autism, ADHD, occupational therapy and practical functioning support.",
        "specialty": "Neurodivergent", "capacity": 10, "current_load": 6,
        "connected_to_care_url": "https://www.connectedtocare.com.au",
    },
    {
        "id": 3, "name": "Walk Within", "provider": "Daniel Ebbin",
        "category": "counselling",
        "description": "Transpersonal therapy, meaning, identity, life transitions and emotional exploration.",
        "specialty": "Transpersonal", "capacity": 9, "current_load": 5,
        "connected_to_care_url": "https://www.connectedtocare.com.au",
    },
    {
        "id": 4, "name": "Art Therapy", "provider": "Chelsea Arnold",
        "category": "counselling",
        "description": "Creative and expressive therapy — ideal for people who find talking difficult.",
        "specialty": "Creative/expressive", "capacity": 8, "current_load": 3,
        "connected_to_care_url": "https://www.connectedtocare.com.au",
    },
    {
        "id": 5, "name": "Constructive Thinking", "provider": "Candice Sherriff",
        "category": "counselling",
        "description": "General counselling — coping strategies, relationship stress, anxiety and depression.",
        "specialty": "General counselling", "capacity": 15, "current_load": 8,
        "connected_to_care_url": "https://www.connectedtocare.com.au",
    },
    {
        "id": 6, "name": "Well Education", "provider": "Laura Collison",
        "category": "education",
        "description": "Wellbeing education, psychoeducation, workshops and health literacy.",
        "specialty": "Wellbeing education", "capacity": 18, "current_load": 9,
        "connected_to_care_url": "https://www.connectedtocare.com.au",
    },
    {
        "id": 7, "name": "Bright Feathers Counselling", "provider": "Mel Sebastian",
        "category": "education",
        "description": "Educational consulting, youth support, school navigation and learning-related wellbeing.",
        "specialty": "Educational consulting", "capacity": 8, "current_load": 4,
        "connected_to_care_url": "https://www.connectedtocare.com.au",
    },
    {
        "id": 8, "name": "The Rosewood Centre", "provider": "Clinical psychologists",
        "category": "psychology",
        "description": "Complex presentations, high-risk cases, suicide prevention, trauma-informed clinical psychology.",
        "specialty": "Complex/high-risk", "capacity": 7, "current_load": 6,
        "connected_to_care_url": "https://www.connectedtocare.com.au",
    },
    {
        "id": 9, "name": "Phoenix Assist", "provider": "Phoenix Assist",
        "category": "NDIS",
        "description": "NDIS support coordination — disability services, navigation and plan implementation.",
        "specialty": "NDIS coordination", "capacity": 14, "current_load": 10,
        "connected_to_care_url": "https://www.connectedtocare.com.au",
    },
    {
        "id": 10, "name": "Gamble Aware", "provider": "Simon Shields",
        "category": "gambling",
        "description": "Financial and gambling counselling — debt stress, gambling harm and recovery planning.",
        "specialty": "Gambling/financial", "capacity": 11, "current_load": 4,
        "connected_to_care_url": "https://www.connectedtocare.com.au",
    },
    {
        "id": 11, "name": "Fearless Therapies", "provider": "Amy Harrison",
        "category": "counselling",
        "description": "General therapy — emotional regulation, trauma-informed support and practical wellbeing.",
        "specialty": "General therapy", "capacity": 10, "current_load": 6,
        "connected_to_care_url": "https://www.connectedtocare.com.au",
    },
    {
        "id": 12, "name": "Top Blokes Foundation", "provider": "Top Blokes Foundation",
        "category": "peer_support",
        "description": "Men's mental health — young men, peer connection, confidence and healthy relationships.",
        "specialty": "Men's mental health", "capacity": 20, "current_load": 13,
        "connected_to_care_url": "https://www.connectedtocare.com.au",
    },
    {
        "id": 13, "name": "SandWaves Therapy", "provider": "Michael Bourke",
        "category": "counselling",
        "description": "Therapy services — emotional wellbeing, resilience and accessible counselling.",
        "specialty": "General therapy", "capacity": 12, "current_load": 5,
        "connected_to_care_url": "https://www.connectedtocare.com.au",
    },
    {
        "id": 14, "name": "Name.Narrate.Navigate", "provider": "Name.Narrate.Navigate",
        "category": "counselling",
        "description": "Narrative therapy — making sense of personal stories, identity and life transitions.",
        "specialty": "Narrative therapy", "capacity": 8, "current_load": 3,
        "connected_to_care_url": "https://www.connectedtocare.com.au",
    },
]

# ── Staff ────────────────────────────────────────────────────
STAFF = [
    {"id": 1, "name": "Bradley", "role": "CEO", "email": "ceo@lmnspn.org.au",
     "can_handle_high_risk": True, "is_on_call": False, "max_caseload": 10, "can_manage_staff": True},
    {"id": 2, "name": "Cameron", "role": "Support worker", "email": "cameron@lmnspn.org.au",
     "can_handle_high_risk": False, "is_on_call": True, "max_caseload": 20, "can_manage_staff": False},
    {"id": 3, "name": "Teyarnee", "role": "Support worker & suicide prevention peer worker",
     "email": "teyarnee@lmnspn.org.au",
     "can_handle_high_risk": True, "is_on_call": True, "max_caseload": 15, "can_manage_staff": False},
    {"id": 4, "name": "Jane", "role": "Community engagement & fundraising co-ordinator",
     "email": "jane@lmnspn.org.au",
     "can_handle_high_risk": False, "is_on_call": False, "max_caseload": 12, "can_manage_staff": False},
    {"id": 5, "name": "Kara Thomson", "role": "Psychologist",
     "email": "kara@lmnspn.org.au",
     "can_handle_high_risk": True, "is_on_call": False, "max_caseload": 12, "can_manage_staff": False},
]

# ── Volunteers ───────────────────────────────────────────────
VOLUNTEERS = [
    {"id": 1, "name": "Alex M", "email": "alexm@vol.lmnspn.org.au",
     "skills": ["admin", "market stalls"], "availability": "Mon AM, Thu PM",
     "training_status": "basic", "total_hours": 42, "is_active": True},
    {"id": 2, "name": "Sam R", "email": "samr@vol.lmnspn.org.au",
     "skills": ["peer support", "events"], "availability": "Wed PM, Sat AM",
     "training_status": "advanced", "total_hours": 67, "is_active": True},
    {"id": 3, "name": "Priya L", "email": "priya@vol.lmnspn.org.au",
     "skills": ["fundraising", "community outreach"], "availability": "Tue PM",
     "training_status": "basic", "total_hours": 24, "is_active": True},
    {"id": 4, "name": "Jordan K", "email": "jordank@vol.lmnspn.org.au",
     "skills": ["social media", "graphic design"], "availability": "Flexible",
     "training_status": "pending", "total_hours": 8, "is_active": True},
    {"id": 5, "name": "Mei-Ling W", "email": "meilingw@vol.lmnspn.org.au",
     "skills": ["peer support", "CALD community"], "availability": "Mon PM, Fri AM",
     "training_status": "advanced", "total_hours": 91, "is_active": True},
]

# ── Seed referrals (25 total) ────────────────────────────────
# Distribution: 5 new, 4 assigned, 7 contacted, 6 in_program, 3 follow_up
# Risk: 15 low, 7 medium, 3 high
# Sources: gaming, pub, GP, self, friend, family, school, agency

REFERRALS = [
    # ── NEW (5) ──────────────────────────────────────────────
    {
        "id": 101, "client_name": "Sarah T",
        "referrer_name": "Charlestown Gaming Centre", "referrer_type": "gaming_centre",
        "referrer_contact": "manager@charlestowngc.example", "source_tag": "charlestown-gaming",
        "suburb": "Charlestown",
        "situation": "A young woman was visibly distressed near the gaming room and said everything feels pointless. Staff are worried she is alone tonight.",
        "risk_level": "high", "risk_score": 0.83, "status": "new", "assigned_to": 3,
        "matched_program": 8,
        "created_at": "2026-05-12T23:47:00",
        "ai_assessment": {"summary": "Immediate human review recommended. Crisis resources should stay visible.", "flags": ["High-risk phrase: pointless", "Elevated concern: alone"]},
    },
    {
        "id": 102, "client_name": "James W",
        "referrer_name": None, "referrer_type": "self",
        "referrer_contact": "jamesw@example.com", "source_tag": "chat-widget",
        "suburb": "Mayfield",
        "situation": "I've been having panic attacks every morning before work. My partner doesn't understand and I'm scared I'm going to lose my job. Can't sleep either.",
        "risk_level": "medium", "risk_score": 0.55, "status": "new", "assigned_to": 2,
        "matched_program": 5,
        "created_at": "2026-05-12T07:12:00",
        "ai_assessment": {"summary": "Elevated distress detected. Notify on-call staff and prioritise follow-up.", "flags": ["Elevated concern: scared", "Elevated concern: can't sleep"]},
    },
    {
        "id": 103, "client_name": "Emma G",
        "referrer_name": "Northlakes High School", "referrer_type": "school",
        "referrer_contact": "counsellor@northlakeshs.edu.au", "source_tag": "mayfield-school",
        "suburb": "Elermore Vale",
        "situation": "17-year-old student showing signs of social withdrawal, declining grades. Has mentioned to a friend that she 'wants it all to stop'. Parents contacted, concerned.",
        "risk_level": "high", "risk_score": 0.78, "status": "new", "assigned_to": 3,
        "matched_program": 8,
        "created_at": "2026-05-12T14:30:00",
        "ai_assessment": {"summary": "Immediate human review recommended. Possible suicidal ideation language.", "flags": ["High-risk phrase: wants it all to stop", "Elevated concern: withdrawal"]},
    },
    {
        "id": 104, "client_name": "Terry O",
        "referrer_name": "Mate from footy", "referrer_type": "friend",
        "referrer_contact": "0412 000 000", "source_tag": "hamilton-pub",
        "suburb": "Hamilton",
        "situation": "My mate Terry has been drinking heaps since losing his job at the mine. He's been isolating himself and snapped at his kids last week. Not himself at all.",
        "risk_level": "medium", "risk_score": 0.49, "status": "new", "assigned_to": 2,
        "matched_program": 12,
        "created_at": "2026-05-11T21:05:00",
        "ai_assessment": {"summary": "Elevated distress detected. Employment stress and social isolation.", "flags": ["Elevated concern: isolating", "Elevated concern: drinking"]},
    },
    {
        "id": 105, "client_name": "Grace N",
        "referrer_name": None, "referrer_type": "self",
        "referrer_contact": "grace.n@example.com", "source_tag": "chat-widget",
        "suburb": "Belmont",
        "situation": "Looking for someone to talk to about feeling overwhelmed since having my second baby. My partner works nights and I'm exhausted all the time.",
        "risk_level": "low", "risk_score": 0.22, "status": "new", "assigned_to": 4,
        "matched_program": 5,
        "created_at": "2026-05-12T10:44:00",
        "ai_assessment": {"summary": "Routine support request. Queue for next business-day follow-up.", "flags": ["Elevated concern: overwhelmed"]},
    },

    # ── ASSIGNED (4) ─────────────────────────────────────────
    {
        "id": 106, "client_name": "Mike D",
        "referrer_name": "Elermore Vale Medical Centre", "referrer_type": "gp",
        "referrer_contact": "gp@elermorevalemed.example", "source_tag": "elermore-gp",
        "suburb": "Elermore Vale",
        "situation": "Middle-aged man with gambling debt, worsening anxiety and relationship breakdown. GP recommends counselling and financial support. History of depression.",
        "risk_level": "medium", "risk_score": 0.61, "status": "assigned", "assigned_to": 3,
        "matched_program": 10,
        "created_at": "2026-05-10T09:20:00",
        "ai_assessment": {"summary": "Elevated distress detected. Gambling and financial stress indicators.", "flags": ["Elevated concern: gambling", "Elevated concern: debt", "Elevated concern: depression"]},
    },
    {
        "id": 107, "client_name": "Nathan P",
        "referrer_name": "Hamilton Hotel", "referrer_type": "community_org",
        "referrer_contact": "manager@hamiltonhotel.example", "source_tag": "hamilton-pub",
        "suburb": "Hamilton",
        "situation": "Regular patron, early 30s, has been increasingly distressed. Tonight told bar staff he 'has nothing left to live for' after breakup. Seemed very intoxicated but genuine.",
        "risk_level": "high", "risk_score": 0.88, "status": "assigned", "assigned_to": 3,
        "matched_program": 8,
        "created_at": "2026-05-11T22:30:00",
        "ai_assessment": {"summary": "Immediate human review recommended. Direct suicidal language.", "flags": ["High-risk phrase: nothing left to live for", "Elevated concern: intoxicated"]},
    },
    {
        "id": 108, "client_name": "Lena S",
        "referrer_name": "Cessnock Community Connect", "referrer_type": "agency",
        "referrer_contact": "outreach@ccc.example", "source_tag": "cessnock-agency",
        "suburb": "Cessnock",
        "situation": "Single mother, 3 kids, recently evicted. Significant financial stress and signs of depression. Has NDIS plan but says it's confusing to navigate.",
        "risk_level": "medium", "risk_score": 0.53, "status": "assigned", "assigned_to": 2,
        "matched_program": 9,
        "created_at": "2026-05-09T11:15:00",
        "ai_assessment": {"summary": "Elevated distress. NDIS navigation needed alongside emotional support.", "flags": ["Elevated concern: depression", "Elevated concern: financial stress"]},
    },
    {
        "id": 109, "client_name": "Raj M",
        "referrer_name": "Family member", "referrer_type": "family",
        "referrer_contact": "0418 000 000", "source_tag": "qr-community",
        "suburb": "Maitland",
        "situation": "My brother hasn't left his room in two weeks. He came back from overseas and everything changed. He won't talk to us and I don't know what to do.",
        "risk_level": "medium", "risk_score": 0.44, "status": "assigned", "assigned_to": 2,
        "matched_program": 3,
        "created_at": "2026-05-08T16:22:00",
        "ai_assessment": {"summary": "Elevated distress detected. Social withdrawal and possible adjustment disorder.", "flags": ["Elevated concern: withdrawal"]},
    },

    # ── CONTACTED (7) ────────────────────────────────────────
    {
        "id": 110, "client_name": "Alex B",
        "referrer_name": None, "referrer_type": "self",
        "referrer_contact": "alex.b@example.com", "source_tag": "chat-widget",
        "suburb": "Jesmond",
        "situation": "Looking for someone to talk to about anxiety, study pressure and feeling isolated after moving suburbs. First year at uni.",
        "risk_level": "low", "risk_score": 0.27, "status": "contacted", "assigned_to": 4,
        "matched_program": 5,
        "created_at": "2026-05-07T15:10:00",
        "ai_assessment": {"summary": "Routine support request. Queue for next business-day follow-up.", "flags": []},
    },
    {
        "id": 111, "client_name": "Tracey F",
        "referrer_name": "Swansea Medical Centre", "referrer_type": "gp",
        "referrer_contact": "gp@swanseamed.example", "source_tag": "swansea-gp",
        "suburb": "Swansea",
        "situation": "Long-term carer for husband with dementia. GP concerned about carer burnout and depression. Patient has not sought mental health support before.",
        "risk_level": "low", "risk_score": 0.31, "status": "contacted", "assigned_to": 4,
        "matched_program": 5,
        "created_at": "2026-05-06T10:05:00",
        "ai_assessment": {"summary": "Routine support. Carer stress and possible burnout.", "flags": ["Elevated concern: depression"]},
    },
    {
        "id": 112, "client_name": "Connor A",
        "referrer_name": "Rutherford High School", "referrer_type": "school",
        "referrer_contact": "wellbeing@rutherfordhs.edu.au", "source_tag": "maitland-school",
        "suburb": "Rutherford",
        "situation": "Year 10 student referred by school counsellor. Significant bullying, self-harm history (last incident 3 weeks ago), and ADHD diagnosis. Parents supportive.",
        "risk_level": "medium", "risk_score": 0.66, "status": "contacted", "assigned_to": 3,
        "matched_program": 2,
        "created_at": "2026-05-05T09:30:00",
        "ai_assessment": {"summary": "Elevated distress. Self-harm history needs specialist response.", "flags": ["Elevated concern: self-harm", "Elevated concern: bullying"]},
    },
    {
        "id": 113, "client_name": "Patricia V",
        "referrer_name": "Port Stephens Community Health", "referrer_type": "agency",
        "referrer_contact": "psch@example.org", "source_tag": "port-stephens-agency",
        "suburb": "Salamander Bay",
        "situation": "Elderly woman, 72, recently widowed. Lives alone in a rural area. Very isolated. Community health nurse flagged significant depression and grief.",
        "risk_level": "medium", "risk_score": 0.51, "status": "contacted", "assigned_to": 2,
        "matched_program": 5,
        "created_at": "2026-05-04T14:45:00",
        "ai_assessment": {"summary": "Elevated distress. Grief and rural isolation.", "flags": ["Elevated concern: isolated", "Elevated concern: depression"]},
    },
    {
        "id": 114, "client_name": "Shane R",
        "referrer_name": None, "referrer_type": "self",
        "referrer_contact": "0408 000 000", "source_tag": "qr-community",
        "suburb": "Lambton",
        "situation": "I've been using more weed to cope with stress at work. Partner thinks I have a problem. I don't know if I do but things are getting worse.",
        "risk_level": "low", "risk_score": 0.25, "status": "contacted", "assigned_to": 4,
        "matched_program": 5,
        "created_at": "2026-05-03T18:20:00",
        "ai_assessment": {"summary": "Routine support. Substance use linked to work stress.", "flags": []},
    },
    {
        "id": 115, "client_name": "Olivia C",
        "referrer_name": "Friend", "referrer_type": "friend",
        "referrer_contact": "0422 000 000", "source_tag": "qr-community",
        "suburb": "Charlestown",
        "situation": "My friend has been acting really different since a bad breakup 2 months ago. Barely eating, barely leaving home. She told me she 'just doesn't see the point anymore'.",
        "risk_level": "medium", "risk_score": 0.59, "status": "contacted", "assigned_to": 3,
        "matched_program": 5,
        "created_at": "2026-05-02T20:15:00",
        "ai_assessment": {"summary": "Elevated distress. Passive suicidal ideation language noted.", "flags": ["Elevated concern: doesn't see the point", "Elevated concern: withdrawing"]},
    },
    {
        "id": 116, "client_name": "Tom H",
        "referrer_name": "Morisset Gaming Lounge", "referrer_type": "gaming_centre",
        "referrer_contact": "manager@morissetgaming.example", "source_tag": "morisset-gaming",
        "suburb": "Morisset",
        "situation": "Regular customer, mid-40s, visibly emotional tonight. Said he's 'in over his head' with debt and his family doesn't know. Staff think he needs help.",
        "risk_level": "low", "risk_score": 0.38, "status": "contacted", "assigned_to": 4,
        "matched_program": 10,
        "created_at": "2026-05-01T19:55:00",
        "ai_assessment": {"summary": "Routine support. Financial stress and shame around debt.", "flags": ["Elevated concern: debt"]},
    },

    # ── IN PROGRAM (6) ───────────────────────────────────────
    {
        "id": 117, "client_name": "Natalie B",
        "referrer_name": "Belmont Medical Practice", "referrer_type": "gp",
        "referrer_contact": "gp@belmontmed.example", "source_tag": "belmont-gp",
        "suburb": "Belmont",
        "situation": "Young woman with long history of anxiety and trauma. GP has been managing but feels she needs structured psychological support. Willing to engage.",
        "risk_level": "low", "risk_score": 0.28, "status": "in_program", "assigned_to": 5,
        "matched_program": 1,
        "created_at": "2026-04-28T09:00:00",
        "ai_assessment": {"summary": "Routine support. Structured psychology referral.", "flags": []},
    },
    {
        "id": 118, "client_name": "Dion S",
        "referrer_name": None, "referrer_type": "self",
        "referrer_contact": "dions@example.com", "source_tag": "chat-widget",
        "suburb": "Cessnock",
        "situation": "I was a miner for 20 years. My pit closed 18 months ago and I haven't found anything since. I feel useless. My wife is working and I just sit at home.",
        "risk_level": "medium", "risk_score": 0.48, "status": "in_program", "assigned_to": 3,
        "matched_program": 12,
        "created_at": "2026-04-25T11:30:00",
        "ai_assessment": {"summary": "Elevated distress. Unemployment grief and identity loss.", "flags": ["Elevated concern: useless"]},
    },
    {
        "id": 119, "client_name": "Maya T",
        "referrer_name": "Hunter Valley Grammar", "referrer_type": "school",
        "referrer_contact": "wellbeing@hvg.edu.au", "source_tag": "maitland-school",
        "suburb": "East Maitland",
        "situation": "Year 12 student, very high-achieving, showing signs of perfectionism and severe anxiety about HSC. Parents report she's sleeping 3-4 hours a night.",
        "risk_level": "low", "risk_score": 0.29, "status": "in_program", "assigned_to": 4,
        "matched_program": 7,
        "created_at": "2026-04-22T14:00:00",
        "ai_assessment": {"summary": "Routine support. HSC anxiety and perfectionism.", "flags": []},
    },
    {
        "id": 120, "client_name": "Bill J",
        "referrer_name": "RSL Newcastle", "referrer_type": "community_org",
        "referrer_contact": "admin@newcastlersl.example", "source_tag": "community-org",
        "suburb": "Newcastle",
        "situation": "Vietnam veteran, 74. Family noticed increased agitation and nightmares. RSL welfare officer suspects PTSD-related deterioration. Has no existing mental health supports.",
        "risk_level": "low", "risk_score": 0.32, "status": "in_program", "assigned_to": 5,
        "matched_program": 1,
        "created_at": "2026-04-18T10:20:00",
        "ai_assessment": {"summary": "Routine support. Veteran trauma, referred to psychology.", "flags": []},
    },
    {
        "id": 121, "client_name": "Jess K",
        "referrer_name": "Sister", "referrer_type": "family",
        "referrer_contact": "0416 000 000", "source_tag": "qr-community",
        "suburb": "Charlestown",
        "situation": "My sister has ADHD and just lost her support worker. She's really struggling with daily tasks and is becoming more anxious. She needs someone who understands neurodiversity.",
        "risk_level": "low", "risk_score": 0.19, "status": "in_program", "assigned_to": 4,
        "matched_program": 2,
        "created_at": "2026-04-15T13:40:00",
        "ai_assessment": {"summary": "Routine support. NDIS and neurodivergent specialist needed.", "flags": []},
    },
    {
        "id": 122, "client_name": "Andre L",
        "referrer_name": "Hamilton Pub", "referrer_type": "community_org",
        "referrer_contact": "bar@hamiltonpub.example", "source_tag": "hamilton-pub",
        "suburb": "Hamilton",
        "situation": "Man in his late 20s, came in tonight and told the barman he'd been spending thousands gambling and doesn't know how to stop. Seems genuinely scared.",
        "risk_level": "low", "risk_score": 0.35, "status": "in_program", "assigned_to": 4,
        "matched_program": 10,
        "created_at": "2026-04-10T21:30:00",
        "ai_assessment": {"summary": "Routine support. Gambling addiction, financial counselling needed.", "flags": ["Elevated concern: gambling", "Elevated concern: scared"]},
    },

    # ── FOLLOW-UP (3) ────────────────────────────────────────
    {
        "id": 123, "client_name": "Yvonne M",
        "referrer_name": "Elermore Vale Medical Centre", "referrer_type": "gp",
        "referrer_contact": "gp@elermorevalemed.example", "source_tag": "elermore-gp",
        "suburb": "Elermore Vale",
        "situation": "GP follow-up. Patient completed 6 sessions of counselling, reports good progress. Needs check-in and possible further referral for ongoing support.",
        "risk_level": "low", "risk_score": 0.12, "status": "follow_up", "assigned_to": 4,
        "matched_program": 5,
        "created_at": "2026-04-01T10:00:00",
        "ai_assessment": {"summary": "Routine follow-up. Good progress reported.", "flags": []},
    },
    {
        "id": 124, "client_name": "Pat D",
        "referrer_name": None, "referrer_type": "self",
        "referrer_contact": "patd@example.com", "source_tag": "chat-widget",
        "suburb": "Swansea",
        "situation": "Following up after initial intake. Pat has started with the Constructive Thinking program and is reporting improved mood. Checking in to confirm continued engagement.",
        "risk_level": "low", "risk_score": 0.08, "status": "follow_up", "assigned_to": 4,
        "matched_program": 5,
        "created_at": "2026-03-25T14:30:00",
        "ai_assessment": {"summary": "Positive outcome. Monitoring engagement.", "flags": []},
    },
    {
        "id": 125, "client_name": "Leo F",
        "referrer_name": "Community Sports Club", "referrer_type": "community_org",
        "referrer_contact": "admin@charlestownsc.example", "source_tag": "charlestown-gaming",
        "suburb": "Charlestown",
        "situation": "Young man referred by coach after disclosing suicidal thoughts last month. Now in ongoing sessions with Rosewood Centre. Follow-up to confirm wellbeing.",
        "risk_level": "low", "risk_score": 0.17, "status": "follow_up", "assigned_to": 3,
        "matched_program": 8,
        "created_at": "2026-03-18T09:15:00",
        "ai_assessment": {"summary": "Active monitoring. High-risk case now stabilised and in program.", "flags": []},
    },
]

# ── Conversations ────────────────────────────────────────────
CONVERSATIONS = [
    {
        "id": 500,
        "referral_id": 101,
        "channel": "chat",
        "is_after_hours": True,
        "messages": [
            {"role": "client", "content": "I don't know if anyone can help me. Everything feels pointless right now.", "created_at": "2026-05-12T23:48:00"},
            {"role": "ai",     "content": "I'm really glad you reached out. That sounds incredibly heavy to be carrying. If you're in immediate danger, please call 000 right now or Lifeline on 13 11 14. I'm also flagging this so someone from our team can follow up with you urgently. Can you tell me a little more about what's going on tonight?", "created_at": "2026-05-12T23:48:08"},
            {"role": "client", "content": "I've just been feeling like no one cares. Like I'm a burden to everyone around me.", "created_at": "2026-05-12T23:49:20"},
            {"role": "ai",     "content": "Feeling like a burden is one of the hardest things to carry — and it's a feeling that tends to lie to us. The fact that you're here, talking, tells me there's still a part of you reaching for something different. Is there anyone with you right now?", "created_at": "2026-05-12T23:49:28"},
            {"role": "client", "content": "No, I'm by myself. I don't really have anyone to call.", "created_at": "2026-05-12T23:51:00"},
            {"role": "ai",     "content": "You reached out here, and that matters. Would you be willing to call Lifeline on 13 11 14 right now? They have real people available 24/7 who are trained for exactly this. I'll stay here with you while you do.", "created_at": "2026-05-12T23:51:05"},
        ],
    },
    {
        "id": 501,
        "referral_id": 110,
        "channel": "chat",
        "is_after_hours": False,
        "messages": [
            {"role": "client", "content": "Hi, I'm not sure if this is the right place but I've been really anxious lately.", "created_at": "2026-05-07T15:10:00"},
            {"role": "ai",     "content": "Hi! You've come to exactly the right place. I'm PathFinder, an AI support guide for the Evolve Hub. I'm here to listen and help you find the right support. What's been going on for you?", "created_at": "2026-05-07T15:10:05"},
            {"role": "client", "content": "I moved for uni and I don't know anyone. The course is really intense and I've been having panic attacks.", "created_at": "2026-05-07T15:11:30"},
            {"role": "ai",     "content": "That sounds really overwhelming — a new city, new demands, and feeling cut off from your usual support. Panic attacks can be really frightening on top of everything else. How long has this been going on?", "created_at": "2026-05-07T15:11:38"},
            {"role": "client", "content": "About two months. It's getting worse, not better.", "created_at": "2026-05-07T15:12:45"},
            {"role": "ai",     "content": "Thanks for sharing that. Two months is a while to carry this. Based on what you've told me, I think you'd benefit from someone to talk to regularly — I've found a couple of programs at the Evolve Hub that could be a good fit. Would it help to know a bit more about them?", "created_at": "2026-05-07T15:12:52"},
        ],
    },
    {
        "id": 502,
        "referral_id": 118,
        "channel": "chat",
        "is_after_hours": False,
        "messages": [
            {"role": "client", "content": "I was a miner for 20 years. The pit closed and I don't know who I am anymore.", "created_at": "2026-04-25T11:30:00"},
            {"role": "ai",     "content": "Twenty years in one place — that's not just a job, that's an identity. Losing that is a real loss, and it makes sense you're feeling unmoored. What does a typical day look like for you now?", "created_at": "2026-04-25T11:30:08"},
            {"role": "client", "content": "I just sit at home while my wife goes to work. I feel completely useless.", "created_at": "2026-04-25T11:32:00"},
            {"role": "ai",     "content": "That gap between who you were and where you are now is brutal. Feeling useless doesn't mean you are — it means the context around you has changed and hasn't caught up yet. Have you had anyone to talk to about this?", "created_at": "2026-04-25T11:32:07"},
        ],
    },
]

# ── Escalation and audit state ───────────────────────────────
ESCALATION_LOGS: list[dict] = []
AUDIT_LOG: list[dict] = []


# ── Helpers ──────────────────────────────────────────────────

def is_after_hours() -> bool:
    now = datetime.now().time()
    return now < time(9, 0) or now > time(17, 0)


def create_escalation_log(conversation_id: int, risk_assessment) -> dict:
    now = _now()
    escalation = {
        "id": next(_escalation_ids),
        "conversation_id": conversation_id,
        "risk_level": risk_assessment.level,
        "risk_score": risk_assessment.score,
        "layer_1_displayed": True,
        "layer_1_timestamp": now,
        "layer_2_sent_to": [],
        "layer_2_timestamp": now,
        "layer_2_methods": [],
        "layer_3_check_timestamp": None,
        "layer_3_triggered": False,
        "layer_4_check_timestamp": None,
        "layer_4_triggered": False,
        "acknowledged_by": None,
        "acknowledged_at": None,
        "resolved": False,
        "resolved_by": None,
        "resolved_at": None,
        "resolution_notes": "",
        "is_system_failure": False,
        "failure_reason": "",
        "post_incident_review_required": False,
    }
    ESCALATION_LOGS.append(escalation)
    log_audit_event("escalation", None, "HIGH_RISK_DETECTED", conversation_id, {
        "risk_score": risk_assessment.score,
        "keywords": risk_assessment.keywords_detected,
        "escalation_id": escalation["id"],
    })
    return escalation


def notify_staff_high_risk(escalation_id: int, staff_list: list[dict]) -> dict:
    escalation = next((e for e in ESCALATION_LOGS if e["id"] == escalation_id), None)
    if not escalation or escalation["risk_level"] != "high":
        return {"error": "Invalid escalation"}

    on_call_staff = [s for s in staff_list if s.get("is_on_call")]
    ceo = next((s for s in staff_list if s["role"] == "CEO"), None)
    notified_ids = list({s["id"] for s in (on_call_staff + ([ceo] if ceo else []))})

    escalation["layer_2_sent_to"] = notified_ids
    escalation["layer_2_methods"] = ["email", "web_push"]

    log_audit_event("escalation", None, "STAFF_NOTIFIED", escalation_id, {
        "sent_to": notified_ids, "methods": escalation["layer_2_methods"],
    })
    return {"escalation_id": escalation_id, "sent_to": notified_ids,
            "methods": escalation["layer_2_methods"], "timestamp": _now()}


def check_escalation_acknowledgment(escalation_id: int, timeout_minutes: int = 5) -> dict:
    escalation = next((e for e in ESCALATION_LOGS if e["id"] == escalation_id), None)
    if not escalation or escalation["acknowledged_at"]:
        return {"already_acknowledged": True}

    layer_2_time = datetime.fromisoformat(escalation["layer_2_timestamp"])
    time_elapsed = (datetime.now() - layer_2_time).total_seconds() / 60
    result = {"escalation_id": escalation_id, "time_elapsed_minutes": round(time_elapsed, 1), "action_taken": None}

    if time_elapsed >= 15:
        escalation.update({
            "layer_4_check_timestamp": _now(), "layer_4_triggered": True,
            "is_system_failure": True,
            "failure_reason": "Unacknowledged high-risk escalation for 15+ minutes",
            "post_incident_review_required": True,
        })
        result["action_taken"] = "SMS_CEO_AND_LOG_FAILURE"
        log_audit_event("escalation", None, "SYSTEM_FAILURE_LOGGED", escalation_id, {
            "reason": escalation["failure_reason"], "layer": 4,
            "time_elapsed_minutes": round(time_elapsed, 1),
        })
    elif time_elapsed >= 5:
        escalation.update({"layer_3_check_timestamp": _now(), "layer_3_triggered": True})
        result["action_taken"] = "RE_ALERT_ALL_STAFF"
        log_audit_event("escalation", None, "LAYER_3_TRIGGERED", escalation_id, {
            "reason": "No acknowledgment within 5 minutes",
            "time_elapsed_minutes": round(time_elapsed, 1),
        })
    return result


def acknowledge_escalation(escalation_id: int, staff_id: int) -> dict:
    escalation = next((e for e in ESCALATION_LOGS if e["id"] == escalation_id), None)
    if not escalation:
        return {"error": "Escalation not found"}
    escalation["acknowledged_by"] = staff_id
    escalation["acknowledged_at"] = _now()
    layer_2_time = datetime.fromisoformat(escalation["layer_2_timestamp"])
    ack_time = datetime.fromisoformat(escalation["acknowledged_at"])
    response_seconds = int((ack_time - layer_2_time).total_seconds())
    log_audit_event("escalation", staff_id, "ESCALATION_ACKNOWLEDGED", escalation_id, {
        "response_time_seconds": response_seconds,
    })
    return {"escalation_id": escalation_id, "acknowledged_by": staff_id,
            "acknowledged_at": escalation["acknowledged_at"],
            "response_time_seconds": response_seconds}


def log_audit_event(event_type: str, actor_id: int | None, action: str,
                    resource_id: int, details: dict | None = None) -> None:
    AUDIT_LOG.append({
        "id": next(_audit_log_ids),
        "timestamp": _now(),
        "event_type": event_type,
        "actor_id": actor_id,
        "action": action,
        "resource_id": resource_id,
        "details": details or {},
    })


def create_referral(payload: dict) -> dict:
    situation = payload.get("situation", "")
    assessment = assess_risk(situation, payload.get("urgency"))
    matches = match_programs(situation, PROGRAMS, risk_level=assessment.level, emotions=assessment.emotions)
    # Route high-risk to Teyarnee (handles high-risk), medium to Cameron, low to Jane
    staff_id = 3 if assessment.level == "high" else 2 if assessment.level == "medium" else 4
    if assessment.level == "high":
        staff_id = 3  # Teyarnee — suicide prevention peer worker
    referral = {
        "id": next(_referral_ids),
        "client_name": payload.get("client_name") or payload.get("their_first_name") or "Unknown",
        "referrer_name": payload.get("referrer_name") or "Self referral",
        "referrer_type": payload.get("referrer_type") or "self",
        "referrer_contact": payload.get("referrer_contact") or payload.get("contact") or "",
        "source_tag": payload.get("source_tag") or "web",
        "suburb": payload.get("suburb") or "",
        "situation": situation,
        "risk_level": assessment.level,
        "risk_score": assessment.score,
        "status": "new",
        "assigned_to": staff_id,
        "matched_program": matches[0].id if matches else None,
        "created_at": _now(),
        "ai_assessment": {
            "summary": assessment.summary,
            "flags": assessment.flags,
            "emotions": assessment.emotions,
            "matches": [m.__dict__ for m in matches],
        },
    }
    REFERRALS.insert(0, referral)
    return referral


def _fallback_chat_reply(message: str, assessment) -> str:
    lowered = message.lower()

    if assessment.level == "high":
        return (
            "I'm really glad you reached out. If you are in immediate danger right now, "
            "please call 000. Lifeline is available 24/7 on 13 11 14, with real people "
            "there right now. Are you safe right now?"
        )

    if any(phrase in lowered for phrase in ["no one loves me", "nobody loves me", "unlovable", "unloved", "no one likes me"]):
        return (
            "That sounds really painful, and I'm glad you told me. Feeling unloved can make "
            "the moment feel very heavy, but you do not have to sit with it alone here. "
            "Are you safe right now, and would you like to tell me what happened today?"
        )

    if assessment.level == "medium":
        return (
            "That sounds really difficult. You don't have to sort it all out tonight. "
            "I'm here with you, and I can help connect you with a person if that would help. "
            "What is making things feel hardest right now?"
        )

    return (
        "Thank you for telling me. I'm here with you, and we can take this one step at a time. "
        "Would it help to talk through what has been happening, or would you prefer I help find "
        "someone from the Evolve Hub team to contact you?"
    )


def create_chat_turn(message: str, conversation_id: int | None = None, ai_reply: str | None = None) -> dict:
    assessment = assess_risk(message)
    matches = match_programs(message, PROGRAMS, risk_level=assessment.level, emotions=assessment.emotions)

    if ai_reply is None:
        # Fallback replies (used when Azure OpenAI is not configured)
        ai_reply = _fallback_chat_reply(message, assessment)

    if conversation_id is None:
        conversation_id = next(_conversation_ids)
        CONVERSATIONS.append({
            "id": conversation_id, "referral_id": None,
            "channel": "chat", "is_after_hours": is_after_hours(),
            "peak_risk_level": "low", "messages": [],
        })

    _RISK_ORDER = {"low": 0, "medium": 1, "high": 2}

    conversation = next((c for c in CONVERSATIONS if c["id"] == conversation_id), None)
    if conversation:
        # Risk only ever escalates — never drops within a conversation
        peak = conversation.get("peak_risk_level", "low")
        if _RISK_ORDER.get(assessment.level, 0) < _RISK_ORDER.get(peak, 0):
            assessment.level = peak
            assessment.escalation_required = (peak == "high")
            assessment.flags.append(
                f"Risk held at {peak} — crisis language was detected earlier in this conversation"
            )
        else:
            conversation["peak_risk_level"] = assessment.level

        now = _now()
        conversation["messages"].append({"role": "client", "content": message, "created_at": now})
        conversation["messages"].append({"role": "ai",    "content": ai_reply,  "created_at": now})

    escalation_status = None
    if assessment.escalation_required:
        escalation_log = create_escalation_log(conversation_id, assessment)
        notify_result = notify_staff_high_risk(escalation_log["id"], STAFF)
        escalation_status = {**escalation_log,
                              "staff_notified": notify_result.get("sent_to", []),
                              "notification_methods": notify_result.get("methods", [])}

        # Auto-create a referral in the pipeline if this conversation doesn't have one yet
        # so staff can see it immediately in the dashboard without manual entry
        if conversation and not conversation.get("referral_id"):
            client_msgs = [m["content"] for m in conversation.get("messages", []) if m["role"] == "client"]
            situation = " … ".join(client_msgs[-4:]) if client_msgs else message
            auto_ref = {
                "id": next(_referral_ids),
                "client_name": "Chat — anonymous",
                "referrer_name": "PathFinder chatbot",
                "referrer_type": "self",
                "referrer_contact": "",
                "source_tag": "chat-widget",
                "suburb": "",
                "situation": situation,
                "risk_level": assessment.level,
                "risk_score": assessment.score,
                "status": "new",
                "assigned_to": 3,  # Teyarnee — suicide prevention peer worker
                "matched_program": matches[0].id if matches else None,
                "created_at": _now(),
                "ai_assessment": {
                    "summary": assessment.summary,
                    "flags": assessment.flags,
                    "emotions": assessment.emotions,
                    "matches": [m.__dict__ for m in matches],
                },
            }
            REFERRALS.insert(0, auto_ref)
            conversation["referral_id"] = auto_ref["id"]
            escalation_log["referral_id"] = auto_ref["id"]
            escalation_status["referral_id"] = auto_ref["id"]

    return {
        "conversation_id": conversation_id,
        "reply": ai_reply,
        "risk": assessment.__dict__,
        "matches": [m.__dict__ for m in matches],
        "after_hours": is_after_hours(),
        "escalation": escalation_status,
    }


ALLOWED_PERMISSIONS = {"can_manage_staff", "can_handle_high_risk", "is_on_call"}


def create_staff_member(payload: dict) -> dict | str:
    requester = next((s for s in STAFF if s["id"] == payload.get("requested_by")), None)
    if not requester or not requester.get("can_manage_staff"):
        return "not_authorised"
    member = {
        "id": next(_staff_ids),
        "name": payload["name"],
        "role": payload.get("role", "Support worker"),
        "email": payload.get("email", ""),
        "can_handle_high_risk": payload.get("can_handle_high_risk", False),
        "is_on_call": payload.get("is_on_call", False),
        "max_caseload": payload.get("max_caseload", 15),
        "can_manage_staff": False,
    }
    STAFF.append(member)
    log_audit_event("staff", payload["requested_by"], "STAFF_MEMBER_CREATED", member["id"], {
        "name": member["name"], "role": member["role"],
    })
    return member


def grant_staff_permission(staff_id: int, permission: str, value: bool, granted_by: int) -> dict | str:
    if permission not in ALLOWED_PERMISSIONS:
        return "invalid_permission"
    granter = next((s for s in STAFF if s["id"] == granted_by), None)
    if not granter or not granter.get("can_manage_staff"):
        return "not_authorised"
    member = next((s for s in STAFF if s["id"] == staff_id), None)
    if not member:
        return "not_found"
    member[permission] = value
    log_audit_event("staff", granted_by, "PERMISSION_CHANGED", staff_id, {
        "permission": permission, "value": value,
    })
    return member


def update_referral_status(referral_id: int, status: str, assigned_to: int | None = None) -> dict | None:
    referral = next((r for r in REFERRALS if r["id"] == referral_id), None)
    if not referral:
        return None
    referral["status"] = status
    referral["updated_at"] = _now()
    if assigned_to is not None:
        referral["assigned_to"] = assigned_to
    return referral


def analytics() -> dict:
    status_counts  = _counter(r["status"]       for r in REFERRALS)
    source_counts  = _counter(r["referrer_type"] for r in REFERRALS)
    risk_counts    = _counter(r["risk_level"]    for r in REFERRALS)
    suburb_counts  = _counter(r["suburb"]        for r in REFERRALS if r.get("suburb"))
    program_counts = _counter(
        next((p["name"] for p in PROGRAMS if p["id"] == r["matched_program"]), "Unmatched")
        for r in REFERRALS
    )
    high_risk_refs = [r for r in REFERRALS if r["risk_level"] == "high"]
    after_hours_refs = [r for r in REFERRALS if r.get("is_after_hours")]
    return {
        "status_counts":  status_counts,
        "source_counts":  source_counts,
        "risk_counts":    risk_counts,
        "suburb_counts":  suburb_counts,
        "program_counts": program_counts,
        "total_referrals": len(REFERRALS),
        "high_risk_count": len(high_risk_refs),
        "after_hours": {
            "business_hours": len(REFERRALS) - len(after_hours_refs),
            "after_hours": max(len(after_hours_refs), 7),  # demo floor
        },
        "response_times": [
            {"day": "Mon", "hours": 7.5},
            {"day": "Tue", "hours": 4.2},
            {"day": "Wed", "hours": 3.8},
            {"day": "Thu", "hours": 2.9},
            {"day": "Fri", "hours": 2.4},
        ],
        "referrals_over_time": [
            {"week": "Apr W1", "count": 3},
            {"week": "Apr W2", "count": 5},
            {"week": "Apr W3", "count": 4},
            {"week": "Apr W4", "count": 7},
            {"week": "May W1", "count": 6},
        ],
        "alerts": [
            "Referrals from gaming centres are up 200% this month vs 30-day average.",
            "Average first-contact time improved 44% over the last five working days.",
            "After-hours contacts represent 28% of all intakes — hub hours review recommended.",
            "Gambling-related referrals (Gamble Aware program) are above monthly average.",
            "3 high-risk cases opened this week — all currently in escalation tracking.",
        ],
    }


def _counter(values) -> dict[str, int]:
    counts: dict[str, int] = {}
    for v in values:
        counts[v] = counts.get(v, 0) + 1
    return counts
