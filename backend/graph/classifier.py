from langchain_core.messages import HumanMessage, SystemMessage

from db.models import Agent, RoutingRule
from graph.state import SupervisorState
from providers.factory import provider_factory


def build_classifier_node(supervisor: Agent, routing_rules: list[RoutingRule]):
    """
    Return a LangGraph node function that classifies the latest user message
    and sets state['intent'] to one of the available intent labels.

    The classifier prompt lists all valid intent labels from routing_rules so
    it always reflects the current DB state (rebuilt on every graph recompile).
    """
    llm = provider_factory(supervisor.provider)
    labels = [r.intent_label for r in routing_rules]
    labels_str = "\n".join(f"- {label}" for label in labels)

    system_prompt = (
        f"{supervisor.persona}\n\n"
        f"## Your Task\n\n"
        f"Read the user's message and respond with EXACTLY ONE of these intent labels — "
        f"no explanation, no punctuation, just the label:\n\n"
        f"{labels_str}\n\n"
        f"If no label fits, respond with: FALLBACK"
    )

    async def classifier_node(state: SupervisorState) -> dict:
        # Take the last user message as the input to classify
        last_user_message = next(
            (m.content for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
            "",
        )

        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=last_user_message),
        ])

        intent = response.content.strip()
        # Validate — fall back if the LLM returns something unexpected
        if intent not in labels:
            intent = "FALLBACK"

        return {"intent": intent}

    return classifier_node
