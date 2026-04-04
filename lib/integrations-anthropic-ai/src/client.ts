import Anthropic from "@anthropic-ai/sdk";

// Allow the server to start without Anthropic credentials so that the rest of
// the CRM (auth, state, Zoho, admin) works locally even without an AI key.
// Actual Claude API calls will still fail with a clear error if the key is
// missing, but the server process will not crash on import.
const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL
  || process.env.ANTHROPIC_BASE_URL
  || "https://api.anthropic.com";

const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY
  || process.env.ANTHROPIC_API_KEY
  || "";

if (!apiKey) {
  console.warn(
    "[anthropic] No API key set — Claude proxy calls will fail. " +
    "Set ANTHROPIC_API_KEY in artifacts/api-server/.env to enable AI features.",
  );
}

export const anthropic = new Anthropic({ apiKey, baseURL });
