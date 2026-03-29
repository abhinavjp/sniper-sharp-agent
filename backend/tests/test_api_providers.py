def _create_provider(client, **overrides):
    payload = {
        "name": "Test Anthropic",
        "type": "anthropic-api-key",
        "credentials": {"api_key": "sk-test"},
        "model": "claude-3-5-sonnet-20241022",
        "is_default": False,
        **overrides,
    }
    return client.post("/api/providers", json=payload)


def test_create_provider(client):
    resp = _create_provider(client)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Anthropic"
    assert data["type"] == "anthropic-api-key"
    assert data["model"] == "claude-3-5-sonnet-20241022"
    assert "id" in data
    assert "credentials" not in data  # never returned


def test_list_providers_empty(client):
    resp = client.get("/api/providers")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_providers(client):
    _create_provider(client)
    resp = client.get("/api/providers")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_get_provider(client):
    created = _create_provider(client).json()
    resp = client.get(f"/api/providers/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_provider_not_found(client):
    resp = client.get("/api/providers/nonexistent-id")
    assert resp.status_code == 404


def test_update_provider(client):
    created = _create_provider(client).json()
    resp = client.put(f"/api/providers/{created['id']}", json={"model": "claude-opus-4-6"})
    assert resp.status_code == 200
    assert resp.json()["model"] == "claude-opus-4-6"


def test_delete_provider(client):
    created = _create_provider(client).json()
    resp = client.delete(f"/api/providers/{created['id']}")
    assert resp.status_code == 204
    assert client.get(f"/api/providers/{created['id']}").status_code == 404


def test_duplicate_name_rejected(client):
    _create_provider(client)
    resp = _create_provider(client)
    assert resp.status_code == 409
