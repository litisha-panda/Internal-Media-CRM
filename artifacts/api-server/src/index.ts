import app from "./app";
import { logger } from "./lib/logger";

// ── Startup environment validation ──────────────────────────────────────────
// Fail fast with a clear message rather than crashing silently on the first
// API call that needs a missing variable.

const REQUIRED_ENV: { key: string; hint: string }[] = [
  { key: "PORT",            hint: "TCP port the server listens on (e.g. 3000)" },
  { key: "DATABASE_URL",    hint: "PostgreSQL connection string (postgres://...)" },
];

// Zoho and Anthropic are optional — their routes degrade gracefully — but
// we warn loudly at startup so operators know which integrations will fail.
const OPTIONAL_ENV: { key: string; hint: string }[] = [
  { key: "ANTHROPIC_API_KEY",   hint: "Required for RO parser and AI features" },
  { key: "ZOHO_CLIENT_ID",      hint: "Required for Zoho CRM client/agency search" },
  { key: "ZOHO_CLIENT_SECRET",  hint: "Required for Zoho CRM client/agency search" },
  { key: "ZOHO_REFRESH_TOKEN",  hint: "Required for Zoho CRM client/agency search" },
  { key: "ALLOWED_ORIGIN",      hint: "CORS allowed origin in production (e.g. https://crm.odishatv.com)" },
];

const missingRequired = REQUIRED_ENV.filter(({ key }) => !process.env[key]);
if (missingRequired.length > 0) {
  for (const { key, hint } of missingRequired) {
    logger.error(`Missing required env var: ${key} — ${hint}`);
  }
  process.exit(1);
}

for (const { key, hint } of OPTIONAL_ENV) {
  if (!process.env[key]) {
    logger.warn(`Optional env var not set: ${key} — ${hint}`);
  }
}

const rawPort = process.env["PORT"]!;
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
