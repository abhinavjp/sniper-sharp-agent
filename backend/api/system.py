from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Agent, Skill, RoutingRule
from graph.registry import graph_registry

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"status": "ok", "graph_compiled": graph_registry.is_compiled()}


@router.get("/graph/status")
def graph_status(db: Session = Depends(get_db)):
    return {
        "agent_count": db.query(Agent).count(),
        "skill_count": db.query(Skill).count(),
        "routing_rule_count": db.query(RoutingRule).count(),
    }


@router.post("/graph/rebuild", status_code=204)
async def force_rebuild(db: Session = Depends(get_db)):
    await graph_registry.rebuild(db)
    return Response(status_code=204)
