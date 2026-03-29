def _setup(client):
    provider = client.post("/api/providers", json={
        "name": "Anthropic",
        "type": "anthropic-api-key",
        "credentials": {"api_key": "sk-test"},
        "model": "claude-3-5-sonnet-20241022",
    }).json()
    agent = client.post("/api/agents", json={
        "name": "Supervisor",
        "persona": "You route.",
        "provider_id": provider["id"],
        "is_supervisor": True,
    }).json()
    return agent["id"]


def test_create_session(client):
    agent_id = _setup(client)
    resp = client.post("/api/sessions", json={"user_id": "user-123", "agent_id": agent_id})
    assert resp.status_code == 201
    data = resp.json()
    assert data["user_id"] == "user-123"
    assert data["agent_id"] == agent_id
    assert "id" in data


def test_create_session_invalid_agent(client):
    resp = client.post("/api/sessions", json={"user_id": "user-123", "agent_id": "bad-id"})
    assert resp.status_code == 404


def test_delete_session(client):
    agent_id = _setup(client)
    session = client.post("/api/sessions", json={"user_id": "user-123", "agent_id": agent_id}).json()
    resp = client.delete(f"/api/sessions/{session['id']}")
    assert resp.status_code == 204


def test_delete_session_not_found(client):
    assert client.delete("/api/sessions/missing").status_code == 404
