---
name: create-task
description: "Use this skill to create a task ticket in the UK Payroll system for emails that do not match STARTER or TIMESHEET categories. Attaches the original email subject, body, and any attachments to the task. Calls POST /api/tasks."
allowed-tools:
  - web_fetch
scope: plugin
---

## create-task

Creates a task ticket and attaches the original email content to it.

### Input

```json
{
  "title": "string — derived from email subject",
  "description": "string — email body (plain text)",
  "priority": "LOW | MEDIUM | HIGH",
  "attachments": [
    {
      "filename": "string",
      "path": "string — local path to attachment file"
    }
  ],
  "sourceEmail": {
    "from": "string",
    "receivedAt": "ISO 8601 datetime string"
  }
}
```

### Output

```json
{
  "status": "success",
  "result": {
    "taskId": "string",
    "taskUrl": "string — link to the created task in the payroll system",
    "priority": "LOW | MEDIUM | HIGH"
  }
}
```

### Error Output

```json
{
  "status": "error",
  "error": "API returned 503: task creation service temporarily unavailable."
}
```

### Notes

- Default `priority` to `MEDIUM` if not determinable from email content.
- `title` must not exceed 200 characters — truncate with "…" if longer.
- Always include `sourceEmail.from` and `sourceEmail.receivedAt` for audit traceability.
- Attachments are submitted as multipart form data — this skill handles the encoding.
