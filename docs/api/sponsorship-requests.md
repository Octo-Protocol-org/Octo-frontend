# Sponsorship config requests (#546)

## Current behaviour

- The dashboard home fetches sponsorship configs for the visible wallets in batches of five
  (`SPONSORSHIP_CONCURRENCY`).
- The global sponsorship page already batches its requests in groups of five
  (`CONFIG_CONCURRENCY`).

Both still send one request per wallet, so the count grows with the number of wallets. Batching
only limits how many run at once.

## Fix that needs the backend

Return `sponsorship` with each wallet in the wallet list response, or add
`GET /v1/sponsorship?wallet_ids=...`. The client then makes a constant number of requests per
page.
