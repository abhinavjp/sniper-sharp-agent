from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.database import init_db, get_db
from api.system import router as system_router
from api.providers import router as providers_router
from api.skills import router as skills_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Only init_db in production. In tests, conftest.py sets up
    # dependency overrides for a test database, which we detect here.
    if get_db not in app.dependency_overrides:
        init_db()
    yield


app = FastAPI(
    title="Agent Framework API",
    description="LangGraph-powered multi-agent framework",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system_router)
app.include_router(providers_router)
app.include_router(skills_router)
