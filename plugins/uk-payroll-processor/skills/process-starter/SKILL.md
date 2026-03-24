---
name: process-starter
description: "Use this skill to submit a new employee starter record to the UK Payroll API. Use when the task type is STARTER and parsed attachment data is available. Calls POST /api/starters and returns the created record ID."
allowed-tools:
  - web_fetch
scope: plugin
---

## process-starter

Submits a starter payload to the UK Payroll API and returns the created record reference.

### Input

```json
{
  "companyId": "string",
  "starters": [
    {
      "firstName": "string",
      "lastName": "string",
      "startDate": "ISO 8601 date string — e.g. 2026-04-01",
      "niNumber": "string — UK National Insurance number",
      "taxCode": "string | null",
      "payrollId": "string | null"
    }
  ]
}
```

### Output

```json
{
  "status": "success",
  "result": {
    "recordsCreated": 3,
    "starterIds": ["string"],
    "apiReference": "string"
  }
}
```

### Error Output

```json
{
  "status": "error",
  "error": "API returned 422: NI number AB123456C is already registered for company XYZ."
}
```

### Notes

- `startDate` must be in ISO 8601 format (YYYY-MM-DD). Reject and error if malformed.
- Do not store API credentials or tokens in memory — retrieve from secure config at call time.
- Do not retry on 4xx errors — return the error envelope immediately.
- On 5xx errors, include the HTTP status code in the error message.
