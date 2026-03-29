import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from db.models import Base
from db.database import get_db
from main import app


@pytest.fixture
def client():
    # Use file-based SQLite for test to avoid connection pool issues with :memory:
    # Each connection to :memory: gets a separate database, so we use a named
    # in-memory database which persists across connections within a single connection pool
    engine = create_engine(
        "sqlite:///file::memory:?cache=shared&uri=true",
        connect_args={"check_same_thread": False, "uri": True},
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    # Override dependency BEFORE creating TestClient so lifespan uses test DB
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
