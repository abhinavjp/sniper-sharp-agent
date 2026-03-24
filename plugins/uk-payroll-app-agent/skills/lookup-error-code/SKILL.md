---
name: lookup-error-code
description: "Use this skill to look up a specific error code from the UK Payroll App error catalogue. Use when the user mentions an error code or error message. Returns the error description, likely cause, and recommended resolution steps."
allowed-tools:
  - read_file
scope: plugin
---

## lookup-error-code

Looks up an error code in the indexed error catalogue and returns its full description and resolution guidance.

### Input

```json
{
  "errorCode": "string — the exact error code shown in the app (e.g. 'RTI-401', 'EMP-1042')",
  "context": "string | null — optional additional context from the user's description"
}
```

### Output

```json
{
  "status": "success",
  "result": {
    "errorCode": "string",
    "title": "string — short error title",
    "description": "string — full description of what this error means",
    "likelyCauses": ["string"],
    "resolutionSteps": ["string — numbered step-by-step resolution"],
    "relatedDocumentation": "string | null — link or section reference"
  }
}
```

### Error Output (code not found)

```json
{
  "status": "error",
  "error": "Error code 'XYZ-999' not found in the catalogue. Falling back to rag-search."
}
```

### Notes

- If the exact code is not found, return the error and let the orchestrator fall back to `rag-search`.
- `context` is used to disambiguate errors that have multiple possible causes.
- Resolution steps must be concrete and actionable — not generic ("contact support").

> **Implementation note** (Phase 8): Error catalogue is stored in `memory/shared/long-term/error-catalogue/`.
> It is a structured JSON index, not a vector store — lookup is exact by error code.
