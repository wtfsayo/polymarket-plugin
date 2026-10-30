# polymarket-info

Cursor / Agent Plugin for **Polymarket international** public market data:

- **Gamma** (`gamma-api.polymarket.com`) — events, markets, search, tags, series, sports
- **CLOB** (`clob.polymarket.com`) — books, mids, spreads, prices, batch quotes, tick/fee/neg-risk meta
- **Data API** (`data-api.polymarket.com`) — positions, activity, trades, holders, OI, live volume

Read-only. No API keys. No order placement / CLOB auth / Relayer / Bridge / WebSockets.

Docs: https://docs.polymarket.com/  
Marketing (no API catalog): https://institutional.polymarket.com/

**Not** Polymarket US (`docs.polymarket.us` / `*.polymarketexchange.com`).

## Domain types

| Type | Meaning |
| --- | --- |
| `Market` | Gamma market (question, slug, outcomes, `clobTokenIds`, volume, …) |
| `Event` | Gamma event with nested markets |
| `Tag` / `Series` / `Team` / `SportsMetadata` | Gamma discovery metadata |
| `PublicProfile` | Gamma public profile by wallet |
| `OrderBook` | CLOB L2 bids/asks for a `token_id` (prices 0–1 strings) |
| `MidPrice` / `Spread` / `LastTrade` / `Price` | CLOB quote helpers (single + batch) |
| `PriceHistory` | historical mid series |
| `ClobMarket` | CLOB-level market params by `condition_id` |
| `FeeRate` / `TickSize` / `NegRisk` | CLOB market meta |
| `Position` / `ClosedPosition` | Data API open / closed holdings |
| `Activity` / `Trade` | Data API wallet activity & fills |
| `Holder` / `OpenInterest` / `LiveVolume` / `Value` | Data API analytics |
| `LeaderboardEntry` | Trader leaderboard row |
| `GeoBlock` | IP eligibility probe |

Model: event → markets → YES/NO outcome tokens. Use `token_id` from Gamma `clobTokenIds` on CLOB. Prefer Gamma for discovery; CLOB for live book; Data API for wallet/market analytics (`user` = 0x address in query).

## Install (Cursor IDE)

Copy to `~/.cursor/plugins/local/polymarket-info` (real directory), Reload Window.

## Install (Claude Code)

Clone this repo, then start Claude Code with `claude --plugin-dir /path/to/polymarket-plugin`. `.claude-plugin/plugin.json` loads the skill and starts the MCP server with `node ${CLAUDE_PLUGIN_ROOT}/server/index.mjs`. The server has no dependencies, so it needs only Node on `PATH` and no `npm install`.

## MCP tools (43)

### Gamma

| Tool | Host |
| --- | --- |
| `list_markets` | `/markets/keyset` |
| `list_events` | `/events/keyset` |
| `search` | `/public-search` |
| `get_market` | `/markets/{id}` or `/markets/slug/{slug}` |
| `get_event` | `/events/{id}` or `/events/slug/{slug}` |
| `list_tags` / `get_tag` | `/tags`, `/tags/{id\|slug}` |
| `list_series` / `get_series` | `/series`, `/series/{id}` |
| `list_sports` / `get_sports_market_types` | `/sports`, `/sports/market-types` |
| `list_teams` | `/teams` |
| `get_public_profile` | `/public-profile?address=` |

### CLOB

| Tool | Host |
| --- | --- |
| `get_book` / `get_books` | `GET /book`, `POST /books` |
| `get_midpoint` / `get_midpoints` | `GET /midpoint`, `POST /midpoints` |
| `get_price` / `get_prices` | `GET /price`, `POST /prices` |
| `get_spread` / `get_spreads` | `GET /spread`, `POST /spreads` |
| `get_last_trade_price` / `get_last_trades_prices` | `GET /last-trade-price`, `POST /last-trades-prices` |
| `get_prices_history` | `/prices-history` |
| `get_time` | `/time` |
| `get_fee_rate` / `get_tick_size` / `get_neg_risk` | `/fee-rate`, `/tick-size`, `/neg-risk` |
| `get_clob_market` | `/clob-markets/{condition_id}` |
| `get_market_by_token` | `/markets-by-token/{token_id}` |
| `list_simplified_markets` / `list_sampling_markets` | `/simplified-markets`, `/sampling-markets` |

### Data API

| Tool | Host |
| --- | --- |
| `list_positions` | `/positions?user=` |
| `list_closed_positions` | `/closed-positions?user=` |
| `list_activity` | `/activity?user=` |
| `list_trades` | `/trades?user=` and/or `market=` |
| `get_value` | `/value?user=` |
| `list_holders` | `/holders?market=` (conditionId) |
| `get_oi` | `/oi` |
| `get_live_volume` | `/live-volume?id=` (event id) |
| `get_traded` | `/traded?user=` |
| `list_leaderboard` | `/v1/leaderboard` |

### Misc

| Tool | Host |
| --- | --- |
| `get_geoblock` | `polymarket.com/api/geoblock` |

## Licensing note

Capital-markets redistribution of Polymarket data may require Polymarket + ICE licensing. See institutional site / `data-licensing@polymarket.com`. This plugin is for personal agent tooling, not a data-feed substitute.

## License

MIT

## Repository

https://github.com/wtfsayo/polymarket-plugin
