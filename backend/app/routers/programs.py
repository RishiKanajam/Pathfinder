from fastapi import APIRouter, HTTPException

from app import store
from app.schemas import NewStaffMember, GrantPermissionPayload

router = APIRouter(prefix="/api", tags=["directory"])


@router.get("/programs")
def programs():
    return store.PROGRAMS


@router.get("/staff")
def staff():
    return store.STAFF


@router.post("/staff")
def create_staff(payload: NewStaffMember):
    result = store.create_staff_member(payload.model_dump())
    if result == "not_authorised":
        raise HTTPException(status_code=403, detail="Only staff with manage permission can add new members")
    return result


@router.post("/staff/{staff_id}/permissions")
def grant_permission(staff_id: int, payload: GrantPermissionPayload):
    result = store.grant_staff_permission(staff_id, payload.permission, payload.value, payload.granted_by)
    if result == "not_found":
        raise HTTPException(status_code=404, detail="Staff member not found")
    if result == "not_authorised":
        raise HTTPException(status_code=403, detail="Only staff with manage permission can change permissions")
    if result == "invalid_permission":
        raise HTTPException(status_code=400, detail="Invalid permission")
    return result


@router.get("/volunteers")
def volunteers():
    return store.VOLUNTEERS
