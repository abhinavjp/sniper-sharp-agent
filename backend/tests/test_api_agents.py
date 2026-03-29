def _create_provider(client):
    return client.post("/api/providers", json={
        "name": "Anthropic",
        "type": "anthropic-api-key",
        "credentials": {"api_key": "sk-test"},
        "model": "claude-3-5-sonnet-20241022",
    }).json()


def _create_skill(client):
    return client.post("/api/skills", json={
        "name": "http-call",
        "description": "HTTP",
        "input_schema": {"type": "object"},
        "implementation": "pass",
    }).json()


def _create_agent(client, provider_id, **overrides):
    payload = {
        "name": "TestAgent",
        "persona": "You are a test agent.",
        "provider_id": provider_id,
        "is_supervisor": False,
        **overrides,
    }
    return client.post("/api/agents", json=payload)


def test_create_agent(client):
    provider = _create_provider(client)
    resp = _create_agent(client, provider["id"])
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "TestAgent"
    assert data["provider_id"] == provider["id"]
    assert "id" in data


def test_list_agents(client):
    provider = _create_provider(client)
    _create_agent(client, provider["id"])
    assert len(client.get("/api/agents").json()) == 1


def test_get_agent(client):
    provider = _create_provider(client)
    created = _create_agent(client, provider["id"]).json()
    resp = client.get(f"/api/agents/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_agent_not_found(client):
    assert client.get("/api/agents/missing").status_code == 404


def test_update_agent(client):
    provider = _create_provider(client)
    created = _create_agent(client, provider["id"]).json()
    resp = client.put(f"/api/agents/{created['id']}", json={"persona": "Updated persona."})
    assert resp.status_code == 200
    assert resp.json()["persona"] == "Updated persona."


def test_delete_agent(client):
    provider = _create_provider(client)
    created = _create_agent(client, provider["id"]).json()
    assert client.delete(f"/api/agents/{created['id']}").status_code == 204
    assert client.get(f"/api/agents/{created['id']}").status_code == 404


def test_attach_and_detach_skill(client):
    provider = _create_provider(client)
    agent = _create_agent(client, provider["id"]).json()
    skill = _create_skill(client)

    # attach
    resp = client.post(f"/api/agents/{agent['id']}/skills/{skill['id']}")
    assert resp.status_code == 204

    # verify agent has skill
    agent_data = client.get(f"/api/agents/{agent['id']}").json()
    assert any(s["id"] == skill["id"] for s in agent_data["skills"])

    # detach
    resp = client.delete(f"/api/agents/{agent['id']}/skills/{skill['id']}")
    assert resp.status_code == 204

    # verify skill removed
    agent_data = client.get(f"/api/agents/{agent['id']}").json()
    assert not any(s["id"] == skill["id"] for s in agent_data["skills"])


def test_attach_skill_invalid_agent(client):
    skill = _create_skill(client)
    assert client.post(f"/api/agents/bad-id/skills/{skill['id']}").status_code == 404


def test_attach_skill_invalid_skill(client):
    provider = _create_provider(client)
    agent = _create_agent(client, provider["id"]).json()
    assert client.post(f"/api/agents/{agent['id']}/skills/bad-id").status_code == 404
