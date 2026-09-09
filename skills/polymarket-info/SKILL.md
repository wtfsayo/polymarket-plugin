---
name: polymarket-info
description: >-
  Use when reading Polymarket international markets — search/list events, fetch
  a market/event, or pull CLOB book/mid/spread/last/history. Call MCP tools;
  never invent prices. Does not place bets. Not Polymarket US exchange.
---
# polymarket-info

Public Gamma + CLOB only. Prices are 0–1 decimal strings.

## Tools

| Need | Tool |
| --- | --- |
| Browse open markets | `list_markets` (`limit`, `closed`) |
| Search | `search` (`q`) |
| One market | `get_market` (`id` or `slug`) |
| One event | `get_event` (`id` or `slug`) |
| L2 book | `get_book` (`token_id` from `clobTokenIds`) |
| Mid / spread / bid price | `get_midpoint` / `get_spread` / `get_price` |
| Last print | `get_last_trade_price` (ignore empty-side `0.5` placeholders) |
| History | `get_prices_history` (`market`=token_id, `interval`, `fidelity`) |
| Am I geoblocked? | `get_geoblock` |

## Rules

- Parse `clobTokenIds` / `outcomes` / `outcomePrices` when they arrive as JSON strings.
- Prefer Gamma for discovery; CLOB for live book.
- Never place, cancel, or size an order from this plugin.
- Do not mix with Polymarket US symbols or int64 prices.
