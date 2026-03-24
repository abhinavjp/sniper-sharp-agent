---
name: bash-exec
description: "Use this skill to execute a shell command on the host system. Use only when no higher-level skill covers the task — e.g. running a build script, checking a process, or interacting with the filesystem in a way read-file cannot. Restricted to non-interactive, single-line commands."
allowed-tools:
  - bash
disable-model-invocation: false
scope: core
---

## bash-exec

Executes a single non-interactive shell command and returns stdout, stderr, and exit code.

### Input

```json
{
  "command": "string — the shell command to execute",
  "workingDir": "string | null — working directory (defaults to project root)"
}
```

### Output

```json
{
  "status": "success",
  "result": {
    "exitCode": 0,
    "stdout": "string",
    "stderr": "string"
  }
}
```

### Error Output

```json
{
  "status": "error",
  "error": "Command exited with code 1. stderr: <message>"
}
```

### Restrictions

- **No interactive commands** — commands that require stdin input will timeout and fail.
- **No background processes** — do not use `&`, `nohup`, or `screen`.
- **No destructive commands** without explicit user confirmation — avoid `rm -rf`, `DROP TABLE`, etc.
- **No credential exposure** — do not echo tokens, passwords, or API keys to stdout.
- Timeout is 60 seconds. Long-running processes must be handled via background tasks.
- Prefer `read-file` for reading files and `http-call` for API calls — use this skill only as a last resort.
