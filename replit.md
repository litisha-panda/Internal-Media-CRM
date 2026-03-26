# OTV CRM — Sales Command Center

Internal sales management platform for Odisha Television Network. Private, not for external use.

## Stack

- `src/SalesCommandCenter.jsx` — entire frontend, ~7,300 lines, single React component
- `server.js` — Express server, port 3000, proxies Anthropic API to `/api/claude`
- Build tool: Vite. Run `npm run build && node server.js` to redeploy after any change.
- No database. All data lives in browser `localStorage` (15 keys prefixed `otv_`)
- One secret: `ANTHROPIC_API_KEY`

## What it does

Sales pipeline management for OTV's sales team. Reps log daily client meetings, plan tomorrow's meetings, track deals, and submit targets for approval. Managers see live team status, compliance, escalations, and revenue forecasting.

## 6 roles — each sees a different app

Sales Rep → Region Head (RH) → National Sales Head (NSH) → Sales Strategy → CRO → Admin. Digi Ops is a parallel role. Login goes straight to role-based view. Demo accounts on login screen need no password.

## Core workflows

- Rep logs meeting → deal `lastContact` updates → if approval needed, flags to correct person automatically
- Deals auto-escalate to NSH after 14 days no contact (configurable)
- Approval chain: Rep flags → NSH approves → CXO for deals ≥₹3Cr
- 11:30 PM rule: reps must log today's meetings AND plan tomorrow's or system marks them absent
- Targets submitted by reps, approved Rep → RH → NSH → Strategy → CRO

## Admin controls (no code needed)

Admin → System Config: change approval thresholds, SLA hours, inactivity days. Admin → Access Management: approve/revoke user access.

## File structure

- `src/SalesCommandCenter.jsx` — the whole app
- `server.js` — backend proxy
- `src/main.jsx` — React entry point (don't touch)
- `index.html`, `vite.config.js`, `package.json` — build config (don't touch)
