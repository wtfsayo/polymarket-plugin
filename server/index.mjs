#!/usr/bin/env node
/**
 * Zero-dep stdio MCP for Polymarket international public reads.
 * Gamma discovery + CLOB books/prices. No auth, no order placement.
 */

import { createInterface } from "node:readline";

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";
const UA = "polymarket-info-mcp/0.1.0";

const TOOLS = [
  {
    name: "list_markets",
    description: "Market[] via Gamma /markets/keyset (prefer over offset list).",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Default 20." },
        closed: { type: "boolean", description: "Default false." },
        end_date_min: { type: "string", description: "ISO datetime filter." },
        end_date_max: { type: "string", description: "ISO datetime filter." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search",
    description: "Public search across events/markets (Gamma /public-search).",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Search query." },
      },
      required: ["q"],
      additionalProperties: false,
    },
  },
  {
    name: "get_market",
    description: "One Market by numeric id or slug.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Gamma market id." },
        slug: { type: "string", description: "Market slug." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_event",
    description: "One Event by numeric id or slug (includes nested markets).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        slug: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_book",
    description: "OrderBook for a CLOB token_id (from Market.clobTokenIds).",
    inputSchema: {
      type: "object",
      properties: {
        token_id: { type: "string" },
      },
      required: ["token_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_midpoint",
    description: "MidPrice { mid } for token_id.",
    inputSchema: {
      type: "object",
      properties: { token_id: { type: "string" } },
      required: ["token_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_price",
    description: "Best price for side BUY or SELL.",
    inputSchema: {
      type: "object",
      properties: {
        token_id: { type: "string" },
        side: { type: "string", enum: ["BUY", "SELL"], description: "Default BUY." },
      },
      required: ["token_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_spread",
    description: "Spread { spread } for token_id.",
    inputSchema: {
      type: "object",
      properties: { token_id: { type: "string" } },
      required: ["token_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_last_trade_price",
    description: "LastTrade { price, side }. Ignore placeholder 0.5 with empty side.",
    inputSchema: {
      type: "object",
      properties: { token_id: { type: "string" } },
      required: ["token_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_prices_history",
    description: "PriceHistory for token_id (query param market=token_id).",
    inputSchema: {
      type: "object",
      properties: {
        token_id: { type: "string" },
        interval: { type: "string", description: 'e.g. "1d", "1w", "max".' },
        fidelity: { type: "integer", description: "Minutes between points." },
        startTs: { type: "integer" },
        endTs: { type: "integer" },
      },
      required: ["token_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_geoblock",
    description: "GeoBlock probe for current IP (trading eligibility).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

function qs(params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === "") continue;
    u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

async function httpGet(url) {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": UA },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${url}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

function maybeParseJsonField(v) {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (!t || (t[0] !== "[" && t[0] !== "{")) return v;
  try {
    return JSON.parse(t);
  } catch {
    return v;
  }
}

function normalizeMarket(m) {
  if (!m || typeof m !== "object") return m;
  const out = { ...m };
  for (const k of ["outcomes", "outcomePrices", "clobTokenIds"]) {
    if (k in out) out[k] = maybeParseJsonField(out[k]);
  }
  return out;
}

async function callTool(name, args = {}) {
  switch (name) {
    case "list_markets": {
      const data = await httpGet(
        `${GAMMA}/markets/keyset${qs({
          closed: args.closed === undefined ? false : args.closed,
          limit: args.limit ?? 20,
          end_date_min: args.end_date_min,
          end_date_max: args.end_date_max,
        })}`
      );
      const markets = (data.markets || []).map(normalizeMarket);
      return { ...data, markets };
    }
    case "search": {
      if (!args.q) throw new Error("q is required");
      return httpGet(`${GAMMA}/public-search${qs({ q: args.q })}`);
    }
    case "get_market": {
      if (args.id) return normalizeMarket(await httpGet(`${GAMMA}/markets/${encodeURIComponent(args.id)}`));
      if (args.slug) return normalizeMarket(await httpGet(`${GAMMA}/markets/slug/${encodeURIComponent(args.slug)}`));
      throw new Error("id or slug is required");
    }
    case "get_event": {
      if (args.id) return httpGet(`${GAMMA}/events/${encodeURIComponent(args.id)}`);
      if (args.slug) return httpGet(`${GAMMA}/events/slug/${encodeURIComponent(args.slug)}`);
      throw new Error("id or slug is required");
    }
    case "get_book": {
      if (!args.token_id) throw new Error("token_id is required");
      return httpGet(`${CLOB}/book${qs({ token_id: args.token_id })}`);
    }
    case "get_midpoint": {
      if (!args.token_id) throw new Error("token_id is required");
      return httpGet(`${CLOB}/midpoint${qs({ token_id: args.token_id })}`);
    }
    case "get_price": {
      if (!args.token_id) throw new Error("token_id is required");
      return httpGet(
        `${CLOB}/price${qs({ token_id: args.token_id, side: args.side || "BUY" })}`
      );
    }
    case "get_spread": {
      if (!args.token_id) throw new Error("token_id is required");
      return httpGet(`${CLOB}/spread${qs({ token_id: args.token_id })}`);
    }
    case "get_last_trade_price": {
      if (!args.token_id) throw new Error("token_id is required");
      return httpGet(`${CLOB}/last-trade-price${qs({ token_id: args.token_id })}`);
    }
    case "get_prices_history": {
      if (!args.token_id) throw new Error("token_id is required");
      return httpGet(
        `${CLOB}/prices-history${qs({
          market: args.token_id,
          interval: args.interval,
          fidelity: args.fidelity,
          startTs: args.startTs,
          endTs: args.endTs,
        })}`
      );
    }
    case "get_geoblock":
      return httpGet("https://polymarket.com/api/geoblock");
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}
function ok(id, result) {
  send({ jsonrpc: "2.0", id, result });
}
function fail(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  send({ jsonrpc: "2.0", id, error });
}

async function handle(msg) {
  if (!msg || typeof msg !== "object") return;
  const { id, method, params } = msg;
  if (method === "notifications/initialized" || method?.startsWith("notifications/")) return;
  if (id === undefined || id === null) return;
  try {
    if (method === "initialize") {
      ok(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "polymarket-info", version: "0.1.0" },
      });
      return;
    }
    if (method === "ping") {
      ok(id, {});
      return;
    }
    if (method === "tools/list") {
      ok(id, { tools: TOOLS });
      return;
    }
    if (method === "tools/call") {
      const result = await callTool(params?.name, params?.arguments ?? {});
      ok(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      });
      return;
    }
    fail(id, -32601, `Method not found: ${method}`);
  } catch (e) {
    fail(id, -32000, e?.message || String(e), e?.body);
  }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  const t = line.trim();
  if (!t) return;
  try {
    handle(JSON.parse(t));
  } catch {
    /* ignore */
  }
});
rl.on("close", () => process.exit(0));
