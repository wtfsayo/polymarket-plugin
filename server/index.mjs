#!/usr/bin/env node
/**
 * Zero-dep stdio MCP for Polymarket international public reads.
 * Gamma discovery + CLOB books/prices + Data API analytics.
 * No auth, no order placement. Not Polymarket US.
 */
import { createInterface } from "node:readline";

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";
const DATA = "https://data-api.polymarket.com";
const UA = "polymarket-info-mcp/0.2.0";
const VERSION = "0.2.0";

const tokenIdProp = { type: "string", description: "CLOB token_id (from Market.clobTokenIds)." };
const userProp = {
  type: "string",
  description: "0x-prefixed wallet / proxy address.",
};
const limitProp = (d) => ({ type: "integer", description: `Default ${d}.` });

const TOOLS = [
  // ── Gamma discovery ──────────────────────────────────────────
  {
    name: "list_markets",
    description: "Market[] via Gamma /markets/keyset (prefer over offset list).",
    inputSchema: {
      type: "object",
      properties: {
        limit: limitProp(20),
        closed: { type: "boolean", description: "Default false." },
        end_date_min: { type: "string", description: "ISO datetime filter." },
        end_date_max: { type: "string", description: "ISO datetime filter." },
        after_cursor: { type: "string", description: "Keyset cursor from next_cursor." },
        tag_id: { type: "integer" },
        order: { type: "string", description: "e.g. volume_num,liquidity_num" },
        ascending: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_events",
    description: "Event[] via Gamma /events/keyset (closed, limit, end_date filters).",
    inputSchema: {
      type: "object",
      properties: {
        limit: limitProp(20),
        closed: { type: "boolean" },
        end_date_min: { type: "string" },
        end_date_max: { type: "string" },
        after_cursor: { type: "string" },
        tag_id: { type: "integer" },
        tag_slug: { type: "string" },
        series_id: { type: "integer" },
        featured: { type: "boolean" },
        live: { type: "boolean" },
        order: { type: "string" },
        ascending: { type: "boolean" },
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
        limit_per_type: { type: "integer" },
        events_status: { type: "string" },
        keep_closed_markets: { type: "integer" },
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
    name: "list_tags",
    description: "Tag[] via Gamma /tags.",
    inputSchema: {
      type: "object",
      properties: {
        limit: limitProp(20),
        offset: { type: "integer" },
        order: { type: "string" },
        ascending: { type: "boolean" },
        is_carousel: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_tag",
    description: "One Tag by id or slug.",
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
    name: "list_series",
    description: "Series[] via Gamma /series.",
    inputSchema: {
      type: "object",
      properties: {
        limit: limitProp(20),
        offset: { type: "integer" },
        closed: { type: "boolean" },
        exclude_events: { type: "boolean", description: "Default true (lighter)." },
        recurrence: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_series",
    description: "One Series by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_sports",
    description: "Sports metadata (sport, tags, series ids) via Gamma /sports.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_sports_market_types",
    description: "Valid sports market types via Gamma /sports/market-types.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_teams",
    description: "Team[] via Gamma /teams.",
    inputSchema: {
      type: "object",
      properties: {
        limit: limitProp(20),
        offset: { type: "integer" },
        league: { type: "string" },
        name: { type: "string" },
        abbreviation: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_public_profile",
    description: "Public profile by wallet address (Gamma /public-profile).",
    inputSchema: {
      type: "object",
      properties: { address: userProp },
      required: ["address"],
      additionalProperties: false,
    },
  },
  // ── CLOB single ──────────────────────────────────────────────
  {
    name: "get_book",
    description: "OrderBook for a CLOB token_id.",
    inputSchema: {
      type: "object",
      properties: { token_id: tokenIdProp },
      required: ["token_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_midpoint",
    description: "MidPrice { mid } for token_id.",
    inputSchema: {
      type: "object",
      properties: { token_id: tokenIdProp },
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
        token_id: tokenIdProp,
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
      properties: { token_id: tokenIdProp },
      required: ["token_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_last_trade_price",
    description: "LastTrade { price, side }. Ignore placeholder 0.5 with empty side.",
    inputSchema: {
      type: "object",
      properties: { token_id: tokenIdProp },
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
        token_id: tokenIdProp,
        interval: { type: "string", description: 'e.g. "1d", "1w", "max".' },
        fidelity: { type: "integer", description: "Minutes between points." },
        startTs: { type: "integer" },
        endTs: { type: "integer" },
      },
      required: ["token_id"],
      additionalProperties: false,
    },
  },
  // ── CLOB batch ───────────────────────────────────────────────
  {
    name: "get_books",
    description: "Batch OrderBook[] via POST /books (max 500 token_ids).",
    inputSchema: {
      type: "object",
      properties: {
        token_ids: {
          type: "array",
          items: { type: "string" },
          description: "Token IDs (max 500).",
        },
      },
      required: ["token_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "get_prices",
    description: "Batch best prices via POST /prices. Each item needs token_id + side.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              token_id: { type: "string" },
              side: { type: "string", enum: ["BUY", "SELL"] },
            },
            required: ["token_id", "side"],
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
  {
    name: "get_midpoints",
    description: "Batch midpoints map via POST /midpoints.",
    inputSchema: {
      type: "object",
      properties: {
        token_ids: { type: "array", items: { type: "string" } },
      },
      required: ["token_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "get_spreads",
    description: "Batch spreads map via POST /spreads.",
    inputSchema: {
      type: "object",
      properties: {
        token_ids: { type: "array", items: { type: "string" } },
      },
      required: ["token_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "get_last_trades_prices",
    description: "Batch last trades via POST /last-trades-prices (max 500).",
    inputSchema: {
      type: "object",
      properties: {
        token_ids: { type: "array", items: { type: "string" } },
      },
      required: ["token_ids"],
      additionalProperties: false,
    },
  },
  // ── CLOB meta ────────────────────────────────────────────────
  {
    name: "get_time",
    description: "CLOB server Unix time (seconds).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_fee_rate",
    description: "Base fee rate for token_id (CLOB /fee-rate).",
    inputSchema: {
      type: "object",
      properties: { token_id: tokenIdProp },
      required: ["token_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_tick_size",
    description: "Minimum tick size for token_id (CLOB /tick-size).",
    inputSchema: {
      type: "object",
      properties: { token_id: tokenIdProp },
      required: ["token_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_neg_risk",
    description: "Negative-risk flag for token_id (CLOB /neg-risk).",
    inputSchema: {
      type: "object",
      properties: { token_id: tokenIdProp },
      required: ["token_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_clob_market",
    description: "CLOB market details by condition_id (/clob-markets/{condition_id}).",
    inputSchema: {
      type: "object",
      properties: {
        condition_id: { type: "string", description: "0x condition id." },
      },
      required: ["condition_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_market_by_token",
    description: "Resolve parent market from token_id (/markets-by-token/{token_id}).",
    inputSchema: {
      type: "object",
      properties: { token_id: tokenIdProp },
      required: ["token_id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_simplified_markets",
    description: "Paginated simplified CLOB markets (/simplified-markets).",
    inputSchema: {
      type: "object",
      properties: {
        next_cursor: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_sampling_markets",
    description: "Paginated sampling CLOB markets (/sampling-markets).",
    inputSchema: {
      type: "object",
      properties: {
        next_cursor: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  // ── Data API ─────────────────────────────────────────────────
  {
    name: "list_positions",
    description: "Open Position[] for user (Data API /positions).",
    inputSchema: {
      type: "object",
      properties: {
        user: userProp,
        market: { type: "string", description: "conditionId filter." },
        eventId: { type: "integer" },
        limit: limitProp(100),
        offset: { type: "integer" },
        sizeThreshold: { type: "number" },
        redeemable: { type: "boolean" },
        sortBy: { type: "string" },
        sortDirection: { type: "string", enum: ["ASC", "DESC"] },
      },
      required: ["user"],
      additionalProperties: false,
    },
  },
  {
    name: "list_closed_positions",
    description: "ClosedPosition[] for user (Data API /closed-positions).",
    inputSchema: {
      type: "object",
      properties: {
        user: userProp,
        market: { type: "string" },
        eventId: { type: "integer" },
        limit: limitProp(10),
        offset: { type: "integer" },
        sortBy: { type: "string" },
        sortDirection: { type: "string", enum: ["ASC", "DESC"] },
        title: { type: "string" },
      },
      required: ["user"],
      additionalProperties: false,
    },
  },
  {
    name: "list_activity",
    description: "Activity[] for user (Data API /activity).",
    inputSchema: {
      type: "object",
      properties: {
        user: userProp,
        market: { type: "string" },
        eventId: { type: "integer" },
        limit: limitProp(100),
        offset: { type: "integer" },
        type: { type: "string", description: "Comma-separated activity types." },
        side: { type: "string", enum: ["BUY", "SELL"] },
        start: { type: "integer" },
        end: { type: "integer" },
        sortBy: { type: "string" },
        sortDirection: { type: "string", enum: ["ASC", "DESC"] },
      },
      required: ["user"],
      additionalProperties: false,
    },
  },
  {
    name: "list_trades",
    description: "Trade[] by user and/or market (Data API /trades).",
    inputSchema: {
      type: "object",
      properties: {
        user: userProp,
        market: { type: "string", description: "conditionId (comma-separated ok)." },
        eventId: { type: "integer" },
        limit: limitProp(100),
        offset: { type: "integer" },
        side: { type: "string", enum: ["BUY", "SELL"] },
        takerOnly: { type: "boolean" },
        start: { type: "integer" },
        end: { type: "integer" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_value",
    description: "Total position value for user (Data API /value).",
    inputSchema: {
      type: "object",
      properties: {
        user: userProp,
        market: { type: "string" },
      },
      required: ["user"],
      additionalProperties: false,
    },
  },
  {
    name: "list_holders",
    description: "Top holders by conditionId (Data API /holders).",
    inputSchema: {
      type: "object",
      properties: {
        market: { type: "string", description: "conditionId (required)." },
        limit: limitProp(20),
        minBalance: { type: "integer" },
      },
      required: ["market"],
      additionalProperties: false,
    },
  },
  {
    name: "get_oi",
    description: "Open interest (Data API /oi). Optional market=conditionId.",
    inputSchema: {
      type: "object",
      properties: {
        market: { type: "string", description: "conditionId filter." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_live_volume",
    description: "Live volume for an event id (Data API /live-volume).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "Gamma event id." },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_traded",
    description: "Count of markets a user has traded (Data API /traded).",
    inputSchema: {
      type: "object",
      properties: { user: userProp },
      required: ["user"],
      additionalProperties: false,
    },
  },
  {
    name: "list_leaderboard",
    description: "Trader leaderboard (Data API /v1/leaderboard).",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "OVERALL, POLITICS, SPORTS, …" },
        timePeriod: { type: "string", enum: ["DAY", "WEEK", "MONTH", "ALL"] },
        orderBy: { type: "string", enum: ["PNL", "VOL"] },
        limit: limitProp(25),
        offset: { type: "integer" },
        user: userProp,
      },
      additionalProperties: false,
    },
  },
  // ── Misc ─────────────────────────────────────────────────────
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

async function httpPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": UA,
    },
    body: JSON.stringify(body),
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

function normalizeEvent(e) {
  if (!e || typeof e !== "object") return e;
  const out = { ...e };
  if (Array.isArray(out.markets)) out.markets = out.markets.map(normalizeMarket);
  return out;
}

function bookRequests(tokenIds) {
  if (!Array.isArray(tokenIds) || !tokenIds.length) {
    throw new Error("token_ids must be a non-empty array");
  }
  if (tokenIds.length > 500) throw new Error("token_ids max 500");
  return tokenIds.map((token_id) => ({ token_id: String(token_id) }));
}

async function callTool(name, args = {}) {
  switch (name) {
    // Gamma
    case "list_markets": {
      const data = await httpGet(
        `${GAMMA}/markets/keyset${qs({
          closed: args.closed === undefined ? false : args.closed,
          limit: args.limit ?? 20,
          end_date_min: args.end_date_min,
          end_date_max: args.end_date_max,
          after_cursor: args.after_cursor,
          tag_id: args.tag_id,
          order: args.order,
          ascending: args.ascending,
        })}`
      );
      return { ...data, markets: (data.markets || []).map(normalizeMarket) };
    }
    case "list_events": {
      const data = await httpGet(
        `${GAMMA}/events/keyset${qs({
          closed: args.closed,
          limit: args.limit ?? 20,
          end_date_min: args.end_date_min,
          end_date_max: args.end_date_max,
          after_cursor: args.after_cursor,
          tag_id: args.tag_id,
          tag_slug: args.tag_slug,
          series_id: args.series_id,
          featured: args.featured,
          live: args.live,
          order: args.order,
          ascending: args.ascending,
        })}`
      );
      return { ...data, events: (data.events || []).map(normalizeEvent) };
    }
    case "search": {
      if (!args.q) throw new Error("q is required");
      return httpGet(
        `${GAMMA}/public-search${qs({
          q: args.q,
          limit_per_type: args.limit_per_type,
          events_status: args.events_status,
          keep_closed_markets: args.keep_closed_markets,
        })}`
      );
    }
    case "get_market": {
      if (args.id)
        return normalizeMarket(await httpGet(`${GAMMA}/markets/${encodeURIComponent(args.id)}`));
      if (args.slug)
        return normalizeMarket(
          await httpGet(`${GAMMA}/markets/slug/${encodeURIComponent(args.slug)}`)
        );
      throw new Error("id or slug is required");
    }
    case "get_event": {
      let ev;
      if (args.id) ev = await httpGet(`${GAMMA}/events/${encodeURIComponent(args.id)}`);
      else if (args.slug)
        ev = await httpGet(`${GAMMA}/events/slug/${encodeURIComponent(args.slug)}`);
      else throw new Error("id or slug is required");
      return normalizeEvent(ev);
    }
    case "list_tags":
      return httpGet(
        `${GAMMA}/tags${qs({
          limit: args.limit ?? 20,
          offset: args.offset,
          order: args.order,
          ascending: args.ascending,
          is_carousel: args.is_carousel,
        })}`
      );
    case "get_tag": {
      if (args.id) return httpGet(`${GAMMA}/tags/${encodeURIComponent(args.id)}`);
      if (args.slug) return httpGet(`${GAMMA}/tags/slug/${encodeURIComponent(args.slug)}`);
      throw new Error("id or slug is required");
    }
    case "list_series":
      return httpGet(
        `${GAMMA}/series${qs({
          limit: args.limit ?? 20,
          offset: args.offset,
          closed: args.closed,
          exclude_events: args.exclude_events === undefined ? true : args.exclude_events,
          recurrence: args.recurrence,
        })}`
      );
    case "get_series": {
      if (!args.id) throw new Error("id is required");
      return httpGet(`${GAMMA}/series/${encodeURIComponent(args.id)}`);
    }
    case "list_sports":
      return httpGet(`${GAMMA}/sports`);
    case "get_sports_market_types":
      return httpGet(`${GAMMA}/sports/market-types`);
    case "list_teams":
      return httpGet(
        `${GAMMA}/teams${qs({
          limit: args.limit ?? 20,
          offset: args.offset,
          league: args.league,
          name: args.name,
          abbreviation: args.abbreviation,
        })}`
      );
    case "get_public_profile": {
      if (!args.address) throw new Error("address is required");
      return httpGet(`${GAMMA}/public-profile${qs({ address: args.address })}`);
    }
    // CLOB single
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
    // CLOB batch
    case "get_books":
      return httpPost(`${CLOB}/books`, bookRequests(args.token_ids));
    case "get_prices": {
      if (!Array.isArray(args.items) || !args.items.length) {
        throw new Error("items must be a non-empty array of {token_id, side}");
      }
      return httpPost(
        `${CLOB}/prices`,
        args.items.map((i) => ({
          token_id: String(i.token_id),
          side: i.side || "BUY",
        }))
      );
    }
    case "get_midpoints":
      return httpPost(`${CLOB}/midpoints`, bookRequests(args.token_ids));
    case "get_spreads":
      return httpPost(`${CLOB}/spreads`, bookRequests(args.token_ids));
    case "get_last_trades_prices":
      return httpPost(`${CLOB}/last-trades-prices`, bookRequests(args.token_ids));
    // CLOB meta
    case "get_time":
      return httpGet(`${CLOB}/time`);
    case "get_fee_rate": {
      if (!args.token_id) throw new Error("token_id is required");
      return httpGet(`${CLOB}/fee-rate${qs({ token_id: args.token_id })}`);
    }
    case "get_tick_size": {
      if (!args.token_id) throw new Error("token_id is required");
      return httpGet(`${CLOB}/tick-size${qs({ token_id: args.token_id })}`);
    }
    case "get_neg_risk": {
      if (!args.token_id) throw new Error("token_id is required");
      return httpGet(`${CLOB}/neg-risk${qs({ token_id: args.token_id })}`);
    }
    case "get_clob_market": {
      if (!args.condition_id) throw new Error("condition_id is required");
      return httpGet(`${CLOB}/clob-markets/${encodeURIComponent(args.condition_id)}`);
    }
    case "get_market_by_token": {
      if (!args.token_id) throw new Error("token_id is required");
      return httpGet(`${CLOB}/markets-by-token/${encodeURIComponent(args.token_id)}`);
    }
    case "list_simplified_markets":
      return httpGet(`${CLOB}/simplified-markets${qs({ next_cursor: args.next_cursor })}`);
    case "list_sampling_markets":
      return httpGet(`${CLOB}/sampling-markets${qs({ next_cursor: args.next_cursor })}`);
    // Data API
    case "list_positions": {
      if (!args.user) throw new Error("user is required");
      return httpGet(
        `${DATA}/positions${qs({
          user: args.user,
          market: args.market,
          eventId: args.eventId,
          limit: args.limit,
          offset: args.offset,
          sizeThreshold: args.sizeThreshold,
          redeemable: args.redeemable,
          sortBy: args.sortBy,
          sortDirection: args.sortDirection,
        })}`
      );
    }
    case "list_closed_positions": {
      if (!args.user) throw new Error("user is required");
      return httpGet(
        `${DATA}/closed-positions${qs({
          user: args.user,
          market: args.market,
          eventId: args.eventId,
          limit: args.limit,
          offset: args.offset,
          sortBy: args.sortBy,
          sortDirection: args.sortDirection,
          title: args.title,
        })}`
      );
    }
    case "list_activity": {
      if (!args.user) throw new Error("user is required");
      return httpGet(
        `${DATA}/activity${qs({
          user: args.user,
          market: args.market,
          eventId: args.eventId,
          limit: args.limit,
          offset: args.offset,
          type: args.type,
          side: args.side,
          start: args.start,
          end: args.end,
          sortBy: args.sortBy,
          sortDirection: args.sortDirection,
        })}`
      );
    }
    case "list_trades": {
      if (!args.user && !args.market && !args.eventId) {
        throw new Error("user, market, or eventId is required");
      }
      return httpGet(
        `${DATA}/trades${qs({
          user: args.user,
          market: args.market,
          eventId: args.eventId,
          limit: args.limit,
          offset: args.offset,
          side: args.side,
          takerOnly: args.takerOnly,
          start: args.start,
          end: args.end,
        })}`
      );
    }
    case "get_value": {
      if (!args.user) throw new Error("user is required");
      return httpGet(`${DATA}/value${qs({ user: args.user, market: args.market })}`);
    }
    case "list_holders": {
      if (!args.market) throw new Error("market (conditionId) is required");
      return httpGet(
        `${DATA}/holders${qs({
          market: args.market,
          limit: args.limit,
          minBalance: args.minBalance,
        })}`
      );
    }
    case "get_oi":
      return httpGet(`${DATA}/oi${qs({ market: args.market })}`);
    case "get_live_volume": {
      if (args.id === undefined || args.id === null) throw new Error("id is required");
      return httpGet(`${DATA}/live-volume${qs({ id: args.id })}`);
    }
    case "get_traded": {
      if (!args.user) throw new Error("user is required");
      return httpGet(`${DATA}/traded${qs({ user: args.user })}`);
    }
    case "list_leaderboard":
      return httpGet(
        `${DATA}/v1/leaderboard${qs({
          category: args.category,
          timePeriod: args.timePeriod,
          orderBy: args.orderBy,
          limit: args.limit,
          offset: args.offset,
          user: args.user,
        })}`
      );
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
        serverInfo: { name: "polymarket-info", version: VERSION },
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
    /* ignore malformed */
  }
});
rl.on("close", () => process.exit(0));
