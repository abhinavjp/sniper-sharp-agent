/**
 * tool-executor.ts
 *
 * Executes tool calls from the LLM. Two categories:
 *
 * 1. Leaf tools (Core skills) — directly executable:
 *    - read-file   → node:fs read
 *    - http-call   → global fetch
 *    - bash-exec   → child_process.exec
 *
 * 2. Plugin skills (e.g. classify-email, process-starter) — progressive disclosure:
 *    When the LLM calls a plugin skill, the executor loads the full SKILL.md body
 *    and returns it as context. The LLM then uses that context + leaf tools to execute
 *    the actual work. This implements the progressive-disclosure pattern described in
 *    docs/PROPOSED_ARCHITECTURE.md §2.
 *
 * Tool result shape — always matches the output contract from CONVENTIONS.md §5:
 *   { status: "success", result: { ... } }
 *   { status: "error",   error: "concise message" }
 */

import { exec } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { SkillSummary } from '../types/plugin.js';
import { loadSkillFull } from './skill-loader.js';

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Result Envelopes
// ---------------------------------------------------------------------------

export interface ToolSuccess<T = unknown> {
  status: 'success';
  result: T;
}

export interface ToolError {
  status: 'error';
  error: string;
}

export type ToolResult<T = unknown> = ToolSuccess<T> | ToolError;

// ---------------------------------------------------------------------------
// Tool Executor
// ---------------------------------------------------------------------------

export class ToolExecutor {
  /** Skill roster — used to locate SKILL.md files for progressive disclosure. */
  private readonly skillRoster: SkillSummary[];

  constructor(skillRoster: SkillSummary[]) {
    this.skillRoster = skillRoster;
  }

  /**
   * Dispatches a tool call to the appropriate handler.
   * Returns a ToolResult object that is serialised and returned to the LLM.
   */
  async execute(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<ToolResult> {
    try {
      switch (toolName) {
        case 'read-file':
          return await this.executeReadFile(input);

        case 'http-call':
          return await this.executeHttpCall(input);

        case 'bash-exec':
          return await this.executeBashExec(input);

        default:
          // Plugin skill — progressive disclosure: load full SKILL.md body as context
          return await this.executePluginSkill(toolName);
      }
    } catch (err) {
      return {
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Leaf Tool: read-file
  // ---------------------------------------------------------------------------

  private async executeReadFile(
    input: Record<string, unknown>,
  ): Promise<ToolResult> {
    const path = input['path'];
    if (typeof path !== 'string' || path.trim() === '') {
      return { status: 'error', error: '"path" must be a non-empty string.' };
    }

    try {
      const content = await readFile(path, 'utf-8');
      return { status: 'success', result: { content, path } };
    } catch (err) {
      return {
        status: 'error',
        error: `Failed to read file at "${path}": ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Leaf Tool: http-call
  // ---------------------------------------------------------------------------

  private async executeHttpCall(
    input: Record<string, unknown>,
  ): Promise<ToolResult> {
    const method = (input['method'] as string | undefined)?.toUpperCase() ?? 'GET';
    const url = input['url'];
    if (typeof url !== 'string' || url.trim() === '') {
      return { status: 'error', error: '"url" must be a non-empty string.' };
    }

    const headers = (input['headers'] as Record<string, string> | undefined) ?? {};
    const body = input['body'];

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (err) {
      return {
        status: 'error',
        error: `Network error calling ${method} ${url}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const responseText = await response.text();
    let responseBody: unknown = responseText;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      // Leave as plain text if not JSON
    }

    if (!response.ok) {
      return {
        status: 'error',
        error: `HTTP ${response.status} ${response.statusText} from ${url}: ${responseText.slice(0, 300)}`,
      };
    }

    return {
      status: 'success',
      result: {
        statusCode: response.status,
        body: responseBody,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Leaf Tool: bash-exec
  // ---------------------------------------------------------------------------

  private async executeBashExec(
    input: Record<string, unknown>,
  ): Promise<ToolResult> {
    const command = input['command'];
    if (typeof command !== 'string' || command.trim() === '') {
      return { status: 'error', error: '"command" must be a non-empty string.' };
    }

    const workingDir =
      typeof input['workingDir'] === 'string' ? input['workingDir'] : undefined;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout: 60_000,
      });
      return {
        status: 'success',
        result: { exitCode: 0, stdout, stderr },
      };
    } catch (err: unknown) {
      const execErr = err as { code?: number; stdout?: string; stderr?: string; message?: string };
      return {
        status: 'error',
        error:
          `Command exited with code ${execErr.code ?? 'unknown'}. ` +
          `stderr: ${execErr.stderr ?? execErr.message ?? 'unknown error'}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Plugin Skill: Progressive Disclosure
  // ---------------------------------------------------------------------------

  /**
   * Loads the full SKILL.md body for the named plugin skill and returns it as context.
   * The LLM receives this context and then calls leaf tools to perform the actual work.
   */
  private async executePluginSkill(skillName: string): Promise<ToolResult> {
    const summary = this.skillRoster.find((s) => s.name === skillName);
    if (!summary) {
      return {
        status: 'error',
        error:
          `Skill "${skillName}" not found in the current skill roster. ` +
          `Available skills: ${this.skillRoster.map((s) => s.name).join(', ')}`,
      };
    }

    try {
      const fullSkill = await loadSkillFull(summary);
      return {
        status: 'success',
        result: {
          skillName: fullSkill.name,
          description: fullSkill.frontmatter.description,
          allowedTools: fullSkill.frontmatter['allowed-tools'],
          instructions: fullSkill.body,
        },
      };
    } catch (err) {
      return {
        status: 'error',
        error: `Failed to load skill "${skillName}": ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
