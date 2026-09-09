# Prove note — polymarket-info 0.2.0

| Step | Result |
| --- | --- |
| Schema plugin.json + mcp.json | PASS |
| node --check server/index.mjs | PASS |
| Live endpoint probe (`_probe/LIVE.json`, gitignored) | 48/48 PASS |
| Full MCP live suite (43 tools + error path) | PASS (see TEST-RESULTS.json) |
| Thesis smoke: search → event → books/mids → holders/oi | PASS |
| Local install ~/.cursor/plugins/local/polymarket-info | PASS |

Scope: international Gamma + CLOB + Data API public reads only. No order auth / Relayer / Bridge / WS. Not Polymarket US.

Tool count: **11 → 43**.
