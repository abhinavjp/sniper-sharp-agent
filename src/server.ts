/**
 * server.ts — Web UI API Server
 *
 * Exposes the agent framework over HTTP so the browser UI can:
 *   - List all loaded plugins and their skills
 *   - Chat with any plugin across a persistent session
 *   - Inspect core skills and sub-agent definitions
 *
 * Sessions maintain conversation history server-side so the browser
 * gets proper multi-turn context on every request.
 *
 * Usage:
 *   npm run server            # Starts on http://localhost:3333
 *   PORT=8080 npm run server  # Custom port
 */

import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAllPlugins, loadCoreSkills } from './core/plugin-loader.js';
import { AgentLoop } from './core/agent-loop.js';
import { createProvider } from './providers/index.js';
import type { ResolvedPlugin, SkillSummary, ConversationTurn } from './types/plugin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PORT = parseInt(process.env['PORT'] ?? '3333', 10);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface Session {
  pluginId: string;
  userId: string;
  history: ConversationTurn[];
  createdAt: number;
}

const sessions = new Map<string, Session>();
let cachedPlugins: ResolvedPlugin[] = [];
let cachedCoreSkills: SkillSummary[] = [];

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function bootstrap(): Promise<void> {
  const pluginsRoot = join(PROJECT_ROOT, 'plugins');
  const coreSkillsDir = join(PROJECT_ROOT, '.agents', 'skills');

  [cachedPlugins, cachedCoreSkills] = await Promise.all([
    loadAllPlugins(pluginsRoot),
    loadCoreSkills(coreSkillsDir),
  ]);

  console.log(`[server] Loaded ${cachedPlugins.length} plugin(s): ${cachedPlugins.map((p) => p.manifest.id).join(', ')}`);
  console.log(`[server] Loaded ${cachedCoreSkills.length} core skill(s)`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function json(res: import('node:http').ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
}

function parseBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

async function serveFile(
  res: import('node:http').ServerResponse,
  filePath: string,
  contentType: string,
): Promise<void> {
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

// ---------------------------------------------------------------------------
// Request Router
// ---------------------------------------------------------------------------

async function handle(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
): Promise<void> {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  // CORS pre-flight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // ------- Static UI -------------------------------------------------------
  if (method === 'GET' && (path === '/' || path === '/index.html')) {
    return serveFile(res, join(PROJECT_ROOT, 'ui', 'index.html'), 'text/html; charset=utf-8');
  }

  // ------- API: List plugins -----------------------------------------------
  if (method === 'GET' && path === '/api/plugins') {
    json(res, 200, {
      plugins: cachedPlugins.map((p) => ({
        id: p.manifest.id,
        name: p.manifest.name,
        version: p.manifest.version,
        role: p.manifest.role,
        skills: p.skills,
      })),
    });
    return;
  }

  // ------- API: Core skills ------------------------------------------------
  if (method === 'GET' && path === '/api/core-skills') {
    json(res, 200, { skills: cachedCoreSkills });
    return;
  }

  // ------- API: Sub-agent definitions --------------------------------------
  if (method === 'GET' && path === '/api/subagents') {
    try {
      const subagentsDir = join(PROJECT_ROOT, '.agents', 'subagents');
      const files = await readdir(subagentsDir).catch(() => [] as string[]);
      const subagents = await Promise.all(
        files
          .filter((f) => f.endsWith('.yaml'))
          .map(async (f) => {
            const content = await readFile(join(subagentsDir, f), 'utf-8');
            return { file: f, content };
          }),
      );
      json(res, 200, { subagents });
    } catch (err) {
      json(res, 500, { error: String(err) });
    }
    return;
  }

  // ------- API: Create session ---------------------------------------------
  if (method === 'POST' && path === '/api/sessions') {
    let body: unknown;
    try { body = await parseBody(req); } catch { json(res, 400, { error: 'Invalid JSON' }); return; }

    const { pluginId = 'email-classifier', userId = 'user-demo' } = body as Record<string, string>;
    const plugin = cachedPlugins.find((p) => p.manifest.id === pluginId);
    if (!plugin) {
      json(res, 400, { error: `Plugin "${pluginId}" not found. Available: ${cachedPlugins.map((p) => p.manifest.id).join(', ')}` });
      return;
    }

    const sessionId = generateId();
    sessions.set(sessionId, { pluginId, userId, history: [], createdAt: Date.now() });
    json(res, 201, { sessionId, pluginId, userId });
    return;
  }

  // ------- API: Delete session ---------------------------------------------
  if (method === 'DELETE' && path.startsWith('/api/sessions/')) {
    const sessionId = path.slice('/api/sessions/'.length);
    sessions.delete(sessionId);
    json(res, 200, { ok: true });
    return;
  }

  // ------- API: Chat -------------------------------------------------------
  if (method === 'POST' && path === '/api/chat') {
    let body: unknown;
    try { body = await parseBody(req); } catch { json(res, 400, { error: 'Invalid JSON' }); return; }

    const {
      sessionId,
      message,
      pluginId = 'email-classifier',
      userId = 'user-demo',
    } = body as Record<string, string>;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      json(res, 400, { error: '"message" is required and must be a non-empty string.' });
      return;
    }

    // Resolve or create session
    let session = sessionId ? sessions.get(sessionId) : undefined;
    const effectivePluginId = session?.pluginId ?? pluginId;
    const effectiveUserId = session?.userId ?? userId;

    const plugin = cachedPlugins.find((p) => p.manifest.id === effectivePluginId);
    if (!plugin) {
      json(res, 400, { error: `Plugin "${effectivePluginId}" not found.` });
      return;
    }

    // Create session if not provided
    if (!session) {
      const newId = generateId();
      session = { pluginId: effectivePluginId, userId: effectiveUserId, history: [], createdAt: Date.now() };
      sessions.set(newId, session);
    }

    const provider = createProvider({
      type: 'anthropic-setup-auth',
      model: 'claude-opus-4-6',
    });

    const agentLoop = new AgentLoop({ provider, plugin, projectRoot: PROJECT_ROOT });

    let response: string;
    try {
      response = await agentLoop.run({
        userId: effectiveUserId,
        input: message,
        history: session.history,
      });
    } catch (err) {
      json(res, 500, { error: `Agent loop failed: ${String(err)}` });
      return;
    }

    // Update session history
    session.history.push({ role: 'user', content: message });
    session.history.push({ role: 'assistant', content: response });

    json(res, 200, {
      response,
      pluginId: effectivePluginId,
      userId: effectiveUserId,
      turnCount: session.history.length / 2,
    });
    return;
  }

  // ------- 404 -------------------------------------------------------------
  json(res, 404, { error: `No route matched: ${method} ${path}` });
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await bootstrap();

  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error('[server] Unhandled error:', err);
      try {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      } catch { /* response already sent */ }
    });
  });

  server.listen(PORT, () => {
    console.log('');
    console.log('┌──────────────────────────────────────────┐');
    console.log(`│  Agent Framework UI                      │`);
    console.log(`│  http://localhost:${PORT}                  │`);
    console.log('└──────────────────────────────────────────┘');
    console.log('');
  });
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
