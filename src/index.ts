/**
 * index.ts — Framework Entry Point / Demo
 *
 * Demonstrates the full plugin-attach → agent-run cycle using:
 *   - Provider: anthropic-setup-auth (Claude CLI OAuth token)
 *   - Plugin:   email-classifier (or any plugin passed via --plugin flag)
 *   - Model:    claude-opus-4-6 (default)
 *
 * Usage:
 *   npm run dev                                  # Interactive prompt
 *   npm run dev "classify this email..."         # Single message
 *   npm run dev --plugin sniper-sharp-agent "…"  # Different plugin
 *
 * The agent loop handles multi-turn tool use automatically.
 * Sub-agents can be spawned via the Orchestrator (see src/core/orchestrator.ts).
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { loadPlugin } from './core/plugin-loader.js';
import { AgentLoop } from './core/agent-loop.js';
import { createProvider } from './providers/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Argument Parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { pluginId: string; message: string | null } {
  const args = argv.slice(2);
  let pluginId = 'email-classifier';
  let message: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--plugin' || args[i] === '-p') && args[i + 1]) {
      pluginId = args[i + 1] as string;
      i++;
    } else if (args[i] && !args[i]!.startsWith('-')) {
      message = args[i] as string;
    }
  }

  return { pluginId, message };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { pluginId, message } = parseArgs(process.argv);

  // Load plugin
  const pluginDir = join(PROJECT_ROOT, 'plugins', pluginId);
  let plugin;
  try {
    plugin = await loadPlugin(pluginDir);
    console.log(`[framework] Plugin loaded: ${plugin.manifest.name} v${plugin.manifest.version}`);
    console.log(`[framework] Role: ${plugin.manifest.role}`);
    console.log(`[framework] Skills: ${plugin.skills.map((s) => s.name).join(', ')}`);
    console.log('');
  } catch (err) {
    console.error(`[framework] Failed to load plugin "${pluginId}": ${String(err)}`);
    console.error(`[framework] Available plugins: email-classifier, uk-payroll-processor, uk-payroll-app-agent, sniper-sharp-agent`);
    process.exit(1);
  }

  // Create provider (Anthropic setup-auth — reads from Claude CLI credentials or env)
  const provider = createProvider({
    type: 'anthropic-setup-auth',
    model: 'claude-opus-4-6',
  });

  console.log(`[framework] Provider: ${provider.type} / ${provider.model}`);
  console.log(`[framework] User ID: user-demo`);
  console.log('─'.repeat(60));
  console.log('');

  // Create agent loop
  const agentLoop = new AgentLoop({
    provider,
    plugin,
    projectRoot: PROJECT_ROOT,
  });

  // Single message mode
  if (message) {
    const result = await agentLoop.run({ userId: 'user-demo', input: message });
    console.log(result);
    return;
  }

  // Interactive REPL mode
  console.log(`Talking to ${plugin.manifest.name}. Type "exit" to quit.\n`);
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  rl.prompt();
  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      process.exit(0);
    }

    try {
      const result = await agentLoop.run({ userId: 'user-demo', input });
      console.log('\n' + result + '\n');
    } catch (err) {
      console.error('[error]', String(err), '\n');
    }

    rl.prompt();
  });

  rl.on('close', () => process.exit(0));
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
