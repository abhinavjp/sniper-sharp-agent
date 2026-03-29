def test_health_ok(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "graph_compiled" in data


def test_graph_status(client):
    resp = client.get("/api/graph/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "agent_count" in data
    assert "skill_count" in data
    assert "routing_rule_count" in data


def test_force_rebuild(client):
    resp = client.post("/api/graph/rebuild")
    assert resp.status_code == 204
