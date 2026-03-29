from langchain_core.messages import HumanMessage

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session as DbSession

from db.database import get_db
from db.models import Session
from graph.registry import graph_registry
from graph.state import SupervisorState

router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    session_id: str
    message: str

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("message must not be empty")
        return v.strip()


class ChatResponse(BaseModel):
    response: str
    session_id: str
    intent: str | None
    turn_count: int


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, db: DbSession = Depends(get_db)):
    # Resolve session
    session = db.get(Session, body.session_id)
    if not session:
        raise HTTPException(404, f"Session '{body.session_id}' not found")

    # Ensure graph is compiled
    graph = await graph_registry.get()
    if graph is None:
        raise HTTPException(
            503,
            detail="Graph not ready — no supervisor agent configured. Seed the DB and call POST /api/graph/rebuild.",
        )

    # Build history messages for LangGraph state
    history_messages = []
    for turn in session.history:
        if turn["role"] == "user":
            history_messages.append(HumanMessage(content=turn["content"]))
        # assistant messages are included as AIMessage — LangGraph handles reconstruction

    # Run the graph
    initial_state: SupervisorState = {
        "messages": history_messages + [HumanMessage(content=body.message)],
        "user_id": session.user_id,
        "session_id": session.id,
        "intent": None,
        "response": None,
    }

    result: SupervisorState = await graph.ainvoke(initial_state)

    # Extract text response from result messages
    response_text = result.get("response") or _extract_last_ai_message(result["messages"])

    # Persist turn to session history
    history = list(session.history)
    history.append({"role": "user", "content": body.message})
    history.append({"role": "assistant", "content": response_text})
    session.history = history
    db.commit()

    return ChatResponse(
        response=response_text,
        session_id=session.id,
        intent=result.get("intent"),
        turn_count=len(history) // 2,
    )


def _extract_last_ai_message(messages: list) -> str:
    """Extract text from the last AI message in the message list."""
    from langchain_core.messages import AIMessage
    for msg in reversed(messages):
        if isinstance(msg, AIMessage):
            return msg.content if isinstance(msg.content, str) else str(msg.content)
    return ""
