/**
 * openai-api-key.ts
 *
 * OpenAI / ChatGPT provider authenticated via API key.
 * Stub — scheduled for implementation in Phase 4 (extension).
 */

import type { AIProvider, ProviderRequest, ProviderResponse } from '../types/ai-provider.js';
import { NotImplementedProviderError } from '../types/ai-provider.js';

export class OpenAIApiKeyProvider implements AIProvider {
  readonly type = 'openai-api-key' as const;
  readonly model: string;

  constructor(config: { model?: string; apiKey?: string } = {}) {
    this.model = config.model ?? 'gpt-4o';
  }

  complete(_request: ProviderRequest): Promise<ProviderResponse> {
    throw new NotImplementedProviderError('openai-api-key');
  }
}
