"""
Seed the database with initial agents, skills, and routing rules.
Run from the backend/ directory: python seed.py

Safe to run multiple times — skips rows that already exist by name.
"""
from db.database import SessionLocal, init_db
from db.models import Agent, Provider, Skill, RoutingRule

PROVIDER = {
    "name": "Anthropic (Setup Auth)",
    "type": "anthropic-setup-auth",
    "credentials": {},
    "model": "claude-opus-4-6",
    "is_default": True,
}

SKILLS = [
    {
        "name": "http-call",
        "description": "Make an outbound HTTP GET or POST request to an external URL.",
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "The URL to call"},
                "method": {"type": "string", "enum": ["GET", "POST"], "default": "GET"},
                "body": {"type": "object", "description": "JSON body for POST requests"},
            },
            "required": ["url"],
        },
        "implementation": (
            "import httpx\n"
            "method = input.get('method', 'GET').upper()\n"
            "if method == 'POST':\n"
            "    resp = httpx.post(input['url'], json=input.get('body', {}))\n"
            "else:\n"
            "    resp = httpx.get(input['url'])\n"
            "return {'status_code': resp.status_code, 'body': resp.text}"
        ),
    },
    {
        "name": "classify-email",
        "description": "Classify an incoming email and return the intent label for routing.",
        "input_schema": {
            "type": "object",
            "properties": {
                "subject": {"type": "string"},
                "body": {"type": "string"},
                "sender": {"type": "string"},
            },
            "required": ["subject", "body"],
        },
        "implementation": "return {'intent': 'FALLBACK', 'confidence': 0.0}",
    },
    {
        "name": "process-starter",
        "description": "Submit a new starter employee record to the UK Payroll API.",
        "input_schema": {
            "type": "object",
            "properties": {
                "first_name": {"type": "string"},
                "last_name": {"type": "string"},
                "start_date": {"type": "string", "format": "date"},
                "ni_number": {"type": "string"},
            },
            "required": ["first_name", "last_name", "start_date"],
        },
        "implementation": (
            "import httpx\n"
            "resp = httpx.post('http://localhost:9000/api/starters', json=input)\n"
            "return {'status_code': resp.status_code, 'result': resp.json()}"
        ),
    },
    {
        "name": "import-timesheet",
        "description": "Import a timesheet record into the UK Payroll system.",
        "input_schema": {
            "type": "object",
            "properties": {
                "employee_id": {"type": "string"},
                "period_start": {"type": "string", "format": "date"},
                "period_end": {"type": "string", "format": "date"},
                "hours": {"type": "number"},
            },
            "required": ["employee_id", "period_start", "period_end", "hours"],
        },
        "implementation": (
            "import httpx\n"
            "resp = httpx.post('http://localhost:9000/api/timesheets/import', json=input)\n"
            "return {'status_code': resp.status_code, 'result': resp.json()}"
        ),
    },
    {
        "name": "create-task",
        "description": "Create a task in the UK Payroll system for manual follow-up.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "assigned_to": {"type": "string"},
                "due_date": {"type": "string", "format": "date"},
            },
            "required": ["title", "description"],
        },
        "implementation": (
            "import httpx\n"
            "resp = httpx.post('http://localhost:9000/api/tasks', json=input)\n"
            "return {'status_code': resp.status_code, 'result': resp.json()}"
        ),
    },
]

AGENTS = [
    {
        "name": "EmailClassifier",
        "persona": (
            "You are the EmailClassifier — a precision email triage agent for UK payroll operations.\n"
            "Your sole responsibility is to read incoming emails and determine which specialist "
            "agent should handle them.\n\n"
            "When classifying, output ONLY the intent label — no explanation, no preamble.\n"
            "Valid intent labels: starter-processing, timesheet-import, task-creation, FALLBACK"
        ),
        "rules": (
            "1. Never attempt to process payroll operations yourself — always delegate.\n"
            "2. If uncertain, use FALLBACK.\n"
            "3. Return a single intent label as plain text."
        ),
        "is_supervisor": True,
        "memory_enabled": False,
        "skill_names": ["classify-email"],
    },
    {
        "name": "PayrollWorker",
        "persona": (
            "You are the PayrollWorker — a specialist worker that executes UK Payroll API operations.\n"
            "You receive structured task inputs and must return structured JSON results.\n"
            "Never produce conversational prose. Always return valid JSON."
        ),
        "rules": (
            "1. Return only valid JSON — no markdown, no explanation.\n"
            "2. If an API call fails, return {\"status\": \"error\", \"message\": \"<reason>\"}.\n"
            "3. Never make decisions outside your assigned task."
        ),
        "is_supervisor": False,
        "memory_enabled": False,
        "skill_names": ["process-starter", "import-timesheet", "create-task", "http-call"],
    },
]

ROUTING_RULES = [
    {"intent_label": "starter-processing", "target_agent": "PayrollWorker", "priority": 0},
    {"intent_label": "timesheet-import",   "target_agent": "PayrollWorker", "priority": 0},
    {"intent_label": "task-creation",      "target_agent": "PayrollWorker", "priority": 0},
    {"intent_label": "FALLBACK",           "target_agent": "EmailClassifier", "priority": 99},
]


def seed():
    init_db()
    db = SessionLocal()
    try:
        # Provider
        provider = db.query(Provider).filter_by(name=PROVIDER["name"]).first()
        if not provider:
            provider = Provider(**PROVIDER)
            db.add(provider)
            db.commit()
            db.refresh(provider)
            print(f"  Created provider: {provider.name}")
        else:
            print(f"  Skipped provider (exists): {provider.name}")

        # Skills
        skill_map: dict[str, Skill] = {}
        for s_data in SKILLS:
            skill = db.query(Skill).filter_by(name=s_data["name"]).first()
            if not skill:
                skill = Skill(**s_data)
                db.add(skill)
                db.commit()
                db.refresh(skill)
                print(f"  Created skill: {skill.name}")
            else:
                print(f"  Skipped skill (exists): {skill.name}")
            skill_map[skill.name] = skill

        # Agents
        agent_map: dict[str, Agent] = {}
        for a_data in AGENTS:
            a_data = dict(a_data)
            skill_names = a_data.pop("skill_names")
            agent = db.query(Agent).filter_by(name=a_data["name"]).first()
            if not agent:
                agent = Agent(**a_data, provider_id=provider.id)
                agent.skills = [skill_map[n] for n in skill_names if n in skill_map]
                db.add(agent)
                db.commit()
                db.refresh(agent)
                print(f"  Created agent: {agent.name}")
            else:
                print(f"  Skipped agent (exists): {agent.name}")
            agent_map[agent.name] = agent

        # Routing rules
        supervisor = agent_map["EmailClassifier"]
        for r_data in ROUTING_RULES:
            target = agent_map[r_data["target_agent"]]
            existing = db.query(RoutingRule).filter_by(
                supervisor_id=supervisor.id,
                intent_label=r_data["intent_label"],
            ).first()
            if not existing:
                rule = RoutingRule(
                    supervisor_id=supervisor.id,
                    intent_label=r_data["intent_label"],
                    target_agent_id=target.id,
                    priority=r_data["priority"],
                )
                db.add(rule)
                db.commit()
                print(f"  Created routing rule: {r_data['intent_label']} -> {r_data['target_agent']}")
            else:
                print(f"  Skipped routing rule (exists): {r_data['intent_label']}")

        print("\nSeed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
