from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class SupervisorState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: str
    session_id: str
    intent: str | None   # set by classifier node; drives conditional routing
    response: str | None  # set by specialist subgraph; returned to caller
