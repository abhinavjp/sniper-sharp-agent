/**
 * skill-loader.ts
 *
 * Parses SKILL.md files (YAML frontmatter + markdown body) and resolves
 * the full skill schema on demand. During boot, only skill names and
 * descriptions are loaded (progressive disclosure). This module handles
 * both phases.
 *
 * Conventions: docs/CONVENTIONS.md §4.2, §7
 * Types: src/types/plugin.ts
 */

import { readFile } from 'node:fs/promises';
import type { ResolvedSkill, SkillFrontmatter, SkillSummary } from '../types/plugin.js';

// ---------------------------------------------------------------------------
// YAML Frontmatter Parser
// ---------------------------------------------------------------------------

/**
 * Parses the YAML frontmatter block from a SKILL.md file.
 *
 * Frontmatter must be the first thing in the file, delimited by `---` lines:
 *
 * ```
 * ---
 * name: classify-email
 * description: "Use this skill to classify an incoming email..."
 * allowed-tools:
 *   - read_file
 * ---
 *
 * (markdown body follows)
 * ```
 *
 * We parse frontmatter manually to avoid pulling in a heavy YAML dependency
 * at this layer. Only the fields declared in SkillFrontmatter are extracted.
 *
 * @param content  Raw file content of a SKILL.md
 * @param sourcePath  Used in error messages only
 */
export function parseSkillFrontmatter(content: string, sourcePath: string): SkillFrontmatter {
  const fencePattern = /^---\r?\n([\s\S]*?)\r?\n---/;
  const match = fencePattern.exec(content);

  if (!match || !match[1]) {
    throw new Error(
      `[skill-loader] No YAML frontmatter block found in "${sourcePath}". ` +
      `File must start with a --- delimited block.`,
    );
  }

  const raw = match[1];
  const lines = raw.split(/\r?\n/);

  // Simple key-value and list parser — handles the subset of YAML used in SKILL.md
  const result: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  for (const line of lines) {
    // List item
    if (line.match(/^\s+-\s+(.+)$/)) {
      const value = line.replace(/^\s+-\s+/, '').trim();
      if (currentList !== null) {
        currentList.push(value);
      }
      continue;
    }

    // Key: value pair
    const kvMatch = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kvMatch) {
      // Flush any pending list
      if (currentKey !== null && currentList !== null) {
        result[currentKey] = currentList;
        currentList = null;
      }

      const key = kvMatch[1] as string;
      const value = kvMatch[2]?.trim() ?? '';

      if (value === '' || value === '[]') {
        // Start of a list block or empty value
        currentKey = key;
        currentList = [];
        if (value !== '') result[key] = value;
      } else {
        currentKey = key;
        currentList = null;
        // Strip optional surrounding quotes
        result[key] = value.replace(/^['"]|['"]$/g, '');
      }
    }
  }

  // Flush trailing list
  if (currentKey !== null && currentList !== null) {
    result[currentKey] = currentList;
  }

  // Validate required fields
  const required: Array<keyof SkillFrontmatter> = ['name', 'description', 'allowed-tools'];
  for (const field of required) {
    if (!result[field]) {
      throw new Error(
        `[skill-loader] SKILL.md at "${sourcePath}" is missing required frontmatter field: "${field}".`,
      );
    }
  }

  if (!Array.isArray(result['allowed-tools'])) {
    throw new Error(
      `[skill-loader] SKILL.md at "${sourcePath}": "allowed-tools" must be a YAML list.`,
    );
  }

  return result as unknown as SkillFrontmatter;
}

// ---------------------------------------------------------------------------
// Frontmatter Body Extractor
// ---------------------------------------------------------------------------

/**
 * Returns the markdown body of a SKILL.md — everything after the closing `---`.
 */
function extractBody(content: string): string {
  const parts = content.split(/^---\r?\n/m);
  // parts[0] = '' (before first ---), parts[1] = frontmatter, parts[2]+ = body
  return parts.slice(2).join('---\n').trim();
}

// ---------------------------------------------------------------------------
// On-Demand Full Skill Load
// ---------------------------------------------------------------------------

/**
 * Fully loads a skill from its SKILL.md file — called on demand when the
 * orchestrator decides it needs the full skill schema, not just the summary.
 *
 * @param summary  The SkillSummary produced at boot (contains skillPath)
 */
export async function loadSkillFull(summary: SkillSummary): Promise<ResolvedSkill> {
  let content: string;
  try {
    content = await readFile(summary.skillPath, 'utf-8');
  } catch {
    throw new Error(
      `[skill-loader] Failed to read SKILL.md at "${summary.skillPath}".`,
    );
  }

  const frontmatter = parseSkillFrontmatter(content, summary.skillPath);
  const body = extractBody(content);

  return {
    ...summary,
    frontmatter,
    body,
  };
}

// ---------------------------------------------------------------------------
// Skill Roster Merger (scope precedence: User > Plugin > Core)
// ---------------------------------------------------------------------------

/**
 * Merges multiple skill rosters into a single de-duplicated roster,
 * applying scope precedence rules: User > Plugin > Core.
 *
 * If two skills share the same `name`, the higher-precedence scope wins.
 *
 * @param rosters  Array of [scope, skills] tuples, ordered lowest-to-highest precedence
 */
export function mergeSkillRosters(
  ...rosters: Array<{ scope: 'core' | 'plugin' | 'user'; skills: SkillSummary[] }>
): SkillSummary[] {
  const precedence: Record<'core' | 'plugin' | 'user', number> = {
    core: 0,
    plugin: 1,
    user: 2,
  };

  const merged = new Map<string, SkillSummary>();

  for (const { skills } of rosters) {
    for (const skill of skills) {
      const existing = merged.get(skill.name);
      if (!existing || precedence[skill.scope] > precedence[existing.scope]) {
        merged.set(skill.name, skill);
      }
    }
  }

  return Array.from(merged.values());
}
