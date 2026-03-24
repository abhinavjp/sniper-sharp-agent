/**
 * TypeScript type definitions for the plugin and skill system.
 *
 * Schema source of truth: docs/CONVENTIONS.md §4
 * These interfaces mirror the documented schemas exactly — do not diverge.
 */

// ---------------------------------------------------------------------------
// Plugin Manifest  (plugins/{id}/manifest.json)
// ---------------------------------------------------------------------------

export interface PluginManifest {
  /** Unique plugin identifier. Convention: kebab-case. */
  id: string;

  /** Display name. Convention: PascalCase. */
  name: string;

  /** SemVer string (e.g. "1.0.0"). */
  version: string;

  /** One-sentence description of the specialist's purpose. */
  role: string;

  /** Path to the soul file, relative to the plugin directory. Always "SOUL.md". */
  entrypoint: string;

  /** Path to the skills directory, relative to the plugin directory. Always "skills/". */
  skillsDir: string;

  /** Optional heartbeat configuration for scheduled background tasks. */
  heartbeat?: HeartbeatConfig;
}

export interface HeartbeatConfig {
  enabled: boolean;

  /** Cron expression (UTC). e.g. "*/5 * * * *" */
  interval: string;

  tasks: HeartbeatTask[];
}

export interface HeartbeatTask {
  name: string;

  /** Must reference a skill that exists in the plugin's skillsDir. */
  skill: string;

  trigger: 'cron' | 'event';
}

// ---------------------------------------------------------------------------
// Skill Definition  (YAML frontmatter of SKILL.md files)
// ---------------------------------------------------------------------------

export interface SkillFrontmatter {
  /** Unique skill identifier within the resolved session roster. Convention: kebab-case. */
  name: string;

  /**
   * Precise description of WHEN and WHY to use this skill.
   * This is the LLM's only signal during progressive disclosure — make it exact.
   */
  description: string;

  /** Tools this skill is permitted to invoke. Follows least-privilege. */
  'allowed-tools': string[];

  /** If true, exposes this skill as a /slash-command to the human user. */
  'user-invocable'?: boolean;

  /** If true, skill can only be triggered by hooks/cron — not by the LLM reasoning loop. */
  'disable-model-invocation'?: boolean;

  /** Informational. Resolved from directory position at load time. */
  scope?: 'core' | 'plugin' | 'user';
}

// ---------------------------------------------------------------------------
// Resolved Skill  (after full load — name + description only at boot; rest on demand)
// ---------------------------------------------------------------------------

/** What is available to the LLM during progressive disclosure (boot time). */
export interface SkillSummary {
  name: string;
  description: string;
  scope: 'core' | 'plugin' | 'user';
  /** Absolute path to the SKILL.md file, for on-demand full load. */
  skillPath: string;
}

/** Full skill after on-demand loading. */
export interface ResolvedSkill extends SkillSummary {
  frontmatter: SkillFrontmatter;
  /** Raw markdown body of the SKILL.md (below the frontmatter). */
  body: string;
}

// ---------------------------------------------------------------------------
// Resolved Plugin  (after full plugin load and identity transformation)
// ---------------------------------------------------------------------------

export interface ResolvedPlugin {
  manifest: PluginManifest;

  /** Full content of the plugin's SOUL.md — injected as the system prompt persona. */
  soul: string;

  /** Skill summaries (names + descriptions only). Full load is on-demand. */
  skills: SkillSummary[];

  /** Absolute path to the plugin directory. */
  pluginPath: string;
}

// ---------------------------------------------------------------------------
// Sub-Agent Definition  (.agents/subagents/{name}.yaml)
// ---------------------------------------------------------------------------

export interface SubAgentDefinition {
  /** Convention: kebab-case. */
  name: string;

  /** One sentence: when the orchestrator should dispatch this worker. */
  description: string;

  /** Plugin to attach when spawning this worker. Must be a valid plugin id. */
  plugin: string;

  /** Full system prompt injected into the worker's isolated context. Must end with JSON-only directive. */
  system_prompt: string;

  /** Tools available to this worker. Must be a subset of the parent orchestrator's permissions. */
  allowed_tools: string[];

  /** Strict JSON schema the worker's response must conform to. */
  output_contract: OutputContract;
}

export interface OutputContract {
  type: 'object';
  required: string[];
  properties: Record<string, OutputContractProperty>;
}

export interface OutputContractProperty {
  type: string;
  enum?: string[];
  description?: string;
}

// ---------------------------------------------------------------------------
// Agent Request Context  (passed to every agent on each request)
// ---------------------------------------------------------------------------

export interface AgentRequestContext {
  /** Bound user identifier. Required. Never constructed by agent reasoning. */
  userId: string;

  /** Incoming message or structured task payload. */
  input: string | Record<string, unknown>;

  /** If this agent is a worker, the task type (matches skill name convention). */
  taskType?: string;
}
