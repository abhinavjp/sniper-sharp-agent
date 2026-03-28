from langchain_google_genai import ChatGoogleGenerativeAI


def create(model: str, credentials: dict) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(model=model, google_api_key=credentials["api_key"])
