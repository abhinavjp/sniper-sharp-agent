/**
 * orchestrator.ts
 *
 * Spawns and manages worker sub-agents. A worker is always a fresh base agent
 * with a designated plugin attached — it receives a structured JSON task, executes
 * using its plugin's skills, and returns strict JSON matching the output_contract.
 *
 * Worker definitions live in .agents/subagents/{name}.yaml
 *
 * Design reference:
 *   docs/PROPOSED_ARCHITECTURE.md §4
 *   docs/CONVENTIONS.md §4.3, §5
 *   AGENTS.md §3
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';
import type { AIProvider } from '../types/ai-provider.js';
import type { SubAgentDefinition } from '../types/plugin.js';
import { loadPlugin } from './plugin-loader.js';
import { AgentLoop } from './agent-loop.js';

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class Orchestrator {
  private readonly provider: AIProvider;
  private readonly projectRoot: string;

  constructor(options: { provider: AIProvider; projectRoot: string }) {
    this.provider = options.provider;
    this.projectRoot = options.projectRoot;
  }

  /**
   * Spawns a worker sub-agent by name, injects the task as JSON, and returns
   * the parsed JSON result from the worker.
   *
   * Steps:
   *   1. Load .agents/subagents/{workerName}.yaml
   *   2. Load the plugin specified in the definition
   *   3. Create a fresh AgentLoop with the worker's plugin
   *   4. Inject task as structured JSON in the user turn
   *   5. Run the loop — worker must return JSON only
   *   6. Parse and return JSON result
   *
   * @param workerName  kebab-case name matching the YAML definition file
   * @param task        structured task payload — injected as JSON to the worker
   * @param userId      bound user identifier — passed through to the worker context
   */
  async spawnWorker(
    workerName: string,
    task: unknown,
    userId: string,
  ): Promise<unknown> {
    // 1. Load sub-agent definition
    const definition = await this.loadSubAgentDefinition(workerName);

    // 2. Load worker plugin
    const pluginDir = join(this.projectRoot, 'plugins', definition.plugin);
    let plugin;
    try {
      plugin = await loadPlugin(pluginDir);
    } catch (err) {
      throw new Error(
        `[orchestrator] Failed to load plugin "${definition.plugin}" for worker "${workerName}": ` +
        String(err),
      );
    }

    // 3. Create isolated agent loop with worker's plugin
    const workerLoop = new AgentLoop({
      provider: this.provider,
      plugin,
      projectRoot: this.projectRoot,
    });

    // 4. Inject task as structured JSON
    const taskPayload = JSON.stringify({ userId, task }, null, 2);

    // 5. Run loop — worker MUST return JSON only (enforced by SOUL.md + AGENTS.md)
    let rawResult: string;
    try {
      rawResult = await workerLoop.run({ userId, input: taskPayload });
    } catch (err) {
      throw new Error(
        `[orchestrator] Worker "${workerName}" failed during execution: ${String(err)}`,
      );
    }

    // 6. Parse JSON result (worker output contract: { status, result } | { status, error })
    return this.parseWorkerResult(workerName, rawResult);
  }

  /**
   * Spawns multiple workers in parallel (for tasks with no shared state).
   * Returns results in the same order as the tasks array.
   */
  async spawnParallel(
    workers: Array<{ name: string; task: unknown }>,
    userId: string,
  ): Promise<unknown[]> {
    return Promise.all(
      workers.map(({ name, task }) => this.spawnWorker(name, task, userId)),
    );
  }

  /**
   * Spawns workers sequentially, threading each result into the next task.
   * task[1] receives { previousResult: result[0], ...task[1] }
   */
  async spawnSequential(
    workers: Array<{ name: string; task: unknown }>,
    userId: string,
  ): Promise<unknown[]> {
    const results: unknown[] = [];
    let previousResult: unknown = null;

    for (const { name, task } of workers) {
      const chainedTask =
        previousResult !== null
          ? { ...(task as object), previousResult }
          : task;

      const result = await this.spawnWorker(name, chainedTask, userId);
      results.push(result);
      previousResult = result;
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Sub-Agent Definition Loader
  // ---------------------------------------------------------------------------

  private async loadSubAgentDefinition(workerName: string): Promise<SubAgentDefinition> {
    const defPath = join(
      this.projectRoot,
      '.agents',
      'subagents',
      `${workerName}.yaml`,
    );

    let raw: string;
    try {
      raw = await readFile(defPath, 'utf-8');
    } catch {
      throw new Error(
        `[orchestrator] Sub-agent definition not found: "${defPath}". ` +
        `Create a YAML file at .agents/subagents/${workerName}.yaml`,
      );
    }

    const parsed = yaml.load(raw) as Record<string, unknown>;

    // Validate required fields (docs/CONVENTIONS.md §4.3)
    const required: Array<keyof SubAgentDefinition> = [
      'name', 'description', 'plugin', 'system_prompt', 'allowed_tools', 'output_contract',
    ];
    for (const field of required) {
      if (parsed[field] === undefined || parsed[field] === null) {
        throw new Error(
          `[orchestrator] Sub-agent definition "${workerName}.yaml" is missing required field: "${field}"`,
        );
      }
    }

    if (!parsed['plugin']) {
      throw new Error(
        `[orchestrator] Worker "${workerName}" has no "plugin" field. ` +
        `Workers MUST have a plugin — a worker without a plugin has no identity.`,
      );
    }

    return parsed as unknown as SubAgentDefinition;
  }

  // ---------------------------------------------------------------------------
  // Result Parser
  // ---------------------------------------------------------------------------

  private parseWorkerResult(workerName: string, raw: string): unknown {
    const trimmed = raw.trim();

    // Strip markdown code fences if present (defensive — workers shouldn't emit these)
    const stripped = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      return JSON.parse(stripped);
    } catch {
      // Worker returned non-JSON — wrap in error envelope
      console.error(
        `[orchestrator] Worker "${workerName}" returned non-JSON output (first 200 chars): ` +
        stripped.slice(0, 200),
      );
      return {
        status: 'error',
        error: `Worker "${workerName}" violated the output contract — returned prose instead of JSON.`,
      };
    }
  }
}
