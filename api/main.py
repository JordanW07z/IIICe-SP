from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .state import state

app = FastAPI(title="SpotShrooms Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev: Vite serves on a different port
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "model_loaded": state.model_loaded}
