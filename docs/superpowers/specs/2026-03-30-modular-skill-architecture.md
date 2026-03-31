# Specification: Skill-as-a-Package Modular Architecture

**Date:** 2026-03-30
**Status:** Approved (Phase 7)
**Scope:** Python backend migration from hard-coded DB skills to a modular, package-based skill architecture aligned with the Claude Code / Cowork skill package convention.

---

## 1. Context and Motivation

Currently, skills are stored directly in the `skills` table (SQLite) and executed natively via Python's `exec()` function. As the framework evolves toward a multi-tenant app ecosystem (where external third-party connected apps can push skills to the system), this creates a security vulnerability and isolates development to a single mono-database model.

This spec outlines the migration to a **Skill-as-a-Package** setup, supporting:
1. **Hybrid Storage**: System-scope skills live on the filesystem (`/.agents/skills/`); tenant and user skills are stored in the DB.
2. **Multi-Tenant Security**: Third-party scripts execute in sandboxed subprocesses rather than native `exec()`.
3. **Structured Frontend Design**: App skills can push UI references, restricted to strict minimal glassmorphic definitions found in `FRONTEND_DESIGN_CONVENTIONS.md`.

---

## 2. Skill Package Standard

Every skill is a named directory. The package format mirrors the Claude Code / Cowork skill convention exactly.

### Directory Structure

```text
{skill-name}/
├── SKILL.md            # Entry point (required). YAML frontmatter + instruction body.
├── scripts/            # Executable files (main.py, index.js). Only present for type: executable.
├── references/         # RAG documents or static JSON definitions. Loaded on demand.
└── assets/             # UI components, templates, icons. Must follow FRONTEND_DESIGN_CONVENTIONS.md.
```

### The SKILL.md Manifest

```yaml
---
name: "kebab-case-skill"
version: "1.0.0"
description: "Precise one-to-two sentence description of WHEN and WHY to invoke this skill."
author: system                    # one of: system | {tenant_id} | user
type: instruction                 # instruction = LLM body is the logic; executable = scripts/main.py runs in sandbox
allowed-tools:
  - http-call
user-invocable: false             # true = exposed as /slash-command to the human user
disable-model-invocation: false   # true = only callable by hooks/system triggers, never by LLM reasoning
context-requirements:             # Optional — declare what must be injected at load time
  - user_id
---

# Instruction Set
Detailed LLM prompt instructions that dictate the logic for `type: instruction` skills.
For `type: executable` skills, this section describes what the script does and its input/output contract.
```

### Skill Types

| `type` | Body of SKILL.md | `scripts/` present? | Executed by |
|---|---|---|---|
| `instruction` | LLM instructions — the body IS the logic | No | The LLM / Claude |
| `executable` | Input/output contract description | Yes (`scripts/main.py`) | Python `skills/executor.py` in sandbox |

**The 4 existing core skills** (`read-file`, `bash-exec`, `http-call`, `frontend-design`) are all `type: instruction`. They tell Claude what to do — they have no Python scripts.

**DB-stored skills** (created via the SkillsView UI) are `type: executable`. Their implementation code moves into `scripts/main.py` within their package directory.

---

## 3. Storage Plurality & Resolution Hierarchy

A URI format handles dynamic skill resolution at run-time: `skill://{scope}/{skill_name}@{version}`.

When a graph starts, `build_tools_for_agent()` loads skills with the following override precedence:

1. **User Scope**: `skill://user/{user_id}/{skill-name}` — per-user overrides in `memory/users/{userId}/preferences/skills/`
2. **Tenant Scope**: `skill://tenant/{tenant_id}/{skill-name}` — DB row with `tenant_id` set (connected app ecosystem)
3. **System Scope**: `skill://system/{skill-name}` — physical `.agents/skills/{name}/SKILL.md`

Higher specificity wins. System scope is the fallback.

---

## 4. Execution Sandbox

The `skills/executor.py` module is refactored in two phases:

**Phase 1 (Current):** `exec()` with a restricted `__builtins__` globals dictionary. Suitable for trusted system skills only.

**Phase 2 (Target):** Subprocess invocation for `scripts/main.py`, enforcing strict IO buffering and network disablement (unless `http-call` bridging is declared in `allowed-tools`). This is the required approach for tenant and user-scope executable skills.

---

## 5. DB Migration

The `skills` table gains two nullable columns to support multi-tenant resolution:

| Column | Type | Default | Purpose |
|---|---|---|---|
| `tenant_id` | `VARCHAR` | `NULL` | Non-null for tenant-scope skills |
| `user_id` | `VARCHAR` | `NULL` | Non-null for user-scope skills |
| `scope` | `VARCHAR` | `'system'` | Computed from `tenant_id`/`user_id`; used in resolution |

System-scope DB skills (where both are NULL) are migrated to filesystem packages under `.agents/skills/` and removed from the DB.

---

## 6. Ingestion API

Two new endpoints support the external app ecosystem:

- `POST /api/skills/ingest` — Accepts a skill package (SKILL.md + optional scripts) from an authorised third-party app. Stores as a tenant-scope DB row.
- `POST /api/skills/authorise` — Grants a specific `user_id` permission to use a tenant-scope skill. Creates a user-scope override row.

---

## 7. UI Convention Rules

When UI elements are provided via the `assets/` folder of a skill package, they must conform to `FRONTEND_DESIGN_CONVENTIONS.md`. Skill authors cannot inject arbitrary global CSS or override core layout systems. Dark mode support and micro-animations must be preserved.
