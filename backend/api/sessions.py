from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session as DbSession

from db.database import get_db
from db.models import Agent, Session

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class SessionCreate(BaseModel):
    user_id: str
    agent_id: str


class SessionOut(BaseModel):
    id: str
    user_id: str
    agent_id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


@router.post("", response_model=SessionOut, status_code=201)
def create_session(body: SessionCreate, db: DbSession = Depends(get_db)):
    agent = db.get(Agent, body.agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    s = Session(user_id=body.user_id, agent_id=body.agent_id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{id}", status_code=204)
def delete_session(id: str, db: DbSession = Depends(get_db)):
    s = db.get(Session, id)
    if not s:
        raise HTTPException(404, "Session not found")
    db.delete(s)
    db.commit()
    return Response(status_code=204)
