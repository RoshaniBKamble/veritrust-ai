"""VeriTrust AI — FastAPI application entrypoint.

Assembles the modular routers under the /api prefix, initializes the PostgreSQL schema
on startup, and configures CORS. Run by supervisor via `uvicorn server:app`.
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routes import auth_routes, policy_routes, ai_routes, verify_routes

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("veritrust")

app = FastAPI(title="VeriTrust AI", version="1.0.0")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"service": "VeriTrust AI", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"status": "healthy"}


api_router.include_router(auth_routes.router)
api_router.include_router(policy_routes.router)
api_router.include_router(ai_routes.router)
api_router.include_router(verify_routes.router)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await init_db()
    logger.info("VeriTrust AI backend started; PostgreSQL schema ready.")
