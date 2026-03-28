from sqlalchemy import create_engine, inspect
from db.models import Base, Provider, Agent, Skill, AgentSkill, RoutingRule, Session, Memory


def test_all_tables_created():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    assert tables == {"providers", "agents", "skills", "agent_skills", "routing_rules", "sessions", "memories"}


def test_provider_columns():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    inspector = inspect(engine)
    cols = {c["name"] for c in inspector.get_columns("providers")}
    assert {"id", "name", "type", "credentials", "model", "is_default", "created_at"} <= cols


def test_agent_columns():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    inspector = inspect(engine)
    cols = {c["name"] for c in inspector.get_columns("agents")}
    assert {
        "id", "name", "persona", "rules", "provider_id", "is_supervisor",
        "memory_enabled", "memory_types", "config_hook_url", "config_hook_secret", "created_at"
    } <= cols


def test_memories_columns():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    inspector = inspect(engine)
    cols = {c["name"] for c in inspector.get_columns("memories")}
    assert {"id", "agent_id", "user_id", "type", "name", "description", "content", "chroma_id"} <= cols
