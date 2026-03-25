/**
 * providers/index.ts
 *
 * Factory function that instantiates the correct AIProvider from a ProviderConfig.
 * Add new provider classes here as they are implemented.
 */

import type { AIProvider, ProviderConfig } from '../types/ai-provider.js';
import { AnthropicSetupAuthProvider } from './anthropic-setup-auth.js';
import { AnthropicApiKeyProvider } from './anthropic-api-key.js';
import { OpenAIApiKeyProvider } from './openai-api-key.js';
import { OpenAICodexOAuthProvider } from './openai-codex-oauth.js';
import { OllamaProvider } from './ollama.js';

/**
 * Creates and returns an AIProvider instance matching the given config.
 *
 * @throws {NotImplementedProviderError} if the provider type is not yet implemented.
 * @throws {ProviderAuthError} if the provider cannot resolve credentials.
 */
export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.type) {
    case 'anthropic-setup-auth':
      return new AnthropicSetupAuthProvider({
        ...(config.model ? { model: config.model } : {}),
        ...(config.maxTokens ? { maxTokens: config.maxTokens } : {}),
        ...(config.anthropic?.authToken ? { authToken: config.anthropic.authToken } : {}),
        ...(config.anthropic?.baseUrl ? { baseUrl: config.anthropic.baseUrl } : {}),
      });

    case 'anthropic-api-key':
      return new AnthropicApiKeyProvider({
        ...(config.model ? { model: config.model } : {}),
        ...(config.anthropic?.apiKey ? { apiKey: config.anthropic.apiKey } : {}),
      });

    case 'openai-api-key':
      return new OpenAIApiKeyProvider({
        ...(config.model ? { model: config.model } : {}),
        ...(config.openai?.apiKey ? { apiKey: config.openai.apiKey } : {}),
      });

    case 'openai-codex-oauth':
      return new OpenAICodexOAuthProvider({
        ...(config.model ? { model: config.model } : {}),
      });

    case 'ollama':
      return new OllamaProvider({
        ...(config.model ? { model: config.model } : {}),
        ...(config.ollama?.baseUrl ? { baseUrl: config.ollama.baseUrl } : {}),
      });

    default: {
      const exhaustive: never = config.type;
      throw new Error(`Unknown provider type: ${String(exhaustive)}`);
    }
  }
}

// Re-export types and classes for convenience
export { AnthropicSetupAuthProvider } from './anthropic-setup-auth.js';
export { AnthropicApiKeyProvider } from './anthropic-api-key.js';
export { OpenAIApiKeyProvider } from './openai-api-key.js';
export { OpenAICodexOAuthProvider } from './openai-codex-oauth.js';
export { OllamaProvider } from './ollama.js';
