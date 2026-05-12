from fastapi import APIRouter

from app import store

router = APIRouter(prefix="/api", tags=["directory"])


@router.get("/programs")
def programs():
    return store.PROGRAMS


@router.get("/staff")
def staff():
    return store.STAFF


@router.get("/volunteers")
def volunteers():
    return store.VOLUNTEERS
