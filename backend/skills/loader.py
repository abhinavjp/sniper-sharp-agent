import logging
from dataclasses import dataclass, field
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)

_FRONTMATTER_DELIMITER = "---"


@dataclass
class SystemSkill:
    name: str
    description: str
    version: str = "1.0.0"
    author: str = "system"
    skill_type: str = "instruction"
    allowed_tools: list[str] = field(default_factory=list)
    user_invocable: bool = False
    disable_model_invocation: bool = False
    context_requirements: list[str] = field(default_factory=list)
    body: str = ""
    source_path: str = ""


def _parse_skill_md(path: Path) -> SystemSkill | None:
    """Parse a SKILL.md file into a SystemSkill. Returns None on any parse error."""
    try:
        raw = path.read_text(encoding="utf-8")
    except Exception as exc:
        logger.warning("skills.loader: cannot read %s — %s", path, exc)
        return None

    # Must start with a frontmatter block
    if not raw.startswith(_FRONTMATTER_DELIMITER):
        logger.warning("skills.loader: no frontmatter in %s — skipping", path)
        return None

    parts = raw.split(_FRONTMATTER_DELIMITER, maxsplit=2)
    # parts[0] = "" (before first ---), parts[1] = yaml, parts[2] = body
    if len(parts) < 3:
        logger.warning("skills.loader: malformed frontmatter in %s — skipping", path)
        return None

    try:
        fm = yaml.safe_load(parts[1]) or {}
    except yaml.YAMLError as exc:
        logger.warning("skills.loader: YAML error in %s — %s", path, exc)
        return None

    if not isinstance(fm, dict):
        logger.warning("skills.loader: frontmatter is not a mapping in %s — skipping", path)
        return None

    name = fm.get("name")
    description = fm.get("description")
    if not name or not description:
        logger.warning("skills.loader: missing required name/description in %s — skipping", path)
        return None

    return SystemSkill(
        name=str(name),
        description=str(description),
        version=str(fm.get("version", "1.0.0")),
        author=str(fm.get("author", "system")),
        skill_type=str(fm.get("type", "instruction")),
        allowed_tools=list(fm.get("allowed-tools") or []),
        user_invocable=bool(fm.get("user-invocable", False)),
        disable_model_invocation=bool(fm.get("disable-model-invocation", False)),
        context_requirements=list(fm.get("context-requirements") or []),
        body=parts[2].strip(),
        source_path=str(path),
    )


def load_system_skills(skills_dir: Path) -> list[SystemSkill]:
    """
    Scan skills_dir for subdirectories containing SKILL.md.
    Returns a list of successfully parsed SystemSkill objects.
    Unparseable entries are skipped with a warning log.
    """
    results: list[SystemSkill] = []
    if not skills_dir.is_dir():
        logger.warning("skills.loader: skills_dir %s does not exist", skills_dir)
        return results

    for entry in sorted(skills_dir.iterdir()):
        if not entry.is_dir():
            continue
        skill_md = entry / "SKILL.md"
        if not skill_md.exists():
            continue
        skill = _parse_skill_md(skill_md)
        if skill is not None:
            results.append(skill)

    return results
