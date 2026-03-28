from langchain_openai import ChatOpenAI


def create(model: str, credentials: dict) -> ChatOpenAI:
    return ChatOpenAI(model=model, api_key=credentials["api_key"])
