from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app import store
from app.schemas import ReferralCreate, ReferralStatusUpdate
from app.ai.case_insights import generate_insights

router = APIRouter(prefix="/api/referrals", tags=["referrals"])


class ReferralUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[int] = None
    notes: Optional[str] = None
    outcome_notes: Optional[str] = None


@router.get("")
def list_referrals():
    return store.REFERRALS


@router.post("")
def create_referral(payload: ReferralCreate):
    return store.create_referral(payload.model_dump())


@router.patch("/{referral_id}")
def update_referral(referral_id: int, payload: ReferralUpdate):
    referral = next((r for r in store.REFERRALS if r["id"] == referral_id), None)
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")

    from datetime import datetime
    referral["updated_at"] = datetime.now().isoformat(timespec="seconds")

    if payload.status is not None:
        referral["status"] = payload.status
    if payload.assigned_to is not None:
        referral["assigned_to"] = payload.assigned_to
    if payload.notes is not None:
        referral["notes"] = payload.notes
    if payload.outcome_notes is not None:
        referral["outcome_notes"] = payload.outcome_notes

    return referral


@router.get("/{referral_id}/insights")
def get_case_insights(referral_id: int):
    referral = next((r for r in store.REFERRALS if r["id"] == referral_id), None)
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    return generate_insights(referral, store.PROGRAMS)
