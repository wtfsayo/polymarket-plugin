---
name: polymarket-info
description: >-
  Use when reading Polymarket international markets — search/list events & markets,
  tags/series/sports, CLOB book/mid/spread/batch quotes, or Data API positions,
  trades, holders, OI. Call MCP tools; never invent prices. Does not place bets.
  Not Polymarket US exchange.
---
# polymarket-info

Public Gamma + CLOB + Data API only. Prices are 0–1 decimal strings. UA `polymarket-info-mcp/0.2.0`.

## Tools

| Need | Tool |
| --- | --- |
| Browse open markets | `list_markets` (`limit`, `closed`, `after_cursor`) |
| Browse events | `list_events` (`closed`, `end_date_*`, `tag_slug`, …) |
| Search | `search` (`q`) |
| One market / event | `get_market` / `get_event` (`id` or `slug`) |
| Tags / series / sports / teams | `list_tags`, `get_tag`, `list_series`, `get_series`, `list_sports`, `list_teams` |
| Public profile | `get_public_profile` (`address`) |
| L2 book (1 / many) | `get_book` / `get_books` (`token_id` / `token_ids`) |
| Mid / spread / bid price | `get_midpoint` / `get_spread` / `get_price` (+ batch `get_midpoints` / `get_spreads` / `get_prices`) |
| Last print | `get_last_trade_price` / `get_last_trades_prices` (ignore empty-side `0.5`) |
| History | `get_prices_history` (`token_id`, `interval`, `fidelity`) |
| CLOB meta | `get_time`, `get_fee_rate`, `get_tick_size`, `get_neg_risk`, `get_clob_market`, `get_market_by_token` |
| Wallet positions / activity | `list_positions`, `list_closed_positions`, `list_activity`, `list_trades`, `get_value`, `get_traded` |
| Holders / OI / live vol | `list_holders` (`market`=conditionId), `get_oi`, `get_live_volume` (`id`=event) |
| Leaderboard | `list_leaderboard` |
| Am I geoblocked? | `get_geoblock` |

## Rules

- Parse `clobTokenIds` / `outcomes` / `outcomePrices` when they arrive as JSON strings (server normalizes these on market objects).
- Prefer Gamma for discovery; CLOB for live book; Data API for wallet + holders/OI analytics.
- Data API `user` is a public 0x address in the query string — no auth.
- Never place, cancel, or size an order from this plugin.
- Do not mix with Polymarket US symbols or int64 prices.
