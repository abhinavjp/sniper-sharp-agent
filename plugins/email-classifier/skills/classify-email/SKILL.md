---
name: classify-email
description: "Use this skill to classify an incoming email into STARTER, TIMESHEET, or TASK based on its subject, body, and attachments. Use this as the first step in the email processing pipeline — always before dispatching a worker sub-agent."
allowed-tools:
  - read_file
scope: plugin
---

## classify-email

Reads the email subject, body, and attachment metadata, then returns a structured classification result.

### Input

```json
{
  "subject": "string — email subject line",
  "body": "string — plain-text email body",
  "attachments": [
    {
      "filename": "string",
      "mimeType": "string",
      "path": "string — local path to the attachment file"
    }
  ]
}
```

### Output

```json
{
  "status": "success",
  "result": {
    "classification": "STARTER | TIMESHEET | TASK",
    "confidence": "HIGH | MEDIUM | LOW",
    "reason": "string — one-sentence justification for the classification",
    "attachmentPaths": ["string"],
    "extractedMetadata": {
      "companyName": "string | null",
      "payFrequency": "string | null",
      "payPeriod": "string | null"
    }
  }
}
```

### Classification Logic

| Classification | Indicators |
|---|---|
| `STARTER` | Subject/body contains: starter, new employee, new joiner, onboarding + attachment present |
| `TIMESHEET` | Subject/body contains: timesheet, hours, pay run, time import, payroll import + attachment present |
| `TASK` | Does not clearly match either above — default to TASK to prevent data loss |

### Notes

- When in doubt, classify as `TASK`. Never discard an email.
- `extractedMetadata` fields are best-effort — null if not found in the email body.
- `confidence` reflects how clearly the email matched the classification criteria.
