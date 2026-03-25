/**
 * ai-provider.ts
 *
 * Provider-agnostic interfaces for all AI providers in this framework.
 * These types decouple the agent loop from any specific SDK or vendor.
 *
 * Providers:
 *   anthropic-setup-auth  — Anthropic via Claude CLI OAuth token (setup flow)
 *   anthropic-api-key     — Anthropic via manual API key (console.anthropic.com)
 *   openai-api-key        — OpenAI / ChatGPT via API key
 *   openai-codex-oauth    — OpenAI Codex via OAuth flow
 *   ollama                — Local models via Ollama / vLLM / llama.cpp
 */

// ---------------------------------------------------------------------------
// Provider Identity
// ---------------------------------------------------------------------------

export type ProviderType =
  | 'anthropic-setup-auth'
  | 'anthropic-api-key'
  | 'openai-api-key'
  | 'openai-codex-oauth'
  | 'ollama';

export interface ProviderConfig {
  type: ProviderType;

  /** Model identifier — use the provider's native model string. */
  model: string;

  /** Default token ceiling for completions. Provider implementations may have their own default. */
  maxTokens?: number;

  /** Anthropic-specific options. */
  anthropic?: {
    /** Explicit auth token (setup-auth flow). Auto-resolved if omitted. */
    authToken?: string;
    /** Explicit API key (api-key flow). Reads ANTHROPIC_API_KEY if omitted. */
    apiKey?: string;
    /** Override base URL (useful for proxies or Claude-compatible APIs). */
    baseUrl?: string;
  };

  /** OpenAI-specific options. */
  openai?: {
    apiKey?: string;
    organizationId?: string;
    baseUrl?: string;
  };

  /** Ollama-specific options. */
  ollama?: {
    /** Base URL of the Ollama server. Default: http://localhost:11434 */
    baseUrl?: string;
  };
}

// ---------------------------------------------------------------------------
// Abstract Content Blocks (provider-agnostic)
// ---------------------------------------------------------------------------

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  /** Provider-generated ID linking the call to its result. */
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  /** Must match the id of the corresponding ToolUseBlock. */
  toolUseId: string;
  /** Serialised result payload (JSON string or plain text). */
  content: string;
  isError?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

// ---------------------------------------------------------------------------
// Messages (provider-agnostic)
// ---------------------------------------------------------------------------

export type MessageRole = 'user' | 'assistant';

export interface ProviderMessage {
  role: MessageRole;
  /**
   * String content for simple turns.
   * ContentBlock[] for turns that include tool_use or tool_result blocks.
   */
  content: string | ContentBlock[];
}

// ---------------------------------------------------------------------------
// Tool Definitions (provider-agnostic)
// ---------------------------------------------------------------------------

export interface ProviderTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ---------------------------------------------------------------------------
// Request / Response
// ---------------------------------------------------------------------------

export interface ProviderRequest {
  /** Full system prompt — AGENTS.md + SOUL.md combined. */
  system: string;
  messages: ProviderMessage[];
  tools?: ProviderTool[];
  maxTokens?: number;
}

export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';

export interface ProviderResponse {
  content: ContentBlock[];
  stopReason: StopReason;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Provider Interface
// ---------------------------------------------------------------------------

export interface AIProvider {
  readonly type: ProviderType;
  readonly model: string;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class NotImplementedProviderError extends Error {
  constructor(providerType: ProviderType) {
    super(
      `AI provider "${providerType}" is not yet implemented. ` +
      `See docs/ROADMAP.md for the implementation schedule.`,
    );
    this.name = 'NotImplementedProviderError';
  }
}

export class ProviderAuthError extends Error {
  constructor(providerType: ProviderType, detail: string) {
    super(`[${providerType}] Authentication failed: ${detail}`);
    this.name = 'ProviderAuthError';
  }
}
