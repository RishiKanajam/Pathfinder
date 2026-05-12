from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.env import load_local_env

load_local_env()

from app.routers import analytics, chat, programs, referrals, escalations

app = FastAPI(title="PathFinder API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(referrals.router)
app.include_router(chat.router)
app.include_router(analytics.router)
app.include_router(programs.router)
app.include_router(escalations.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "PathFinder API"}
