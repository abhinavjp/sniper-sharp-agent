/**
 * ollama.ts
 *
 * Local model provider via Ollama / vLLM / llama.cpp (OpenAI-compatible API).
 * Stub — scheduled for implementation in Phase 4 (extension).
 */

import type { AIProvider, ProviderRequest, ProviderResponse } from '../types/ai-provider.js';
import { NotImplementedProviderError } from '../types/ai-provider.js';

export class OllamaProvider implements AIProvider {
  readonly type = 'ollama' as const;
  readonly model: string;

  constructor(config: { model?: string; baseUrl?: string } = {}) {
    this.model = config.model ?? 'llama3';
  }

  complete(_request: ProviderRequest): Promise<ProviderResponse> {
    throw new NotImplementedProviderError('ollama');
  }
}
