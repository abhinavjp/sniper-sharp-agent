/**
 * anthropic-setup-auth.ts
 *
 * Anthropic provider authenticated via the Claude CLI OAuth token ("setup auth").
 * Auth resolution order:
 *   1. Explicit authToken in constructor config
 *   2. ANTHROPIC_AUTH_TOKEN environment variable
 *   3. ~/.claude/.credentials.json  (Claude CLI stores it here)
 *   4. ~/.claude/credentials.json   (alternate location)
 *   5. ANTHROPIC_API_KEY env var    (fallback — uses x-api-key header instead)
 *
 * Uses @anthropic-ai/sdk with the Messages API and manual agentic loop support.
 * Model default: claude-opus-4-6  (per Anthropic skill docs)
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type {
  AIProvider,
  ContentBlock,
  ProviderRequest,
  ProviderResponse,
  ProviderTool,
  TextBlock,
  ToolResultBlock,
  ToolUseBlock,
} from '../types/ai-provider.js';
import { ProviderAuthError } from '../types/ai-provider.js';

export class AnthropicSetupAuthProvider implements AIProvider {
  readonly type = 'anthropic-setup-auth' as const;
  readonly model: string;

  private readonly client: Anthropic;
  private readonly defaultMaxTokens: number;

  constructor(config: {
    model?: string;
    maxTokens?: number;
    authToken?: string;
    baseUrl?: string;
  } = {}) {
    this.model = config.model ?? 'claude-opus-4-6';
    this.defaultMaxTokens = config.maxTokens ?? 16000;
    this.client = this.buildClient(config);
  }

  // ---------------------------------------------------------------------------
  // Auth Resolution
  // ---------------------------------------------------------------------------

  private buildClient(config: { authToken?: string; baseUrl?: string }): Anthropic {
    const baseURL = config.baseUrl;

    // 1. Explicit authToken
    if (config.authToken) {
      return new Anthropic({ authToken: config.authToken, baseURL });
    }

    // 2. ANTHROPIC_AUTH_TOKEN env var
    const envAuthToken = process.env['ANTHROPIC_AUTH_TOKEN'];
    if (envAuthToken) {
      return new Anthropic({ authToken: envAuthToken, baseURL });
    }

    // 3 & 4. Claude CLI credential files
    const credPaths = [
      join(homedir(), '.claude', '.credentials.json'),
      join(homedir(), '.claude', 'credentials.json'),
    ];

    for (const credPath of credPaths) {
      const token = this.readTokenFromCredFile(credPath);
      if (token) {
        return new Anthropic({ authToken: token, baseURL });
      }
    }

    // 5. ANTHROPIC_API_KEY fallback (different auth header, still works for the API)
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (apiKey) {
      console.warn(
        '[anthropic-setup-auth] No OAuth auth token found. ' +
        'Falling back to ANTHROPIC_API_KEY. ' +
        'For proper setup-auth, run `claude` to authenticate first.',
      );
      return new Anthropic({ apiKey, baseURL });
    }

    throw new ProviderAuthError(
      'anthropic-setup-auth',
      'No authentication credentials found. ' +
      'Set ANTHROPIC_AUTH_TOKEN, or run the `claude` CLI to store credentials at ~/.claude/.credentials.json',
    );
  }

  private readTokenFromCredFile(credPath: string): string | null {
    try {
      const raw = readFileSync(credPath, 'utf-8');
      const creds = JSON.parse(raw) as Record<string, unknown>;
      const token =
        creds['access_token'] ??
        creds['claudeAiOauthToken'] ??
        creds['token'] ??
        creds['api_key'];
      if (typeof token === 'string' && token.length > 0) {
        return token;
      }
    } catch {
      // File doesn't exist or isn't parseable — try next path
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // AIProvider.complete()
  // ---------------------------------------------------------------------------

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const messages = this.toAnthropicMessages(request.messages);
    const tools = request.tools && request.tools.length > 0
      ? this.toAnthropicTools(request.tools)
      : undefined;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens ?? this.defaultMaxTokens,
      system: request.system,
      messages,
      ...(tools ? { tools } : {}),
    });

    return {
      content: this.fromAnthropicContent(response.content),
      stopReason: response.stop_reason as ProviderResponse['stopReason'],
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Type Converters: Our Abstract Types ↔ Anthropic SDK Types
  // ---------------------------------------------------------------------------

  private toAnthropicMessages(
    messages: ProviderRequest['messages'],
  ): Anthropic.MessageParam[] {
    return messages.map((msg): Anthropic.MessageParam => {
      if (typeof msg.content === 'string') {
        return { role: msg.role, content: msg.content };
      }
      return {
        role: msg.role,
        content: this.toAnthropicContentBlocks(msg.content),
      };
    });
  }

  private toAnthropicContentBlocks(
    blocks: ContentBlock[],
  ): Anthropic.ContentBlockParam[] {
    const result: Anthropic.ContentBlockParam[] = [];
    for (const block of blocks) {
      if (block.type === 'text') {
        result.push({ type: 'text', text: block.text });
      } else if (block.type === 'tool_result') {
        result.push({
          type: 'tool_result',
          tool_use_id: block.toolUseId,
          content: block.content,
          ...(block.isError !== undefined ? { is_error: block.isError } : {}),
        });
      } else if (block.type === 'tool_use') {
        // tool_use blocks appear in the assistant's turn (echoed back in multi-turn)
        result.push({
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input,
        });
      }
    }
    return result;
  }

  private toAnthropicTools(tools: ProviderTool[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: tool.inputSchema.properties,
        ...(tool.inputSchema.required ? { required: tool.inputSchema.required } : {}),
      },
    }));
  }

  private fromAnthropicContent(
    content: Anthropic.ContentBlock[],
  ): ContentBlock[] {
    const result: ContentBlock[] = [];
    for (const block of content) {
      if (block.type === 'text') {
        const tb: TextBlock = { type: 'text', text: block.text };
        result.push(tb);
      } else if (block.type === 'tool_use') {
        const tb: ToolUseBlock = {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
        result.push(tb);
      }
      // thinking blocks and other future types are silently skipped
    }
    return result;
  }
}
