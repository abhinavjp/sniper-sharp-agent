from langchain_openai import ChatOpenAI


def create(model: str, credentials: dict) -> ChatOpenAI:
    return ChatOpenAI(
        model=model,
        base_url=credentials["base_url"],
        api_key=credentials.get("api_key", "local"),
    )
