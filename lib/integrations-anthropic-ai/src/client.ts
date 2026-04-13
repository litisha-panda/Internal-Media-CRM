import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    if (!process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
      throw new Error("AI_INTEGRATIONS_ANTHROPIC_BASE_URL must be set.");
    }
    if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
      throw new Error("AI_INTEGRATIONS_ANTHROPIC_API_KEY must be set.");
    }
    _client = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });
  }
  return _client;
}

// Backwards-compatible named export — lazily resolved on first access
export const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop) {
    return (getAnthropicClient() as any)[prop];
  }
});
