---
name: http-call
version: "1.0.0"
description: "Use this skill to make an outbound HTTP request to an external API or service. Use when a task requires calling a REST endpoint — fetching data, submitting a payload, or triggering an external action. Supports GET, POST, PUT, PATCH, DELETE. Returns the response status and body."
author: system
type: instruction
allowed-tools:
  - web_fetch
user-invocable: false
disable-model-invocation: false
---

## http-call

Makes a single HTTP request and returns the response.

### Input

```json
{
  "method": "GET | POST | PUT | PATCH | DELETE",
  "url": "string — fully qualified URL",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer <token>"
  },
  "body": "object | string | null — request body (for POST/PUT/PATCH)"
}
```

### Output

```json
{
  "status": "success",
  "result": {
    "statusCode": 200,
    "headers": {},
    "body": "string or parsed JSON object"
  }
}
```

### Error Output

```json
{
  "status": "error",
  "error": "HTTP 401 Unauthorised — check bearer token validity."
}
```

### Notes

- Credentials and tokens must never be stored in `session/` or `long-term/` memory.
  Retrieve them from secure config at call time.
- Treat any 4xx or 5xx response as an error and return the error envelope.
- Do not follow redirects silently — surface the redirect location in the result.
- Timeout is 30 seconds by default. Long-polling is not supported via this skill.
