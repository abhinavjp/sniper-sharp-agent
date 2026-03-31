from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Skill
from graph.registry import graph_registry

router = APIRouter(prefix="/api/skills", tags=["skills"])


class SkillCreate(BaseModel):
    name: str
    description: str
    input_schema: dict
    implementation: str
    skill_type: str = "executable"
    version: str = "1.0.0"
    author: str = "user"
    user_id: str | None = None
    allowed_tools: list[str] = []
    user_invocable: bool = False
    disable_model_invocation: bool = False
    context_requirements: list[str] = []


class SkillUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    input_schema: dict | None = None
    implementation: str | None = None
    skill_type: str | None = None
    version: str | None = None
    author: str | None = None
    user_id: str | None = None
    allowed_tools: list[str] | None = None
    user_invocable: bool | None = None
    disable_model_invocation: bool | None = None
    context_requirements: list[str] | None = None


class SkillOut(BaseModel):
    id: str
    name: str
    description: str
    input_schema: dict
    implementation: str
    created_at: datetime
    skill_type: str
    version: str
    author: str
    user_id: str | None
    allowed_tools: list[Any]
    user_invocable: bool
    disable_model_invocation: bool
    context_requirements: list[Any]
    model_config = ConfigDict(from_attributes=True)


class SystemSkillOut(BaseModel):
    name: str
    description: str
    version: str
    author: str
    skill_type: str
    allowed_tools: list[str]
    user_invocable: bool
    disable_model_invocation: bool
    context_requirements: list[str]
    body: str
    source_path: str


@router.get("/system", response_model=list[SystemSkillOut])
def list_system_skills():
    """Return system skills loaded from .agents/skills/ at last graph rebuild."""
    return [
        SystemSkillOut(
            name=s.name,
            description=s.description,
            version=s.version,
            author=s.author,
            skill_type=s.skill_type,
            allowed_tools=s.allowed_tools,
            user_invocable=s.user_invocable,
            disable_model_invocation=s.disable_model_invocation,
            context_requirements=s.context_requirements,
            body=s.body,
            source_path=s.source_path,
        )
        for s in graph_registry.system_skills
    ]


@router.get("", response_model=list[SkillOut])
def list_skills(db: Session = Depends(get_db)):
    return db.query(Skill).all()


@router.get("/{id}", response_model=SkillOut)
def get_skill(id: str, db: Session = Depends(get_db)):
    s = db.get(Skill, id)
    if not s:
        raise HTTPException(404, "Skill not found")
    return s


@router.post("", response_model=SkillOut, status_code=201)
async def create_skill(body: SkillCreate, db: Session = Depends(get_db)):
    s = Skill(**body.model_dump())
    db.add(s)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, f"Skill name {body.name!r} already exists")
    db.refresh(s)
    await graph_registry.rebuild(db)
    return s


@router.put("/{id}", response_model=SkillOut)
async def update_skill(id: str, body: SkillUpdate, db: Session = Depends(get_db)):
    s = db.get(Skill, id)
    if not s:
        raise HTTPException(404, "Skill not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    await graph_registry.rebuild(db)
    return s


@router.delete("/{id}", status_code=204)
async def delete_skill(id: str, db: Session = Depends(get_db)):
    s = db.get(Skill, id)
    if not s:
        raise HTTPException(404, "Skill not found")
    db.delete(s)
    db.commit()
    await graph_registry.rebuild(db)
    return Response(status_code=204)
