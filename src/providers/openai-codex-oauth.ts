/**
 * openai-codex-oauth.ts
 *
 * OpenAI Codex provider authenticated via OAuth flow.
 * Stub — scheduled for implementation in Phase 4 (extension).
 */

import type { AIProvider, ProviderRequest, ProviderResponse } from '../types/ai-provider.js';
import { NotImplementedProviderError } from '../types/ai-provider.js';

export class OpenAICodexOAuthProvider implements AIProvider {
  readonly type = 'openai-codex-oauth' as const;
  readonly model: string;

  constructor(config: { model?: string } = {}) {
    this.model = config.model ?? 'codex';
  }

  complete(_request: ProviderRequest): Promise<ProviderResponse> {
    throw new NotImplementedProviderError('openai-codex-oauth');
  }
}
