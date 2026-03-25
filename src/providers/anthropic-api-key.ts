/**
 * anthropic-api-key.ts
 *
 * Anthropic provider authenticated via a manual API key from console.anthropic.com.
 * Stub — scheduled for implementation in Phase 4 (extension).
 */

import type { AIProvider, ProviderRequest, ProviderResponse } from '../types/ai-provider.js';
import { NotImplementedProviderError } from '../types/ai-provider.js';

export class AnthropicApiKeyProvider implements AIProvider {
  readonly type = 'anthropic-api-key' as const;
  readonly model: string;

  constructor(config: { model?: string; apiKey?: string } = {}) {
    this.model = config.model ?? 'claude-opus-4-6';
  }

  complete(_request: ProviderRequest): Promise<ProviderResponse> {
    throw new NotImplementedProviderError('anthropic-api-key');
  }
}
