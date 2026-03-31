import { Router } from "express";

const router = Router();

const ZOHO_TOKEN_URL = "https://accounts.zoho.in/oauth/v2/token";
const ZOHO_API_BASE = "https://www.zohoapis.in/crm/v2";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.ZOHO_CLIENT_ID || "",
    client_secret: process.env.ZOHO_CLIENT_SECRET || "",
    refresh_token: process.env.ZOHO_REFRESH_TOKEN || "",
  });

  const res = await fetch(`${ZOHO_TOKEN_URL}?${params.toString()}`, {
    method: "POST",
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
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  return cachedToken.token;
}

router.get("/zoho/accounts", async (req, res) => {
  try {
    const token = await getAccessToken();

    const search = (req.query.search as string | undefined)?.trim();
    let url: string;

    if (search && search.length >= 2) {
      url = `${ZOHO_API_BASE}/Accounts/search?criteria=(Account_Name:contains:${encodeURIComponent(search)})&fields=Account_Name&per_page=50`;
    } else {
      url = `${ZOHO_API_BASE}/Accounts?fields=Account_Name&per_page=200&sort_by=Account_Name&sort_order=asc`;
    }

    const accountRes = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });

    if (accountRes.status === 204) {
      return res.json({ ok: true, accounts: [] });
    }

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
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
});

export default router;
