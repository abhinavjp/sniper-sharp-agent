# Sniper Sharp Agent

Sniper Sharp Agent is an extensible, plugin-driven AI framework featuring a high-performance Python API backend and an intuitive React frontend.

## Architecture Structure

- **`backend/`**: A Python-based `FastAPI` service that orchestrates the agent logic, session memory, and handles communication with AI Model Providers.
- **`ui/`**: A `Vite` + `React` web application styled with `Tailwind CSS`, serving as the control centre to dynamically configure AI credentials (Anthropic, OpenAI, Google, Local Models) and interact with the agent subsystem.

---

## Getting Started

### Prerequisites
- [Python 3.12+](https://www.python.org/downloads/)
- [Node.js 20+](https://nodejs.org/en)

---

### Running the Python API Backend

The backend exposes the core capabilities as REST endpoints.

1. Open a new terminal and navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   - **Windows:**
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate
     ```
   - **macOS/Linux:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
3. Install the API requirements (FastAPI, Uvicorn, Pydantic):
   ```bash
   pip install fastapi 'uvicorn[standard]' pydantic
   ```
4. Start the development server (runs on port `8000`):
   ```bash
   uvicorn main:app --reload --port 8000
   ```

---

### Running the React Web UI

The UI provides the model selection interface to pair credentials and control flow to the backend API.

1. Open a **second** terminal instance and navigate to the `ui/` directory:
   ```bash
   cd ui
   ```
2. Install the necessary Node/NPM dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Access the web interface by opening your browser to: **http://localhost:5173**
