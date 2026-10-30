#!/usr/bin/env node
/**
 * Zero-dep stdio smoke test for server/index.mjs.
 *
 * 1. Protocol: initialize, tools/list (count matches README, annotations, typed props).
 * 2. Mock pass (always): every tool in test/fixtures.json against a local mock upstream.
 * 3. Robustness (always): fetch timeout, refused connection, stdin-close drain.
 * 4. Live pass: the same calls against the public Polymarket APIs. Skipped when
 *    SMOKE_OFFLINE=1 or the Gamma preflight fails.
 *
 * Every result must have no structuredContent (or a plain object), compact text of
 * MAX_CHARS or less, no isError on happy-path calls, and next_offset/next_cursor
 * whenever a list says truncated. Error fixtures must surface the expected text.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SERVER = `${ROOT}server/index.mjs`;
const MAX_CHARS = 40000;
const fixtures = JSON.parse(readFileSync(`${ROOT}test/fixtures.json`, "utf8"));
const failures = [];

function check(cond, msg) {
  if (!cond) failures.push(msg);
  return cond;
}

// ── stdio client ───────────────────────────────────────────────
function startServer(env = {}) {
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const waiters = new Map();
  const received = [];
  let buf = "";
  let next = 1;
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        check(false, `stdout has a non-JSON line: ${line.slice(0, 120)}`);
        continue;
      }
      received.push(msg);
      waiters.get(msg.id)?.(msg);
      waiters.delete(msg.id);
    }
  });
  const write = (method, params) => {
    const id = next++;
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    return id;
  };
  const rpc = (method, params) =>
    new Promise((resolve) => {
      waiters.set(next, resolve);
      write(method, params);
    });
  // "close" fires after stdout is fully read; "exit" can fire before the last lines arrive.
  const exited = new Promise((resolve) => child.once("close", resolve));
  return {
    rpc,
    write,
    received,
    call: (name, args) => rpc("tools/call", { name, arguments: args }),
    close: () => {
      child.stdin.end();
      return exited;
    },
  };
}

// ── result checks ──────────────────────────────────────────────
function payloadOf(text) {
  // Tools that return third-party text prefix one "Note: ..." line before the JSON.
  const json = text.startsWith("Note:") ? text.slice(text.indexOf("\n") + 1) : text;
  return JSON.parse(json);
}

function checkPaging(label, v) {
  if (!v || typeof v !== "object") return;
  if (Array.isArray(v)) return v.forEach((x) => checkPaging(label, x));
  if (Array.isArray(v.items) && v.truncated === true) {
    check("next_offset" in v || "next_cursor" in v, `${label}: truncated list without next_offset/next_cursor`);
  }
  for (const x of Object.values(v)) if (x && typeof x === "object") checkPaging(label, x);
}

function checkResult(label, res) {
  if (!check(res.result && !res.error, `${label}: JSON-RPC error ${JSON.stringify(res.error)}`)) return null;
  const r = res.result;
  const sc = r.structuredContent;
  check(
    sc === undefined || (sc !== null && typeof sc === "object" && !Array.isArray(sc)),
    `${label}: structuredContent is not a plain object`
  );
  const text = r.content?.[0]?.text;
  if (!check(typeof text === "string", `${label}: no text content`)) return null;
  check(text.length <= MAX_CHARS, `${label}: text is ${text.length} chars (> ${MAX_CHARS})`);
  return { text, isError: r.isError === true };
}

function checkHappy(label, res) {
  const out = checkResult(label, res);
  if (!out) return null;
  if (!check(!out.isError, `${label}: isError: ${out.text.slice(0, 300)}`)) return null;
  let payload;
  try {
    payload = payloadOf(out.text);
  } catch {
    check(false, `${label}: text is not JSON: ${out.text.slice(0, 200)}`);
    return null;
  }
  check(payload !== null && typeof payload === "object" && !Array.isArray(payload), `${label}: payload is not an object`);
  check(!/\n {2}/.test(out.text), `${label}: JSON is pretty-printed`);
  checkPaging(label, payload);
  return payload;
}

function substitute(v, vars) {
  if (typeof v === "string" && v.startsWith("$")) {
    if (!(v.slice(1) in vars)) throw new Error(`fixture placeholder ${v} has no value`);
    return vars[v.slice(1)];
  }
  if (Array.isArray(v)) return v.map((x) => substitute(x, vars));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, substitute(x, vars)]));
  return v;
}

const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|timed out|HTTP 5\d\d|HTTP 429/;

async function runCalls(srv, label, vars, { retry = false } = {}) {
  const results = {};
  for (const [name, rawArgs] of Object.entries(fixtures.calls)) {
    const args = substitute(rawArgs, vars);
    let res = await srv.call(name, args);
    if (retry && res.result?.isError && TRANSIENT.test(res.result.content?.[0]?.text ?? "")) {
      await new Promise((r) => setTimeout(r, 1500));
      res = await srv.call(name, args);
    }
    results[name] = checkHappy(`${label} ${name}`, res);
  }
  for (const { tool, args, expect } of fixtures.errors) {
    const res = await srv.call(tool, substitute(args, vars));
    const out = checkResult(`${label} error ${tool}`, res);
    if (!out) continue;
    check(out.isError, `${label} error ${tool} ${JSON.stringify(args)}: expected isError`);
    check(out.text.includes(expect), `${label} error ${tool}: expected "${expect}" in: ${out.text.slice(0, 300)}`);
  }
  return results;
}

// ── 1. protocol + schema ───────────────────────────────────────
function propsMissingDocs(schema, path, out) {
  for (const [k, p] of Object.entries(schema.properties ?? {})) {
    if (!p.description && !p.enum) out.push(`${path}.${k}`);
    if (p.items?.properties) propsMissingDocs(p.items, `${path}.${k}[]`, out);
  }
  return out;
}

async function protocolChecks() {
  const srv = startServer();
  const init = await srv.rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke" } });
  check(init.result?.protocolVersion === "2025-06-18", "initialize does not echo a supported protocolVersion");
  const instr = init.result?.instructions ?? "";
  check(instr.length > 0 && instr.length < 600, `instructions length ${instr.length} (want 1-599)`);
  const old = await srv.rpc("initialize", { protocolVersion: "1999-01-01" });
  check(old.result?.protocolVersion === "2025-06-18", "unsupported protocolVersion not answered with 2025-06-18");

  const list = await srv.rpc("tools/list", {});
  const tools = list.result?.tools ?? [];
  const readmeText = readFileSync(`${ROOT}README.md`, "utf8");
  const readme = readmeText.match(/^## MCP tools \((\d+)\)/m);
  check(readme && Number(readme[1]) === tools.length, `README tool count ${readme?.[1]} != tools/list ${tools.length}`);
  const names = tools.map((t) => t.name);
  for (const n of names) check(readmeText.includes(`\`${n}\``), `README does not list ${n}`);
  for (const n of names) check(n in fixtures.calls, `fixtures.calls is missing ${n}`);
  for (const n of Object.keys(fixtures.calls)) check(names.includes(n), `fixtures.calls has unknown tool ${n}`);
  for (const t of tools) {
    check(t.title && t.annotations?.readOnlyHint === true && t.annotations?.openWorldHint === true, `${t.name}: missing title/annotations`);
    check(/^Use for /.test(t.description), `${t.name}: description should lead with "Use for"`);
    const missing = propsMissingDocs(t.inputSchema, t.name, []);
    check(missing.length === 0, `properties without description/enum: ${missing.join(", ")}`);
  }
  console.log(`tools/list: ${tools.length} tools, ${JSON.stringify(list.result).length} B`);

  const unknown = await srv.call("no_such_tool", {});
  check(unknown.error?.code === -32602, "unknown tool should be a JSON-RPC -32602 error");
  const method = await srv.rpc("no/such/method", {});
  check(method.error?.code === -32601, "unknown method should be a JSON-RPC -32601 error");
  await srv.close();
}

// ── 2. mock upstream ───────────────────────────────────────────
const MOCK = {
  TOKEN_ID: "11111111111111111111111111111111111111111111111111111111111111111111111111111",
  TOKEN_ID_2: "22222222222222222222222222222222222222222222222222222222222222222222222222222",
  CONDITION_ID: `0x${"ab".repeat(32)}`,
  USER: `0x${"12".repeat(20)}`,
  MARKET_ID: "1001",
  EVENT_ID: 501,
  EVENT_SLUG: "mock-event",
  SERIES_ID: "45",
  TAG_ID: "21",
};
const PAD = "x".repeat(900);
const market = (i) => ({
  id: String(1000 + i),
  slug: `m-${i}`,
  question: `Mock question ${i}?`,
  conditionId: MOCK.CONDITION_ID,
  clobTokenIds: JSON.stringify([MOCK.TOKEN_ID, MOCK.TOKEN_ID_2]),
  outcomes: '["Yes", "No"]',
  outcomePrices: '["0.4", "0.6"]',
  volume24hr: 1000 - i,
  liquidity: "10",
  endDate: "2099-01-01T00:00:00Z",
  closed: false,
  negRisk: false,
  description: PAD,
});
const event = (i, n) => ({
  id: String(500 + i),
  slug: `e-${i}`,
  title: `Mock event ${i}`,
  endDate: "2099-01-01T00:00:00Z",
  closed: false,
  volume24hr: 1,
  description: PAD,
  markets: Array.from({ length: n }, (_, j) => market(j)),
});
const rows = (n) => Array.from({ length: n }, (_, i) => ({ i, proxyWallet: MOCK.USER, title: `row ${i}`, pad: PAD }));
const book = (token_id) => ({ asset_id: token_id, bids: [{ price: "0.4", size: "10" }], asks: [{ price: "0.6", size: "10" }] });

const mockSeen = new Map();
function mockRoute(method, path, q, body) {
  const limit = Number(q.get("limit") ?? 100);
  const s = path.split("/").filter(Boolean);
  const [svc, ...rest] = s;
  const p = `/${rest.join("/")}`;
  if (svc === "geo") return { blocked: false, ip: "203.0.113.9", country: "US", region: "CA" };
  if (svc === "gamma") {
    if (p === "/markets/keyset") return { markets: Array.from({ length: limit }, (_, i) => market(i)), next_cursor: "CURSOR" };
    if (p === "/events/keyset") return { events: Array.from({ length: limit }, (_, i) => event(i, 40)), next_cursor: "CURSOR" };
    if (p === "/public-search") {
      return { events: Array.from({ length: Number(q.get("limit_per_type")) }, (_, i) => event(i, 40)), pagination: { hasMore: true } };
    }
    if (/^\/markets\/(slug\/)?[^/]+$/.test(p)) return market(1);
    if (/^\/events\/(slug\/)?[^/]+$/.test(p)) return event(1, 200);
    if (p === "/series") return rows(limit);
    if (/^\/series\/\d+$/.test(p)) return { id: "45", title: "Mock series", events: Array.from({ length: 300 }, (_, i) => event(i, 0)) };
    if (p === "/tags" || p === "/teams") return rows(limit);
    if (/^\/tags\/(slug\/)?[^/]+$/.test(p)) return { id: "21", label: "Crypto", slug: "crypto" };
    if (p === "/sports") return rows(600);
    if (p === "/sports/market-types") return { marketTypes: ["moneyline", "spreads"] };
    if (p === "/public-profile") return { proxyWallet: MOCK.USER, name: "mock" };
  }
  if (svc === "clob") {
    const token = q.get("token_id");
    if (token === "123") return { status: 404, body: { error: "No orderbook exists for the requested token id" } };
    if (method === "POST") {
      if (p === "/books") return body.map((b) => book(b.token_id));
      if (p === "/last-trades-prices") return body.map((b) => ({ token_id: b.token_id, price: "0.5", side: "BUY" }));
      if (p === "/prices") return Object.fromEntries(body.map((b) => [b.token_id, { [b.side]: "0.5" }]));
      if (p === "/midpoints" || p === "/spreads") return Object.fromEntries(body.map((b) => [b.token_id, "0.5"]));
    }
    if (p === "/book") return book(token);
    if (p === "/midpoint") return { mid: "0.5" };
    if (p === "/price") return { price: "0.5" };
    if (p === "/spread") return { spread: "0.01" };
    if (p === "/last-trade-price") return { price: "0.5", side: "BUY" };
    if (p === "/prices-history") return { history: Array.from({ length: 24 }, (_, i) => ({ t: 1700000000 + i * 3600, p: 0.5 })) };
    if (p === "/time") return 1793389621;
    if (p === "/fee-rate") return { base_fee: 0 };
    if (p === "/tick-size") return { minimum_tick_size: 0.01 };
    if (p === "/neg-risk") return { neg_risk: false };
    if (p.startsWith("/clob-markets/")) return { c: MOCK.CONDITION_ID };
    if (p.startsWith("/markets-by-token/")) return { condition_id: MOCK.CONDITION_ID };
    if (p === "/simplified-markets" || p === "/sampling-markets") {
      return { data: rows(1000).map((r) => ({ ...r, condition_id: MOCK.CONDITION_ID, question: "q", tokens: [] })), next_cursor: "NEXT", limit: 1000, count: 1000 };
    }
  }
  if (svc === "data") {
    if (["/positions", "/closed-positions", "/activity", "/trades", "/v1/leaderboard"].includes(p)) return rows(limit);
    if (p === "/value") return [{ user: MOCK.USER, value: 1 }];
    if (p === "/holders") return [{ token: MOCK.TOKEN_ID, holders: rows(3) }, { token: MOCK.TOKEN_ID_2, holders: rows(3) }];
    if (p === "/oi") return [{ market: MOCK.CONDITION_ID, value: 1 }];
    if (p === "/live-volume") return [{ total: 1, markets: [] }];
    if (p === "/traded") return { user: MOCK.USER, traded: 3 };
  }
  return { status: 404, body: { error: `mock has no route for ${method} ${path}` } };
}

function startMock() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://mock");
    if (url.pathname.startsWith("/hang")) return; // never answers: exercises the fetch timeout
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      mockSeen.set(url.pathname, url.searchParams);
      let out = mockRoute(req.method, url.pathname, url.searchParams, raw ? JSON.parse(raw) : undefined);
      let status = 200;
      if (out && typeof out === "object" && "status" in out && "body" in out) ({ status, body: out } = out);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(out));
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function mockPass(base) {
  const srv = startServer({
    POLYMARKET_GAMMA_URL: `${base}/gamma`,
    POLYMARKET_CLOB_URL: `${base}/clob`,
    POLYMARKET_DATA_URL: `${base}/data`,
    POLYMARKET_GEOBLOCK_URL: `${base}/geo`,
  });
  const r = await runCalls(srv, "mock", MOCK);

  // P2-4: list_events defaults to open, future-ending, by 24h volume.
  const q = mockSeen.get("/gamma/events/keyset");
  check(
    q?.get("closed") === "false" && q.get("order") === "volume24hr" && q.get("ascending") === "false" && q.get("end_date_min"),
    `list_events default query: ${q}`
  );
  // P1-1: paged lists over the size cap must truncate with a next_* pointer.
  check(r.list_positions?.truncated && r.list_positions.next_offset > 0, "list_positions: oversized page did not truncate");
  check(r.get_event?.markets?.next_offset === 50, "get_event: markets not paged at the default limit 50");
  check(r.list_sampling_markets?.next_offset === 50, "list_sampling_markets: not paged at the default limit 50");
  check(r.list_markets?.next_cursor === "CURSOR", "list_markets: next_cursor not forwarded");
  check(r.search?.events?.length === 5, "search: limit_per_type should default to 5");
  check(r.get_time?.time === 1793389621, "get_time: number not wrapped as {time}");
  // P2-6: geoblock keeps only eligibility.
  check(JSON.stringify(r.get_geoblock) === '{"blocked":false,"country":"US"}', `get_geoblock leaks fields: ${JSON.stringify(r.get_geoblock)}`);
  await srv.close();
}

// ── 3. timeout, refused connection, drain on stdin close ───────
// A port that was just bound and released is closed. Low ports like 1 are on fetch's
// "bad port" list and fail before connecting, so they never yield ECONNREFUSED.
function closedPort() {
  return new Promise((resolve, reject) => {
    const s = createTcpServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function robustnessPass(base) {
  const env = {
    POLYMARKET_GAMMA_URL: `${base}/hang`,
    POLYMARKET_CLOB_URL: `http://127.0.0.1:${await closedPort()}`,
    POLYMARKET_TIMEOUT_MS: "300",
  };
  const srv = startServer(env);
  const t = await srv.call("get_sports_market_types", {});
  check(t.result?.isError && /timed out after 0\.3s/.test(t.result.content[0].text), `timeout not reported: ${JSON.stringify(t)}`);
  const c = await srv.call("get_time", {});
  check(c.result?.isError && /ECONNREFUSED/.test(c.result.content[0].text), `refused connection lacks cause code: ${JSON.stringify(c)}`);
  await srv.close();

  const drain = startServer(env);
  const id = drain.write("tools/call", { name: "list_sports", arguments: {} });
  await drain.close();
  check(drain.received.some((m) => m.id === id), "stdin close dropped an in-flight response");
}

// ── 4. live public endpoints ───────────────────────────────────
async function online() {
  if (process.env.SMOKE_OFFLINE === "1") return false;
  try {
    const res = await fetch("https://gamma-api.polymarket.com/sports/market-types", { signal: AbortSignal.timeout(8000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function livePass() {
  const srv = startServer();
  const first = async (name, args) => {
    const p = checkHappy(`live resolve ${name}`, await srv.call(name, args));
    return p?.items?.[0];
  };
  const m = await first("list_markets", { limit: 5 });
  const e = await first("list_events", { limit: 1 });
  const u = await first("list_leaderboard", { limit: 1 });
  const s = await first("list_series", { limit: 1 });
  const t = await first("list_tags", { limit: 1 });
  if (!check(m && e && u && s && t, "live: could not resolve fixture ids")) return srv.close();
  const vars = {
    MARKET_ID: m.id,
    TOKEN_ID: m.clobTokenIds[0],
    TOKEN_ID_2: m.clobTokenIds[1],
    CONDITION_ID: m.conditionId,
    EVENT_ID: Number(e.id),
    EVENT_SLUG: e.slug,
    USER: u.proxyWallet,
    SERIES_ID: String(s.id),
    TAG_ID: String(t.id),
  };
  const r = await runCalls(srv, "live", vars, { retry: true });
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const stale = (r.list_events?.items ?? []).filter((ev) => ev.closed !== false || Date.parse(ev.endDate) < today);
  check(stale.length === 0, `live list_events default returned closed/past events: ${stale.map((x) => x.slug).join(", ")}`);
  await srv.close();
}

// ── main ───────────────────────────────────────────────────────
await protocolChecks();
const mock = await startMock();
const base = `http://127.0.0.1:${mock.address().port}`;
await mockPass(base);
await robustnessPass(base);
mock.closeAllConnections();
mock.close();
if (await online()) {
  await livePass();
  console.log("live pass: done");
} else {
  console.log("live pass: skipped (SMOKE_OFFLINE=1 or Polymarket unreachable)");
}

if (failures.length) {
  console.error(`FAIL (${failures.length}):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("smoke: all checks passed");
