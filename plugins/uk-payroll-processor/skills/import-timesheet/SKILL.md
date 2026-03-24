---
name: import-timesheet
description: "Use this skill to import timesheet data into the UK Payroll API. Use when the task type is TIMESHEET and parsed attachment rows are available. Calls POST /api/timesheets/import and returns the import batch reference."
allowed-tools:
  - web_fetch
scope: plugin
---

## import-timesheet

Submits a batch of timesheet rows to the UK Payroll API import endpoint.

### Input

```json
{
  "companyName": "string",
  "payFrequency": "WEEKLY | FORTNIGHTLY | MONTHLY | FOUR_WEEKLY",
  "payPeriod": "string — e.g. 2026-04",
  "rows": [
    {
      "employeeId": "string",
      "hoursWorked": "number",
      "overtimeHours": "number | null",
      "date": "ISO 8601 date string"
    }
  ]
}
```

### Output

```json
{
  "status": "success",
  "result": {
    "batchId": "string",
    "rowsImported": 42,
    "rowsRejected": 1,
    "rejectionReasons": [
      {
        "row": 14,
        "reason": "Employee ID EMP-0042 not found in company payroll."
      }
    ]
  }
}
```

### Error Output

```json
{
  "status": "error",
  "error": "API returned 400: payPeriod '2026-04' is already locked for company XYZ."
}
```

### Notes

- `payFrequency` must be one of the declared enum values. Reject unknown values with a descriptive error.
- Partial success (some rows rejected) is still `status: success` — rejections are in `rejectionReasons`.
- Full API failure (non-200 response) is `status: error`.
- Do not store timesheet data in long-term memory.
