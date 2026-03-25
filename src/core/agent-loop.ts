/**
 * agent-loop.ts
 *
 * The core agent execution loop. Takes a request, builds a system prompt from
 * AGENTS.md + plugin SOUL.md, converts the skill roster to LLM tool definitions,
 * and runs a multi-turn Messages API loop until the LLM returns end_turn.
 *
 * Flow:
 *   1. Build system prompt  (AGENTS.md + plugin SOUL.md)
 *   2. Build tool roster    (core skills + plugin skills, merged with precedence)
 *   3. Enter LLM loop:
 *      a. Call provider.complete()
 *      b. stop_reason=end_turn  → return final text
 *      c. stop_reason=tool_use  → execute tools, append results, repeat
 *      d. Other stop reason     → return whatever text is present
 *
 * Design reference: docs/PROPOSED_ARCHITECTURE.md §4, AGENTS.md §3
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AIProvider, ContentBlock, ProviderMessage, ProviderTool } from '../types/ai-provider.js';
import type { AgentRequestContext, ResolvedPlugin, SkillSummary } from '../types/plugin.js';
import { loadCoreSkills } from './plugin-loader.js';
import { mergeSkillRosters } from './skill-loader.js';
import { ToolExecutor } from './tool-executor.js';

const MAX_ITERATIONS = 30;

// ---------------------------------------------------------------------------
// AgentLoop Options
// ---------------------------------------------------------------------------

export interface AgentLoopOptions {
  /** AI provider to use for all completions. */
  provider: AIProvider;

  /** Resolved plugin (optional — uses generalist soul if omitted). */
  plugin?: ResolvedPlugin | null;

  /**
   * Absolute path to the project root.
   * Used to locate AGENTS.md and .agents/skills/.
   */
  projectRoot: string;
}

// ---------------------------------------------------------------------------
// AgentLoop
// ---------------------------------------------------------------------------

export class AgentLoop {
  private readonly provider: AIProvider;
  private readonly plugin: ResolvedPlugin | null;
  private readonly projectRoot: string;

  constructor(options: AgentLoopOptions) {
    this.provider = options.provider;
    this.plugin = options.plugin ?? null;
    this.projectRoot = options.projectRoot;
  }

  /**
   * Runs the agent loop for a single request context.
   * Returns the final plain-text response from the LLM.
   *
   * @throws if max iterations is exceeded without end_turn
   */
  async run(context: AgentRequestContext): Promise<string> {
    const systemPrompt = await this.buildSystemPrompt();
    const skillRoster = await this.buildSkillRoster();
    const tools = this.buildToolDefinitions(skillRoster);
    const toolExecutor = new ToolExecutor(skillRoster);

    const historyMessages: ProviderMessage[] = (context.history ?? []).map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));

    const messages: ProviderMessage[] = [
      ...historyMessages,
      {
        role: 'user',
        content: typeof context.input === 'string'
          ? context.input
          : JSON.stringify(context.input, null, 2),
      },
    ];

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const response = await this.provider.complete({
        system: systemPrompt,
        messages,
        maxTokens: 16000,
        ...(tools.length > 0 ? { tools } : {}),
      });

      if (response.stopReason === 'end_turn') {
        return this.extractText(response.content);
      }

      if (response.stopReason === 'tool_use') {
        // Append assistant turn (includes tool_use blocks)
        messages.push({ role: 'assistant', content: response.content });

        // Execute all tool calls and build tool result blocks
        const toolResults: ContentBlock[] = [];
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const result = await toolExecutor.execute(block.name, block.input);
            toolResults.push({
              type: 'tool_result',
              toolUseId: block.id,
              content: JSON.stringify(result),
              isError: result.status === 'error',
            });
          }
        }

        // Append tool results as the next user turn
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // max_tokens, stop_sequence, or unknown — return whatever text is present
      return this.extractText(response.content);
    }

    throw new Error(
      `[agent-loop] Reached maximum iterations (${MAX_ITERATIONS}) without end_turn. ` +
      `Last message count: ${messages.length}`,
    );
  }

  // ---------------------------------------------------------------------------
  // System Prompt Assembly
  // ---------------------------------------------------------------------------

  /**
   * Combines the base framework rules (AGENTS.md) with the plugin's SOUL.md.
   * If no plugin is attached, the base SOUL.md (generalist) is used instead.
   */
  private async buildSystemPrompt(): Promise<string> {
    const agentsMd = await this.readFile(join(this.projectRoot, 'AGENTS.md'));

    let soulMd: string;
    if (this.plugin) {
      soulMd = this.plugin.soul;
    } else {
      soulMd = await this.readFile(join(this.projectRoot, 'SOUL.md'));
    }

    return [
      '# Framework Operating Rules',
      agentsMd,
      '',
      '# Agent Identity and Role',
      soulMd,
    ].join('\n');
  }

  // ---------------------------------------------------------------------------
  // Skill Roster Assembly
  // ---------------------------------------------------------------------------

  private async buildSkillRoster(): Promise<SkillSummary[]> {
    const coreSkillsDir = join(this.projectRoot, '.agents', 'skills');
    const coreSkills = await loadCoreSkills(coreSkillsDir);
    const pluginSkills = this.plugin?.skills ?? [];

    // User-level skills would come from memory/users/{userId}/preferences/skills/
    // — loaded in Phase 5 when memory routing is implemented
    const userSkills: SkillSummary[] = [];

    return mergeSkillRosters(
      { scope: 'core', skills: coreSkills },
      { scope: 'plugin', skills: pluginSkills },
      { scope: 'user', skills: userSkills },
    );
  }

  // ---------------------------------------------------------------------------
  // Tool Definitions (progressive disclosure — names + descriptions only)
  // ---------------------------------------------------------------------------

  private buildToolDefinitions(roster: SkillSummary[]): ProviderTool[] {
    return roster.map((skill) => ({
      name: skill.name,
      description: skill.description,
      inputSchema: {
        type: 'object' as const,
        // Generic schema — full input schema is in the SKILL.md body
        // (loaded on demand when the skill is invoked)
        properties: {
          input: {
            type: 'object',
            description: 'Tool-specific input payload. See skill instructions for exact shape.',
          },
        },
      },
    }));
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private extractText(content: ContentBlock[]): string {
    return content
      .filter((b): b is import('../types/ai-provider.js').TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  }

  private async readFile(path: string): Promise<string> {
    try {
      return await readFile(path, 'utf-8');
    } catch {
      return `[${path} not found]`;
    }
  }
}
