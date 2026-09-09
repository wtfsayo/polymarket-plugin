# Prove note — polymarket-info 0.1.0

| Step | Result |
| --- | --- |
| Schema plugin.json + mcp.json | PASS |
| node --check server/index.mjs | PASS |
| Full MCP live suite (11 tools + error path) | PASS (see TEST-RESULTS.json) |
| Local install ~/.cursor/plugins/local/polymarket-info | PASS |

Scope: international Gamma + CLOB public reads only. No order auth. Not Polymarket US.
