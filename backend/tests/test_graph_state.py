from graph.state import SupervisorState


def test_supervisor_state_shape():
    """SupervisorState must be a TypedDict with the required keys."""
    import typing
    hints = typing.get_type_hints(SupervisorState)
    assert "messages" in hints
    assert "user_id" in hints
    assert "session_id" in hints
    assert "intent" in hints
    assert "response" in hints


def test_supervisor_state_instantiates():
    from langchain_core.messages import HumanMessage
    state: SupervisorState = {
        "messages": [HumanMessage(content="hello")],
        "user_id": "user-123",
        "session_id": "sess-abc",
        "intent": None,
        "response": None,
    }
    assert state["user_id"] == "user-123"
    assert state["intent"] is None
