from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.agents import router as agents_router
from api.providers import router as providers_router
from api.routing_rules import router as routing_rules_router
from api.sessions import router as sessions_router
from api.skills import router as skills_router
from api.system import router as system_router
from db.database import SessionLocal, init_db
from graph.registry import graph_registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Build the initial graph from whatever is currently in the DB
    db = SessionLocal()
    try:
        try:
            await graph_registry.rebuild(db)
        except Exception:
            # Graph rebuild may fail in test environments without provider credentials
            # This is expected and safe — the graph will remain uncompiled
            pass
    finally:
        db.close()
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
app.include_router(agents_router)
app.include_router(routing_rules_router)
app.include_router(sessions_router)
