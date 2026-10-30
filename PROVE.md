# Prove note — polymarket-info 0.3.0

Run `npm test` (`test/smoke.mjs`, zero dependencies). It starts the stdio server and checks:

- `initialize` (protocol version, `instructions`) and `tools/list`: the tool count and every tool name match `README.md`, every tool has a title, `readOnlyHint` and a fixture, and every property has a description or enum.
- Mock pass (always runs): every tool runs with the args in `test/fixtures.json` against a local mock of Gamma, CLOB and the Data API that returns oversized pages. Each result has no `structuredContent`, compact JSON text of 40,000 characters or less, no `isError`, and `next_offset`/`next_cursor` when truncated. Also checks the `list_events` default query and that `get_geoblock` drops `ip`/`region`.
- Error fixtures (bad address, conditionId, Gamma id, enum, unknown argument, resolved token) come back as `isError` results with the expected text.
- A hung upstream returns a timeout error, a refused connection reports its cause code, and stdin close waits for in-flight calls.
- Live pass: the same calls against the public APIs, with ids taken from live `list_*` results. Skipped offline or with `SMOKE_OFFLINE=1`.

CI runs it on every push and daily (`.github/workflows/smoke.yml`). `claude plugin validate . --strict` checks the manifests.

Scope: international Gamma + CLOB + Data API public reads only. No order auth / Relayer / Bridge / WS. Not Polymarket US.
