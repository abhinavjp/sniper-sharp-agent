---
name: mcp-query
description: "Use this skill to query the MCP server for the user's current screen context in the UK Payroll App — what page they are on, what record is active, and what their role/permissions are. Always use this before giving navigation or screen-specific guidance."
allowed-tools:
  - web_fetch
scope: plugin
---

## mcp-query

Queries the MCP server for live contextual data about the user's current app state.

### Input

```json
{
  "userId": "string — bound userId from request context",
  "queryType": "screen | record | permissions | all"
}
```

### Output

```json
{
  "status": "success",
  "result": {
    "currentScreen": {
      "page": "string — e.g. 'Employee List', 'Pay Run > Period Selection'",
      "url": "string — relative URL path",
      "breadcrumb": ["string"]
    },
    "activeRecord": {
      "type": "string | null — e.g. 'Employee', 'Pay Run', 'Company'",
      "id": "string | null",
      "name": "string | null"
    },
    "userPermissions": ["string"]
  }
}
```

### Notes

- `queryType: "all"` returns the complete context object. Use this when unsure what you need.
- `queryType: "screen"` returns only `currentScreen` — use for navigation questions.
- `queryType: "record"` returns only `activeRecord` — use when the user mentions a specific record.
- If the MCP server is unavailable, return a descriptive error and advise the user to describe their screen manually.

> **Implementation note** (Phase 8): MCP server URL and authentication TBD.
> The MCP server is a sidecar service that reads the active browser/app session.
