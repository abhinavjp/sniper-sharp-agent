---
name: code-analysis
description: "Use this skill to analyse a TypeScript source file or directory for correctness, convention violations (per docs/CONVENTIONS.md), and simplification opportunities. Returns a structured list of findings grouped by severity."
allowed-tools:
  - read_file
  - bash
scope: plugin
---

## code-analysis

Reads and analyses TypeScript source files, returning structured findings grouped by severity.

### Input

```json
{
  "path": "string — absolute path to file or directory to analyse",
  "focus": "correctness | conventions | all",
  "conventionsRef": "docs/CONVENTIONS.md"
}
```

### Output

```json
{
  "status": "success",
  "result": {
    "filesAnalysed": 3,
    "findings": [
      {
        "severity": "ERROR | WARNING | INFO",
        "file": "string — relative file path",
        "line": 42,
        "rule": "string — convention rule or TypeScript rule name",
        "message": "string — precise description of the finding",
        "suggestion": "string | null — how to fix it"
      }
    ],
    "summary": {
      "errors": 0,
      "warnings": 2,
      "info": 5
    }
  }
}
```

### Severity Levels

| Severity | Meaning |
|---|---|
| `ERROR` | Correctness issue or hard convention violation — must be fixed |
| `WARNING` | Convention deviation or code smell — should be fixed |
| `INFO` | Improvement opportunity — consider fixing |

### Notes

- Always check against `docs/CONVENTIONS.md` §9 (Forbidden Patterns) first.
- Report findings in order: ERRORs first, then WARNINGs, then INFOs.
- `suggestion` must be actionable — not generic ("refactor this").
- Do not modify any files — analysis only.

> **Implementation note** (Phase 9): Analysis uses TypeScript compiler API for type-level checks
> and custom rule matchers for convention enforcement.
