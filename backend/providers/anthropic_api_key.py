from langchain_anthropic import ChatAnthropic


def create(model: str, credentials: dict) -> ChatAnthropic:
    return ChatAnthropic(model=model, api_key=credentials["api_key"])
