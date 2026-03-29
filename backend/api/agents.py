from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Agent, Skill
from graph.registry import graph_registry

router = APIRouter(prefix="/api/agents", tags=["agents"])


class AgentCreate(BaseModel):
    name: str
    persona: str
    rules: str | None = None
    provider_id: str
    is_supervisor: bool = False
    memory_enabled: bool = False
    memory_types: list[str] = ["user", "feedback", "project", "reference"]
    config_hook_url: str | None = None
    config_hook_secret: str | None = None


class AgentUpdate(BaseModel):
    name: str | None = None
    persona: str | None = None
    rules: str | None = None
    provider_id: str | None = None
    is_supervisor: bool | None = None
    memory_enabled: bool | None = None
    memory_types: list[str] | None = None
    config_hook_url: str | None = None
    config_hook_secret: str | None = None


class SkillSummary(BaseModel):
    id: str
    name: str
    description: str
    model_config = ConfigDict(from_attributes=True)


class AgentOut(BaseModel):
    id: str
    name: str
    persona: str
    rules: str | None
    provider_id: str
    is_supervisor: bool
    memory_enabled: bool
    memory_types: list[str]
    config_hook_url: str | None
    created_at: datetime
    skills: list[SkillSummary]
    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=list[AgentOut])
def list_agents(db: Session = Depends(get_db)):
    return db.query(Agent).all()


@router.get("/{id}", response_model=AgentOut)
def get_agent(id: str, db: Session = Depends(get_db)):
    a = db.get(Agent, id)
    if not a:
        raise HTTPException(404, "Agent not found")
    return a


@router.post("", response_model=AgentOut, status_code=201)
async def create_agent(body: AgentCreate, db: Session = Depends(get_db)):
    a = Agent(**body.model_dump())
    db.add(a)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, f"Agent name {body.name!r} already exists")
    db.refresh(a)
    await graph_registry.rebuild(db)
    return a


@router.put("/{id}", response_model=AgentOut)
async def update_agent(id: str, body: AgentUpdate, db: Session = Depends(get_db)):
    a = db.get(Agent, id)
    if not a:
        raise HTTPException(404, "Agent not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(a, k, v)
    db.commit()
    db.refresh(a)
    await graph_registry.rebuild(db)
    return a


@router.delete("/{id}", status_code=204)
async def delete_agent(id: str, db: Session = Depends(get_db)):
    a = db.get(Agent, id)
    if not a:
        raise HTTPException(404, "Agent not found")
    db.delete(a)
    db.commit()
    await graph_registry.rebuild(db)
    return Response(status_code=204)


@router.post("/{agent_id}/skills/{skill_id}", status_code=204)
async def attach_skill(agent_id: str, skill_id: str, db: Session = Depends(get_db)):
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    skill = db.get(Skill, skill_id)
    if not skill:
        raise HTTPException(404, "Skill not found")
    if skill not in agent.skills:
        agent.skills.append(skill)
        db.commit()
    await graph_registry.rebuild(db)
    return Response(status_code=204)


@router.delete("/{agent_id}/skills/{skill_id}", status_code=204)
async def detach_skill(agent_id: str, skill_id: str, db: Session = Depends(get_db)):
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    skill = db.get(Skill, skill_id)
    if not skill:
        raise HTTPException(404, "Skill not found")
    if skill in agent.skills:
        agent.skills.remove(skill)
        db.commit()
    await graph_registry.rebuild(db)
    return Response(status_code=204)
