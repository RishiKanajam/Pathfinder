from fastapi import APIRouter, HTTPException
from datetime import datetime

from app import store

router = APIRouter(prefix="/api/escalations", tags=["escalations"])


@router.get("")
def list_escalations():
    """List all active escalations."""
    return store.ESCALATION_LOGS


@router.get("/{escalation_id}/status")
def get_escalation_status(escalation_id: int):
    """Get current escalation status and check for layer advancement."""
    escalation = next(
        (e for e in store.ESCALATION_LOGS if e["id"] == escalation_id),
        None
    )
    if not escalation:
        raise HTTPException(status_code=404, detail="Escalation not found")
    
    # Check if escalation needs layer advancement
    check_result = store.check_escalation_acknowledgment(escalation_id)
    
    return {
        "escalation_id": escalation_id,
        "risk_level": escalation["risk_level"],
        "risk_score": escalation["risk_score"],
        "current_layer": (
            4 if escalation["layer_4_triggered"] else
            3 if escalation["layer_3_triggered"] else
            2
        ),
        "acknowledged": bool(escalation["acknowledged_at"]),
        "acknowledged_by": escalation["acknowledged_by"],
        "response_time_seconds": (
            int((datetime.fromisoformat(escalation["acknowledged_at"]) -
                 datetime.fromisoformat(escalation["layer_2_timestamp"])).total_seconds())
            if escalation["acknowledged_at"] else None
        ),
        "system_failure": escalation["is_system_failure"],
        "post_incident_review_required": escalation["post_incident_review_required"],
        "check_result": check_result,
    }


@router.post("/{escalation_id}/acknowledge")
def acknowledge_escalation(escalation_id: int, staff_id: int):
    """Staff member acknowledges receiving high-risk escalation."""
    result = store.acknowledge_escalation(escalation_id, staff_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/overnight-summary")
def get_overnight_summary():
    """Summary of overnight (after-hours) contacts for morning review."""
    high_risk_escalations = [
        e for e in store.ESCALATION_LOGS
        if e["risk_level"] == "high"
    ]
    
    unacknowledged = [
        e for e in high_risk_escalations
        if not e["acknowledged_at"]
    ]
    
    system_failures = [
        e for e in high_risk_escalations
        if e["is_system_failure"]
    ]
    
    return {
        "total_escalations": len(high_risk_escalations),
        "unacknowledged_count": len(unacknowledged),
        "system_failures_count": len(system_failures),
        "urgent_follow_ups": [
            {
                "escalation_id": e["id"],
                "conversation_id": e["conversation_id"],
                "risk_score": e["risk_score"],
                "escalation_layer": (
                    4 if e["layer_4_triggered"] else
                    3 if e["layer_3_triggered"] else
                    2
                ),
                "time_since_contact_minutes": int(
                    (datetime.now() - datetime.fromisoformat(e["layer_2_timestamp"])).total_seconds() / 60
                ),
                "priority": "CRITICAL" if e["is_system_failure"] else "URGENT",
                "requires_post_incident_review": e["post_incident_review_required"],
            }
            for e in unacknowledged
        ],
    }


@router.get("/metrics/response-times")
def get_escalation_metrics():
    """Analytics on escalation response times."""
    high_risk = [e for e in store.ESCALATION_LOGS if e["risk_level"] == "high"]
    
    if not high_risk:
        return {"no_data": True}
    
    acknowledged = [e for e in high_risk if e["acknowledged_at"]]
    
    if acknowledged:
        response_times = [
            int((datetime.fromisoformat(e["acknowledged_at"]) -
                 datetime.fromisoformat(e["layer_2_timestamp"])).total_seconds() / 60)
            for e in acknowledged
        ]
        
        return {
            "total_high_risk_escalations": len(high_risk),
            "acknowledged_count": len(acknowledged),
            "unacknowledged_count": len(high_risk) - len(acknowledged),
            "avg_response_time_minutes": round(sum(response_times) / len(response_times), 1),
            "median_response_time_minutes": sorted(response_times)[len(response_times)//2],
            "max_response_time_minutes": max(response_times),
            "min_response_time_minutes": min(response_times),
            "system_failures_count": len([e for e in high_risk if e["is_system_failure"]]),
        }
    
    return {
        "total_high_risk_escalations": len(high_risk),
        "acknowledged_count": 0,
        "unacknowledged_count": len(high_risk),
        "avg_response_time_minutes": None,
        "system_failures_count": len([e for e in high_risk if e["is_system_failure"]]),
    }


@router.get("/audit-log")
def get_audit_log():
    """Get the immutable audit log."""
    return {
        "total_entries": len(store.AUDIT_LOG),
        "entries": store.AUDIT_LOG,
    }
