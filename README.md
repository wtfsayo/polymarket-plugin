# polymarket-info

Cursor / Agent Plugin for **Polymarket international** public market data:

- **Gamma** (`gamma-api.polymarket.com`) — events, markets, search
- **CLOB** (`clob.polymarket.com`) — books, mid, spread, price, last trade, history

Read-only. No API keys. No order placement / CLOB auth.

Docs: https://docs.polymarket.com/  
Marketing (no API catalog): https://institutional.polymarket.com/

**Not** Polymarket US (`docs.polymarket.us` / `*.polymarketexchange.com`).

## Domain types

| Type | Meaning |
| --- | --- |
| `Market` | Gamma market (question, slug, outcomes, `clobTokenIds`, volume, …) |
| `Event` | Gamma event with nested markets |
| `OrderBook` | CLOB L2 bids/asks for a `token_id` (prices 0–1 strings) |
| `MidPrice` / `Spread` / `LastTrade` | CLOB quote helpers |
| `PriceHistory` | historical mid series |
| `GeoBlock` | IP eligibility probe |

Model: event → markets → YES/NO outcome tokens. Use `token_id` from Gamma `clobTokenIds` on CLOB. There is no `GET /markets` on CLOB.

## Install (Cursor IDE)

Copy to `~/.cursor/plugins/local/polymarket-info` (real directory), Reload Window.

## MCP tools

| Tool | Host |
| --- | --- |
| `list_markets` | Gamma `/markets/keyset` |
| `search` | Gamma `/public-search` |
| `get_market` | Gamma `/markets/{id}` or `/markets/slug/{slug}` |
| `get_event` | Gamma `/events/{id}` or `/events/slug/{slug}` |
| `get_book` | CLOB `/book` |
| `get_midpoint` | CLOB `/midpoint` |
| `get_price` | CLOB `/price` |
| `get_spread` | CLOB `/spread` |
| `get_last_trade_price` | CLOB `/last-trade-price` |
| `get_prices_history` | CLOB `/prices-history` |
| `get_geoblock` | `polymarket.com/api/geoblock` |

## Licensing note

Capital-markets redistribution of Polymarket data may require Polymarket + ICE licensing. See institutional site / `data-licensing@polymarket.com`. This plugin is for personal agent tooling, not a data-feed substitute.

## License

MIT
