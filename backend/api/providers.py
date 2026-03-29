from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Provider
from graph.registry import graph_registry

router = APIRouter(prefix="/api/providers", tags=["providers"])

VALID_TYPES = Literal[
    "anthropic-api-key",
    "anthropic-setup-auth",
    "openai-api-key",
    "openai-codex-oauth",
    "google-api-key",
    "custom-url",
]


class ProviderCreate(BaseModel):
    name: str
    type: VALID_TYPES
    credentials: dict[str, str]
    model: str
    is_default: bool = False


class ProviderUpdate(BaseModel):
    name: str | None = None
    credentials: dict[str, str] | None = None
    model: str | None = None
    is_default: bool | None = None


class ProviderOut(BaseModel):
    id: str
    name: str
    type: str
    model: str
    is_default: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=list[ProviderOut])
def list_providers(db: Session = Depends(get_db)):
    return db.query(Provider).all()


@router.get("/{id}", response_model=ProviderOut)
def get_provider(id: str, db: Session = Depends(get_db)):
    p = db.get(Provider, id)
    if not p:
        raise HTTPException(404, "Provider not found")
    return p


@router.post("", response_model=ProviderOut, status_code=201)
async def create_provider(body: ProviderCreate, db: Session = Depends(get_db)):
    p = Provider(**body.model_dump())
    db.add(p)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, f"Provider name {body.name!r} already exists")
    db.refresh(p)
    await graph_registry.rebuild(db)
    return p


@router.put("/{id}", response_model=ProviderOut)
async def update_provider(id: str, body: ProviderUpdate, db: Session = Depends(get_db)):
    p = db.get(Provider, id)
    if not p:
        raise HTTPException(404, "Provider not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    await graph_registry.rebuild(db)
    return p


@router.delete("/{id}", status_code=204)
async def delete_provider(id: str, db: Session = Depends(get_db)):
    p = db.get(Provider, id)
    if not p:
        raise HTTPException(404, "Provider not found")
    db.delete(p)
    db.commit()
    await graph_registry.rebuild(db)
    return Response(status_code=204)
