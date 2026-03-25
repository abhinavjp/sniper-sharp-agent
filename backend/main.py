from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any

app = FastAPI(title="Sniper Sharp Agent API", description="Backend API for the agent framework")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory mock for configuration until we port memory management
_config_store = {
    "provider": "anthropic", # default
    "credentials": {}
}

class ConfigPayload(BaseModel):
    provider: str
    credentials: Dict[str, str]

class ChatPayload(BaseModel):
    userId: str
    message: str
    
@app.get("/api/config")
async def get_config():
    return _config_store

@app.post("/api/config")
async def update_config(payload: ConfigPayload):
    _config_store["provider"] = payload.provider
    _config_store["credentials"] = payload.credentials
    return {"status": "success", "config": _config_store}

@app.post("/api/chat")
async def chat(payload: ChatPayload):
    # This will be replaced by the actual agent loop
    # For now, return a mock response
    return {
        "status": "success",
        "response": f"Mock response to: {payload.message}",
        "userId": payload.userId
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
