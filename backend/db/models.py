import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import JSON


def _uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    credentials: Mapped[dict] = mapped_column(JSON, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    agents: Mapped[list["Agent"]] = relationship("Agent", back_populates="provider")


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    persona: Mapped[str] = mapped_column(String, nullable=False)
    rules: Mapped[str | None] = mapped_column(String, nullable=True)
    provider_id: Mapped[str] = mapped_column(String, ForeignKey("providers.id"), nullable=False)
    is_supervisor: Mapped[bool] = mapped_column(Boolean, default=False)
    memory_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    memory_types: Mapped[list] = mapped_column(
        JSON, default=lambda: ["user", "feedback", "project", "reference"]
    )
    config_hook_url: Mapped[str | None] = mapped_column(String, nullable=True)
    config_hook_secret: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    provider: Mapped["Provider"] = relationship("Provider", back_populates="agents")
    skills: Mapped[list["Skill"]] = relationship(
        "Skill", secondary="agent_skills", back_populates="agents"
    )
    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="agent")
    memories: Mapped[list["Memory"]] = relationship("Memory", back_populates="agent")


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    input_schema: Mapped[dict] = mapped_column(JSON, nullable=False)
    implementation: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    agents: Mapped[list["Agent"]] = relationship(
        "Agent", secondary="agent_skills", back_populates="skills"
    )


class AgentSkill(Base):
    __tablename__ = "agent_skills"

    agent_id: Mapped[str] = mapped_column(
        String, ForeignKey("agents.id"), primary_key=True
    )
    skill_id: Mapped[str] = mapped_column(
        String, ForeignKey("skills.id"), primary_key=True
    )


class RoutingRule(Base):
    __tablename__ = "routing_rules"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    supervisor_id: Mapped[str] = mapped_column(
        String, ForeignKey("agents.id"), nullable=False
    )
    intent_label: Mapped[str] = mapped_column(String, nullable=False)
    target_agent_id: Mapped[str] = mapped_column(
        String, ForeignKey("agents.id"), nullable=False
    )
    priority: Mapped[int] = mapped_column(Integer, default=0)


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    agent_id: Mapped[str] = mapped_column(
        String, ForeignKey("agents.id"), nullable=False
    )
    history: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    agent: Mapped["Agent"] = relationship("Agent", back_populates="sessions")


class Memory(Base):
    __tablename__ = "memories"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    agent_id: Mapped[str] = mapped_column(
        String, ForeignKey("agents.id"), nullable=False
    )
    user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(String, nullable=False)
    chroma_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    agent: Mapped["Agent"] = relationship("Agent", back_populates="memories")
