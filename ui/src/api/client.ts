// ─── Types ───────────────────────────────────────────────────────────────────

export type ProviderType =
  | 'anthropic-api-key'
  | 'anthropic-setup-auth'
  | 'openai-api-key'
  | 'openai-codex-oauth'
  | 'google-api-key'
  | 'custom-url';

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  model: string;
  credentials: Record<string, string>;
  created_at: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  implementation: string;
  input_schema: Record<string, unknown> | null;
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  persona: string;
  rules: string | null;
  provider_id: string;
  is_supervisor: boolean;
  memory_enabled: boolean;
  memory_types: string[];
  config_hook_url: string | null;
  config_hook_secret: string | null;
  created_at: string;
  skills: Skill[];
}

export interface RoutingRule {
  id: string;
  supervisor_id: string;
  intent_label: string;
  target_agent_id: string;
  priority: number;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  agent_id: string;
  history: Array<{ role: string; content: string }>;
  created_at: string;
}

export interface ChatResponse {
  response: string;
  session_id: string;
  intent: string | null;
  turn_count: number;
}

export interface HealthResponse {
  status: string;
  graph_compiled: boolean;
}

export interface GraphStatusResponse {
  agent_count: number;
  skill_count: number;
  routing_rule_count: number;
}

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  const data: unknown = await res.json();
  return data as T;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${detail}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  const data: unknown = await res.json();
  return data as T;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`);
  const data: unknown = await res.json();
  return data as T;
}

async function del(path: string): Promise<void> {
  const res = await fetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`);
}

// ─── API Surface ──────────────────────────────────────────────────────────────

export const api = {
  // System
  health: () => get<HealthResponse>('/api/health'),
  graphStatus: () => get<GraphStatusResponse>('/api/graph/status'),
  graphRebuild: () => post<void>('/api/graph/rebuild'),

  // Providers
  listProviders: () => get<Provider[]>('/api/providers'),
  createProvider: (body: {
    name: string;
    type: ProviderType;
    model: string;
    credentials: Record<string, string>;
  }) => post<Provider>('/api/providers', body),
  getProvider: (id: string) => get<Provider>(`/api/providers/${id}`),
  updateProvider: (
    id: string,
    body: Partial<{ name: string; type: ProviderType; model: string; credentials: Record<string, string> }>,
  ) => put<Provider>(`/api/providers/${id}`, body),
  deleteProvider: (id: string) => del(`/api/providers/${id}`),

  // Agents
  listAgents: () => get<Agent[]>('/api/agents'),
  createAgent: (body: {
    name: string;
    persona: string;
    provider_id: string;
    is_supervisor?: boolean;
    rules?: string;
    memory_enabled?: boolean;
    memory_types?: string[];
    config_hook_url?: string;
    config_hook_secret?: string;
  }) => post<Agent>('/api/agents', body),
  getAgent: (id: string) => get<Agent>(`/api/agents/${id}`),
  updateAgent: (
    id: string,
    body: Partial<{
      name: string;
      persona: string;
      provider_id: string;
      is_supervisor: boolean;
      rules: string;
      memory_enabled: boolean;
      memory_types: string[];
      config_hook_url: string;
      config_hook_secret: string;
    }>,
  ) => put<Agent>(`/api/agents/${id}`, body),
  deleteAgent: (id: string) => del(`/api/agents/${id}`),
  attachSkill: (agentId: string, skillId: string) =>
    post<void>(`/api/agents/${agentId}/skills/${skillId}`),
  detachSkill: (agentId: string, skillId: string) =>
    del(`/api/agents/${agentId}/skills/${skillId}`),

  // Skills
  listSkills: () => get<Skill[]>('/api/skills'),
  createSkill: (body: {
    name: string;
    description: string;
    implementation: string;
    input_schema?: Record<string, unknown>;
  }) => post<Skill>('/api/skills', body),
  getSkill: (id: string) => get<Skill>(`/api/skills/${id}`),
  updateSkill: (
    id: string,
    body: Partial<{
      name: string;
      description: string;
      implementation: string;
      input_schema: Record<string, unknown>;
    }>,
  ) => put<Skill>(`/api/skills/${id}`, body),
  deleteSkill: (id: string) => del(`/api/skills/${id}`),

  // Routing Rules
  listRoutingRules: () => get<RoutingRule[]>('/api/routing-rules'),
  createRoutingRule: (body: {
    supervisor_id: string;
    intent_label: string;
    target_agent_id: string;
    priority: number;
  }) => post<RoutingRule>('/api/routing-rules', body),
  updateRoutingRule: (
    id: string,
    body: Partial<{
      supervisor_id: string;
      intent_label: string;
      target_agent_id: string;
      priority: number;
    }>,
  ) => put<RoutingRule>(`/api/routing-rules/${id}`, body),
  deleteRoutingRule: (id: string) => del(`/api/routing-rules/${id}`),

  // Sessions
  createSession: (body: { user_id: string; agent_id: string }) =>
    post<Session>('/api/sessions', body),
  deleteSession: (id: string) => del(`/api/sessions/${id}`),

  // Chat
  chat: (body: { session_id: string; message: string }) =>
    post<ChatResponse>('/api/chat', body),
};
