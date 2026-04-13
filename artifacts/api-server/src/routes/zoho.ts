import { Router } from "express";

const router = Router();

const ZOHO_TOKEN_URL  = "https://accounts.zoho.in/oauth/v2/token";
const ZOHO_API_BASE   = "https://www.zohoapis.in/crm/v2";
const ZOHO_SANDBOX    = "https://crmsandbox.zoho.in/crm/v2";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const params = new URLSearchParams({
    grant_type:    "refresh_token",
    client_id:     process.env.ZOHO_CLIENT_ID     || "",
    client_secret: process.env.ZOHO_CLIENT_SECRET  || "",
    refresh_token: process.env.ZOHO_REFRESH_TOKEN  || "",
  });

  const res = await fetch(ZOHO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho token refresh failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (data.error || !data.access_token) {
    throw new Error(`Zoho token error: ${data.error || "no access_token returned"}`);
  }

  cachedToken = {
    token:     data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  return cachedToken.token;
}

// ── Shared helper: search Zoho Accounts module ─────────────────────────────────
async function searchAccounts(
  base: string,
  token: string,
  q: string,
): Promise<{ id: string; name: string }[]> {
  const url = q.length >= 3
    ? `${base}/Accounts/search?criteria=(Account_Name:contains:${encodeURIComponent(q)})&fields=id,Account_Name&per_page=20`
    : `${base}/Accounts?fields=id,Account_Name&per_page=50&sort_by=Account_Name&sort_order=asc`;

  const r = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
  if (r.status === 204) return [];
  if (!r.ok) throw new Error(`Zoho search failed (${r.status})`);
  const data = (await r.json()) as { data?: { id: string; Account_Name: string }[] };
  return (data.data ?? []).map((a) => ({ id: a.id, name: a.Account_Name })).filter((a) => a.name);
}

// ── Shared helper: search Zoho Contacts module for agency lookup ───────────────
async function searchAgencies(
  base: string,
  token: string,
  q: string,
): Promise<{ id: string; name: string }[]> {
  // Agencies can live in Accounts (media buying agencies) — filter by Agency type if available
  // We search both Account_Name and a keyword match; Zoho Contacts "Account_Name" field.
  const url = q.length >= 3
    ? `${base}/Accounts/search?criteria=(Account_Name:contains:${encodeURIComponent(q)})&fields=id,Account_Name,Account_Type&per_page=20`
    : `${base}/Accounts?fields=id,Account_Name,Account_Type&per_page=50&sort_by=Account_Name&sort_order=asc`;

  const r = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
  if (r.status === 204) return [];
  if (!r.ok) throw new Error(`Zoho agency search failed (${r.status})`);
  const data = (await r.json()) as { data?: { id: string; Account_Name: string; Account_Type?: string }[] };
  return (data.data ?? [])
    .map((a) => ({ id: a.id, name: a.Account_Name, type: a.Account_Type }))
    .filter((a) => a.name);
}

// ── GET /api/zoho/accounts — existing endpoint (Admin: client master list import) ──
router.get("/zoho/accounts", async (req, res) => {
  try {
    const token  = await getAccessToken();
    const search = (req.query.search as string | undefined)?.trim();
    let url: string;
    if (search && search.length >= 2) {
      url = `${ZOHO_API_BASE}/Accounts/search?criteria=(Account_Name:contains:${encodeURIComponent(search)})&fields=Account_Name&per_page=50`;
    } else {
      url = `${ZOHO_API_BASE}/Accounts?fields=Account_Name&per_page=200&sort_by=Account_Name&sort_order=asc`;
    }
    const accountRes = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
    if (accountRes.status === 204) return res.json({ ok: true, accounts: [] });
    if (!accountRes.ok) {
      const text = await accountRes.text();
      throw new Error(`Zoho accounts fetch failed (${accountRes.status}): ${text}`);
    }
    const data = (await accountRes.json()) as {
      data?: { Account_Name: string }[];
      info?: { more_records?: boolean; count?: number };
    };
    const accounts = (data.data ?? []).map((a) => a.Account_Name).filter(Boolean);
    return res.json({ ok: true, accounts, more: data.info?.more_records ?? false });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

// ── GET /api/zoho/clients?q= — live client search (sandbox, returns {id, name}[]) ──
router.get("/zoho/clients", async (req, res) => {
  try {
    const token = await getAccessToken();
    const q     = ((req.query.q as string) ?? "").trim();
    const results = await searchAccounts(ZOHO_API_BASE, token, q);
    return res.json({ ok: true, results });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "An internal error occurred", results: [] });
  }
});

// ── GET /api/zoho/agencies?q= — live agency search (sandbox, returns {id, name}[]) ──
router.get("/zoho/agencies", async (req, res) => {
  try {
    const token = await getAccessToken();
    const q     = ((req.query.q as string) ?? "").trim();
    const results = await searchAgencies(ZOHO_API_BASE, token, q);
    return res.json({ ok: true, results });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "An internal error occurred", results: [] });
  }
});

export default router;
