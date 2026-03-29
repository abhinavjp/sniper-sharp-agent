def _setup(client):
    """Returns (supervisor_id, worker_id) — both agents seeded in DB."""
    provider = client.post("/api/providers", json={
        "name": "Anthropic",
        "type": "anthropic-api-key",
        "credentials": {"api_key": "sk-test"},
        "model": "claude-3-5-sonnet-20241022",
    }).json()
    supervisor = client.post("/api/agents", json={
        "name": "Supervisor",
        "persona": "You route emails.",
        "provider_id": provider["id"],
        "is_supervisor": True,
    }).json()
    worker = client.post("/api/agents", json={
        "name": "Worker",
        "persona": "You process payroll.",
        "provider_id": provider["id"],
    }).json()
    return supervisor["id"], worker["id"]


def _create_rule(client, supervisor_id, worker_id, label="starter-processing"):
    return client.post("/api/routing-rules", json={
        "supervisor_id": supervisor_id,
        "intent_label": label,
        "target_agent_id": worker_id,
        "priority": 0,
    })


def test_create_routing_rule(client):
    sup_id, wrk_id = _setup(client)
    resp = _create_rule(client, sup_id, wrk_id)
    assert resp.status_code == 201
    data = resp.json()
    assert data["intent_label"] == "starter-processing"
    assert data["target_agent_id"] == wrk_id


def test_list_routing_rules(client):
    sup_id, wrk_id = _setup(client)
    _create_rule(client, sup_id, wrk_id)
    assert len(client.get("/api/routing-rules").json()) == 1


def test_get_routing_rule(client):
    sup_id, wrk_id = _setup(client)
    created = _create_rule(client, sup_id, wrk_id).json()
    resp = client.get(f"/api/routing-rules/{created['id']}")
    assert resp.status_code == 200


def test_update_routing_rule(client):
    sup_id, wrk_id = _setup(client)
    created = _create_rule(client, sup_id, wrk_id).json()
    resp = client.put(f"/api/routing-rules/{created['id']}", json={"priority": 5})
    assert resp.status_code == 200
    assert resp.json()["priority"] == 5


def test_delete_routing_rule(client):
    sup_id, wrk_id = _setup(client)
    created = _create_rule(client, sup_id, wrk_id).json()
    assert client.delete(f"/api/routing-rules/{created['id']}").status_code == 204
    assert client.get(f"/api/routing-rules/{created['id']}").status_code == 404
