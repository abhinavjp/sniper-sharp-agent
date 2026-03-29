from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import RoutingRule
from graph.registry import graph_registry

router = APIRouter(prefix="/api/routing-rules", tags=["routing-rules"])


class RoutingRuleCreate(BaseModel):
    supervisor_id: str
    intent_label: str
    target_agent_id: str
    priority: int = 0


class RoutingRuleUpdate(BaseModel):
    intent_label: str | None = None
    target_agent_id: str | None = None
    priority: int | None = None


class RoutingRuleOut(BaseModel):
    id: str
    supervisor_id: str
    intent_label: str
    target_agent_id: str
    priority: int
    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=list[RoutingRuleOut])
def list_routing_rules(db: Session = Depends(get_db)):
    return db.query(RoutingRule).all()


@router.get("/{id}", response_model=RoutingRuleOut)
def get_routing_rule(id: str, db: Session = Depends(get_db)):
    r = db.get(RoutingRule, id)
    if not r:
        raise HTTPException(404, "Routing rule not found")
    return r


@router.post("", response_model=RoutingRuleOut, status_code=201)
async def create_routing_rule(body: RoutingRuleCreate, db: Session = Depends(get_db)):
    r = RoutingRule(**body.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    await graph_registry.rebuild(db)
    return r


@router.put("/{id}", response_model=RoutingRuleOut)
async def update_routing_rule(id: str, body: RoutingRuleUpdate, db: Session = Depends(get_db)):
    r = db.get(RoutingRule, id)
    if not r:
        raise HTTPException(404, "Routing rule not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    await graph_registry.rebuild(db)
    return r


@router.delete("/{id}", status_code=204)
async def delete_routing_rule(id: str, db: Session = Depends(get_db)):
    r = db.get(RoutingRule, id)
    if not r:
        raise HTTPException(404, "Routing rule not found")
    db.delete(r)
    db.commit()
    await graph_registry.rebuild(db)
    return Response(status_code=204)
