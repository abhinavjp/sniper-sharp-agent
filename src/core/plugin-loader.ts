/**
 * plugin-loader.ts
 *
 * Scans the plugins/ directory, validates manifest.json against the PluginManifest schema,
 * reads the plugin's SOUL.md, and compiles a progressive-disclosure skill roster
 * (names + descriptions only at boot — full schema loaded on demand by skill-loader.ts).
 *
 * Conventions: docs/CONVENTIONS.md §4.1, §7
 * Types: src/types/plugin.ts
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type {
  PluginManifest,
  ResolvedPlugin,
  SkillSummary,
} from '../types/plugin.js';
import { parseSkillFrontmatter } from './skill-loader.js';

// ---------------------------------------------------------------------------
// Manifest Validation
// ---------------------------------------------------------------------------

/**
 * Validates a raw JSON object against the PluginManifest schema.
 * Throws a descriptive error if any required field is missing or malformed.
 *
 * Schema source of truth: docs/CONVENTIONS.md §4.1
 */
export function validateManifest(data: unknown, sourcePath: string): PluginManifest {
  if (typeof data !== 'object' || data === null) {
    throw new Error(`[plugin-loader] manifest.json at "${sourcePath}" is not a JSON object.`);
  }

  const obj = data as Record<string, unknown>;

  const requiredStrings: Array<keyof PluginManifest> = [
    'id', 'name', 'version', 'role', 'entrypoint', 'skillsDir',
  ];

  for (const field of requiredStrings) {
    if (typeof obj[field] !== 'string' || (obj[field] as string).trim() === '') {
      throw new Error(
        `[plugin-loader] manifest.json at "${sourcePath}" is missing or has an empty required field: "${field}".`,
      );
    }
  }

  // id must be kebab-case
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(obj['id'] as string)) {
    throw new Error(
      `[plugin-loader] manifest.json field "id" must be kebab-case. Got: "${obj['id']}"`,
    );
  }

  // version must be semver-like (major.minor.patch)
  if (!/^\d+\.\d+\.\d+/.test(obj['version'] as string)) {
    throw new Error(
      `[plugin-loader] manifest.json field "version" must be a valid semver string. Got: "${obj['version']}"`,
    );
  }

  return obj as unknown as PluginManifest;
}

// ---------------------------------------------------------------------------
// Skill Roster Assembly (progressive disclosure — names + descriptions only)
// ---------------------------------------------------------------------------

/**
 * Scans a plugin's skills/ directory and returns a summary roster for progressive disclosure.
 * Each skill directory must contain a SKILL.md with valid YAML frontmatter.
 */
async function buildSkillRoster(
  skillsDir: string,
  scope: 'core' | 'plugin',
): Promise<SkillSummary[]> {
  const summaries: SkillSummary[] = [];

  let entries: string[];
  try {
    entries = await readdir(skillsDir);
  } catch {
    // Skills directory may not exist yet during scaffolding — return empty roster.
    return summaries;
  }

  for (const entry of entries) {
    const skillPath = join(skillsDir, entry, 'SKILL.md');
    try {
      const content = await readFile(skillPath, 'utf-8');
      const frontmatter = parseSkillFrontmatter(content, skillPath);
      summaries.push({
        name: frontmatter.name,
        description: frontmatter.description,
        scope,
        skillPath: resolve(skillPath),
      });
    } catch {
      // Skip malformed or missing SKILL.md files with a warning.
      console.warn(`[plugin-loader] Skipping skill at "${skillPath}" — could not parse SKILL.md.`);
    }
  }

  return summaries;
}

// ---------------------------------------------------------------------------
// Plugin Loader — Primary Entry Point
// ---------------------------------------------------------------------------

/**
 * Loads and resolves a single plugin by its directory path.
 *
 * Steps:
 * 1. Read and validate manifest.json
 * 2. Read SOUL.md (the plugin's persona — injected as system prompt)
 * 3. Build progressive-disclosure skill roster from skills/
 *
 * @param pluginDir Absolute path to the plugin directory (e.g. /project/plugins/email-classifier)
 */
export async function loadPlugin(pluginDir: string): Promise<ResolvedPlugin> {
  const manifestPath = join(pluginDir, 'manifest.json');

  // 1. Load and validate manifest
  let rawManifest: unknown;
  try {
    const manifestText = await readFile(manifestPath, 'utf-8');
    rawManifest = JSON.parse(manifestText);
  } catch (err) {
    throw new Error(
      `[plugin-loader] Failed to read or parse manifest.json at "${manifestPath}": ${String(err)}`,
    );
  }

  const manifest = validateManifest(rawManifest, manifestPath);

  // 2. Load SOUL.md
  const soulPath = join(pluginDir, manifest.entrypoint);
  let soul: string;
  try {
    soul = await readFile(soulPath, 'utf-8');
  } catch {
    throw new Error(
      `[plugin-loader] Failed to read SOUL.md at "${soulPath}". ` +
      `Ensure "entrypoint" in manifest.json points to an existing file.`,
    );
  }

  // 3. Build skill roster
  const skillsDir = join(pluginDir, manifest.skillsDir);
  const skills = await buildSkillRoster(skillsDir, 'plugin');

  return {
    manifest,
    soul,
    skills,
    pluginPath: resolve(pluginDir),
  };
}

/**
 * Scans the plugins/ root directory and returns all valid resolved plugins.
 * Invalid plugin directories (missing manifest, bad schema) are skipped with a warning.
 *
 * @param pluginsRoot Absolute path to the plugins/ directory
 */
export async function loadAllPlugins(pluginsRoot: string): Promise<ResolvedPlugin[]> {
  const plugins: ResolvedPlugin[] = [];

  let entries: string[];
  try {
    entries = await readdir(pluginsRoot);
  } catch {
    throw new Error(`[plugin-loader] plugins/ directory not found at "${pluginsRoot}".`);
  }

  for (const entry of entries) {
    const pluginDir = join(pluginsRoot, entry);
    const dirStat = await stat(pluginDir).catch(() => null);
    if (!dirStat?.isDirectory()) continue;

    try {
      const plugin = await loadPlugin(pluginDir);
      plugins.push(plugin);
    } catch (err) {
      console.warn(`[plugin-loader] Skipping plugin directory "${entry}": ${String(err)}`);
    }
  }

  return plugins;
}

/**
 * Loads the core skill roster from .agents/skills/ at the framework level.
 * These are always available to every agent regardless of which plugin is attached.
 *
 * @param agentsSkillsDir Absolute path to .agents/skills/
 */
export async function loadCoreSkills(agentsSkillsDir: string): Promise<SkillSummary[]> {
  return buildSkillRoster(agentsSkillsDir, 'core');
}
