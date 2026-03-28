import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.getenv("DB_PATH", str(Path(__file__).parent / "agent_framework.db"))
PORT = int(os.getenv("PORT", "8000"))
HOOK_TIMEOUT_SECONDS = int(os.getenv("HOOK_TIMEOUT_SECONDS", "5"))
