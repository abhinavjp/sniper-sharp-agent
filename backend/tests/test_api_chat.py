from unittest.mock import AsyncMock, patch


def _setup(client):
    """Seed a provider, supervisor agent, and session."""
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
    session = client.post("/api/sessions", json={
        "user_id": "user-123",
        "agent_id": agent["id"],
    }).json()
    return session["id"]


def test_chat_requires_message(client):
    resp = client.post("/api/chat", json={"session_id": "any", "message": ""})
    assert resp.status_code == 422


def test_chat_requires_session_id(client):
    resp = client.post("/api/chat", json={"message": "hello"})
    assert resp.status_code == 422


def test_chat_session_not_found(client):
    resp = client.post("/api/chat", json={"session_id": "bad-id", "message": "hello"})
    assert resp.status_code == 404


def test_chat_returns_response(client):
    session_id = _setup(client)

    # Mock the graph registry to return a fixed response without real LLM
    mock_graph = AsyncMock()
    mock_graph.ainvoke.return_value = {
        "messages": [],
        "intent": "FALLBACK",
        "response": "Mocked LLM response",
    }

    with patch("api.chat.graph_registry") as mock_registry:
        mock_registry.get = AsyncMock(return_value=mock_graph)
        resp = client.post("/api/chat", json={
            "session_id": session_id,
            "message": "Process this starter",
        })

    assert resp.status_code == 200
    data = resp.json()
    assert "response" in data
    assert data["session_id"] == session_id
    assert data["turn_count"] == 1


def test_chat_persists_history(client):
    session_id = _setup(client)

    mock_graph = AsyncMock()
    mock_graph.ainvoke.return_value = {
        "messages": [],
        "intent": "FALLBACK",
        "response": "First response",
    }

    with patch("api.chat.graph_registry") as mock_registry:
        mock_registry.get = AsyncMock(return_value=mock_graph)
        client.post("/api/chat", json={"session_id": session_id, "message": "First message"})
        resp = client.post("/api/chat", json={"session_id": session_id, "message": "Second message"})

    assert resp.json()["turn_count"] == 2


def test_chat_preserves_assistant_history(client):
    """Turn 2 must receive both the human and assistant messages from turn 1."""
    session_id = _setup(client)
    captured_states = []

    async def fake_invoke(state):
        captured_states.append(state)
        return {
            "messages": state["messages"],
            "intent": "FALLBACK",
            "response": "I said hello back.",
        }

    mock_graph = AsyncMock()
    mock_graph.ainvoke.side_effect = fake_invoke

    with patch("api.chat.graph_registry") as mock_registry:
        mock_registry.get = AsyncMock(return_value=mock_graph)
        client.post("/api/chat", json={"session_id": session_id, "message": "Hello"})
        client.post("/api/chat", json={"session_id": session_id, "message": "What did you say?"})

    from langchain_core.messages import HumanMessage, AIMessage
    second_messages = captured_states[1]["messages"]
    assert any(isinstance(m, HumanMessage) and m.content == "Hello" for m in second_messages), \
        "Turn-1 user message missing from turn-2 state"
    assert any(isinstance(m, AIMessage) and m.content == "I said hello back." for m in second_messages), \
        "Turn-1 assistant message missing from turn-2 state"


def test_chat_graph_not_compiled(client):
    session_id = _setup(client)

    with patch("api.chat.graph_registry") as mock_registry:
        mock_registry.get = AsyncMock(return_value=None)
        resp = client.post("/api/chat", json={"session_id": session_id, "message": "hello"})

    assert resp.status_code == 503
    assert "not ready" in resp.json()["detail"].lower()
