---
name: read-file
version: "1.0.0"
description: "Use this skill to read the contents of a file from the filesystem. Use when you need to inspect a local file's content — config files, skill definitions, memory entries, or any text-based file. Returns the raw file content as a string."
author: system
type: instruction
allowed-tools:
  - read_file
user-invocable: false
disable-model-invocation: false
---

## read-file

Reads a file at the given path and returns its full content as a UTF-8 string.

### Input

```json
{
  "path": "string — absolute or workspace-relative file path"
}
```

### Output

```json
{
  "status": "success",
  "result": {
    "content": "string — full file content",
    "path": "string — resolved absolute path"
  }
}
```

### Error Output

```json
{
  "status": "error",
  "error": "File not found at path: /absolute/path/to/file"
}
```

### Notes

- Always use absolute paths when possible to avoid ambiguity.
- Binary files are not supported — this skill reads UTF-8 text only.
- Do not use this skill to read files outside the declared working memory boundary.
