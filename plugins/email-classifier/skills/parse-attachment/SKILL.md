---
name: parse-attachment
description: "Use this skill to extract structured tabular or form data from an email attachment (CSV, XLSX, or PDF). Use after classify-email has identified a STARTER or TIMESHEET email, to prepare the data payload for the worker sub-agent."
allowed-tools:
  - read_file
  - bash
scope: plugin
---

## parse-attachment

Parses an email attachment and returns its contents as a structured JSON array or object.

### Supported Formats

| Format | Notes |
|---|---|
| `.csv` | Parsed as rows of key-value objects, headers from first row |
| `.xlsx` | First sheet parsed; headers from first row |
| `.pdf` | Text extraction only — structured fields extracted via pattern matching |

### Input

```json
{
  "path": "string — absolute path to the attachment file",
  "mimeType": "string — MIME type hint (text/csv, application/vnd.openxmlformats...)",
  "expectedSchema": "STARTER_ROWS | TIMESHEET_ROWS | UNKNOWN"
}
```

### Output

```json
{
  "status": "success",
  "result": {
    "format": "csv | xlsx | pdf",
    "rowCount": 12,
    "rows": [
      {
        "firstName": "Jane",
        "lastName": "Smith",
        "startDate": "2026-04-01",
        "niNumber": "AB123456C"
      }
    ]
  }
}
```

### Notes

- Do not store raw attachment content in long-term memory — only store the parsed structured result.
- If the attachment cannot be parsed, return a `status: error` with a description.
- `expectedSchema` is a hint only — the skill will attempt to infer the schema if UNKNOWN.
