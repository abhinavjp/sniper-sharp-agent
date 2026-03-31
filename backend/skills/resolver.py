import logging
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from db.models import Agent, Skill
from skills.hook import HookSkill, fetch_hook_skills
from skills.loader import SystemSkill

logger = logging.getLogger(__name__)


@dataclass
class ResolvedSkill:
    name: str
    description: str
    skill_type: str
    implementation: str
    version: str
    author: str
    allowed_tools: list[str] = field(default_factory=list)
    user_invocable: bool = False
    disable_model_invocation: bool = False
    context_requirements: list[str] = field(default_factory=list)
    source: str = "system"  # "hook" | "user" | "system"


def _from_hook(skill: HookSkill) -> ResolvedSkill:
    return ResolvedSkill(
        name=skill.name,
        description=skill.description,
        skill_type=skill.skill_type,
        implementation=skill.implementation,
        version=skill.version,
        author="hook",
        allowed_tools=skill.allowed_tools,
        user_invocable=skill.user_invocable,
        disable_model_invocation=skill.disable_model_invocation,
        context_requirements=skill.context_requirements,
        source="hook",
    )


def _from_db(skill: Skill) -> ResolvedSkill:
    return ResolvedSkill(
        name=skill.name,
        description=skill.description,
        skill_type=getattr(skill, "skill_type", "executable"),
        implementation=skill.implementation,
        version=getattr(skill, "version", "1.0.0"),
        author=getattr(skill, "author", "user"),
        allowed_tools=list(getattr(skill, "allowed_tools", None) or []),
        user_invocable=bool(getattr(skill, "user_invocable", False)),
        disable_model_invocation=bool(getattr(skill, "disable_model_invocation", False)),
        context_requirements=list(getattr(skill, "context_requirements", None) or []),
        source="user",
    )


def _from_system(skill: SystemSkill) -> ResolvedSkill:
    return ResolvedSkill(
        name=skill.name,
        description=skill.description,
        skill_type=skill.skill_type,
        implementation=skill.body,
        version=skill.version,
        author=skill.author,
        allowed_tools=skill.allowed_tools,
        user_invocable=skill.user_invocable,
        disable_model_invocation=skill.disable_model_invocation,
        context_requirements=skill.context_requirements,
        source="system",
    )


async def resolve_skills(
    agent: Agent,
    user_id: str | None,
    session_id: str | None,
    metadata: dict | None,
    system_skills: list[SystemSkill],
    db: Session,
) -> list[ResolvedSkill]:
    """
    Merge skills from three sources in priority order: hook > user DB > system.
    Skills with disable_model_invocation=True are excluded from the result.
    On name collision, the higher-priority source wins.

    The `db` parameter is accepted for future direct-query extensions but is not
    currently used — DB skills are accessed via the pre-loaded `agent.skills` relationship.
    """
    seen: set[str] = set()
    results: list[ResolvedSkill] = []

    def _add(skill: ResolvedSkill) -> None:
        if skill.disable_model_invocation:
            return
        if skill.name not in seen:
            seen.add(skill.name)
            results.append(skill)

    # 1. Hook skills (highest priority)
    if agent.skill_hook_url:
        hook_skills = await fetch_hook_skills(
            hook_url=agent.skill_hook_url,
            hook_secret=agent.skill_hook_secret,
            user_id=user_id or "",
            agent_id=agent.id,
            session_id=session_id,
            metadata=metadata or {},
        )
        for hs in hook_skills:
            _add(_from_hook(hs))

    # 2. DB skills attached to this agent, filtered by user_id
    for db_skill in agent.skills:
        skill_user_id = getattr(db_skill, "user_id", None)
        if skill_user_id is not None and skill_user_id != user_id:
            continue  # scoped to a different user
        _add(_from_db(db_skill))

    # 3. System filesystem skills (lowest priority)
    for sys_skill in system_skills:
        _add(_from_system(sys_skill))

    return results
