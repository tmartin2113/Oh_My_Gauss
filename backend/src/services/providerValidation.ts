import Anthropic from "@anthropic-ai/sdk";
import type { Provider } from "../types.js";

export class ProviderValidationError extends Error {
  constructor(
    public readonly provider: Provider,
    message: string,
  ) {
    super(message);
    this.name = "ProviderValidationError";
  }
}

async function validateClaude(apiKey: string): Promise<void> {
  const client = new Anthropic({ apiKey });
  try {
    await client.models.list({ limit: 1 });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new ProviderValidationError("claude", "Invalid Claude API key");
    }
    // Other errors (network, rate-limit) — key format is likely valid
    throw err;
  }
}

async function validateOpenAI(apiKey: string): Promise<void> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.status === 401) throw new ProviderValidationError("openai", "Invalid OpenAI API key");
  if (!res.ok) throw new Error(`OpenAI validation failed: ${res.status}`);
}

async function validateGemini(apiKey: string): Promise<void> {
  const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
  const res = await fetch(url);
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw new ProviderValidationError("gemini", "Invalid Gemini API key");
  }
  if (!res.ok) throw new Error(`Gemini validation failed: ${res.status}`);
}

export async function validateProviderKey(provider: Provider, apiKey: string): Promise<void> {
  switch (provider) {
    case "claude":
      return validateClaude(apiKey);
    case "openai":
      return validateOpenAI(apiKey);
    case "gemini":
      return validateGemini(apiKey);
    default:
      throw new ProviderValidationError(provider, `Unknown provider: ${provider}`);
  }
}
