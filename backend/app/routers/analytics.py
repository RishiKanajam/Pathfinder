from fastapi import APIRouter

from app import store

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("")
def get_analytics():
    return store.analytics()
