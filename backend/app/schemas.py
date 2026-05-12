from pydantic import BaseModel
from datetime import datetime


class ReferralCreate(BaseModel):
    client_name: str | None = None
    their_first_name: str | None = None
    referrer_name: str | None = None
    referrer_type: str | None = None
    referrer_contact: str | None = None
    contact: str | None = None
    source_tag: str | None = None
    situation: str
    urgency: str | None = None


class ReferralStatusUpdate(BaseModel):
    status: str
    assigned_to: int | None = None


class ChatMessage(BaseModel):
    message: str
    conversation_id: int | None = None


class EscalationLog(BaseModel):
    """Track multi-layer escalation for high-risk cases."""
    id: int
    conversation_id: int
    risk_level: str
    risk_score: float
    
    # Layer 1: Crisis resources display
    layer_1_displayed: bool
    layer_1_timestamp: str
    
    # Layer 2: Staff notification
    layer_2_sent_to: list[int]
    layer_2_timestamp: str
    layer_2_methods: list[str]
    
    # Layer 3: Acknowledgment check (5 min)
    layer_3_check_timestamp: str | None = None
    layer_3_triggered: bool = False
    
    # Layer 4: Extended escalation (15 min)
    layer_4_check_timestamp: str | None = None
    layer_4_triggered: bool = False
    
    # Acknowledgment tracking
    acknowledged_by: int | None = None
    acknowledged_at: str | None = None
    
    # Resolution
    resolved: bool = False
    resolved_by: int | None = None
    resolved_at: str | None = None
    resolution_notes: str = ""
    
    # System failure tracking
    is_system_failure: bool = False
    failure_reason: str = ""
    post_incident_review_required: bool = False


class AuditLogEntry(BaseModel):
    """Immutable audit log entry."""
    id: int
    timestamp: str
    event_type: str
    actor_id: int | None
    action: str
    resource_id: int
    details: dict | None = None
