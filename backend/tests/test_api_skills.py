def _create_skill(client, **overrides):
    payload = {
        "name": "http-call",
        "description": "Make an outbound HTTP request",
        "input_schema": {"type": "object", "properties": {"url": {"type": "string"}}},
        "implementation": "import httpx\nreturn httpx.get(input['url']).text",
        **overrides,
    }
    return client.post("/api/skills", json=payload)


def test_create_skill(client):
    resp = _create_skill(client)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "http-call"
    assert "id" in data


def test_list_skills_empty(client):
    assert client.get("/api/skills").json() == []


def test_list_skills(client):
    _create_skill(client)
    assert len(client.get("/api/skills").json()) == 1


def test_get_skill(client):
    created = _create_skill(client).json()
    resp = client.get(f"/api/skills/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_skill_not_found(client):
    assert client.get("/api/skills/missing").status_code == 404


def test_update_skill(client):
    created = _create_skill(client).json()
    resp = client.put(f"/api/skills/{created['id']}", json={"description": "Updated description"})
    assert resp.status_code == 200
    assert resp.json()["description"] == "Updated description"


def test_delete_skill(client):
    created = _create_skill(client).json()
    assert client.delete(f"/api/skills/{created['id']}").status_code == 204
    assert client.get(f"/api/skills/{created['id']}").status_code == 404


def test_duplicate_name_rejected(client):
    _create_skill(client)
    assert _create_skill(client).status_code == 409
