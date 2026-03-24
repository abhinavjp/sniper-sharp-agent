# EmailClassifier Plugin

**Plugin ID**: `email-classifier`
**Version**: `0.1.0`
**Role**: Email triage orchestrator

## Overview

EmailClassifier analyses incoming emails and their attachments, classifies them into one of three categories, and dispatches the appropriate `uk-payroll-processor` worker sub-agent to handle the downstream API call.

## Classification Categories

| Category | Triggers | Worker Skill |
|---|---|---|
| `STARTER` | Subject/body mentions new employee, attachment present | `process-starter` |
| `TIMESHEET` | Subject/body mentions timesheets/hours/pay run, attachment present | `import-timesheet` |
| `TASK` | Does not match above — task ticket created | `create-task` |

## Skills

| Skill | Purpose |
|---|---|
| `classify-email` | Reads email subject, body, attachments and produces a classification result |
| `parse-attachment` | Extracts structured data from CSV, XLSX, or PDF attachments |

## Sub-Agent

This plugin spawns `uk-payroll-processor` workers for all three classification branches.
Worker definition: `.agents/subagents/uk-payroll-processor-worker.yaml`

## Implementation Status

- [ ] Skills implemented (Phase 6)
- [ ] SOUL.md finalised
- [ ] Sub-agent definition written
- [ ] End-to-end test passing
