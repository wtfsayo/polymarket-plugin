# Thesis smoke (manual)

Typical agent path:

1. `search` / `list_events` → pick an Event
2. nested Market → parse `clobTokenIds` + `conditionId`
3. `get_books` + `get_midpoints` (batch) for both outcomes
4. `list_holders` + `get_oi` on `conditionId`; `get_live_volume` on event id

Refresh `THESIS-SNAPSHOT.json` after a live run (gitignored).
