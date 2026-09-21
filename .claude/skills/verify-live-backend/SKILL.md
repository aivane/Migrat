---
name: verify-live-backend
description: Use whenever a user reports something broken, missing, wrong, or hung on any page backed by this app's APIs (fundinfo, dashboard, insights, auth, articles, FAQ) — "ค้าง"/"ไม่โหลด"/"พัง"/hangs/404/wrong data/only one item shows/etc. Also use before claiming an API-related bug is fixed, or before proposing a fix for anything that touches src/services/*.js. Make sure to reach for this skill even if the user just says a page "looks wrong" or "doesn't show data" without mentioning an API at all — in this codebase that is almost always an API-layer issue, not a rendering bug. Do not skip straight to reading service-file source and guessing; this skill exists because that guess is wrong often enough to matter.
---

# Verify Against the Live Backend

## Why this exists

This app has no test suite and every "mode" (`direct`/`wordpress`) hits a real,
independently-changing third-party backend (see [context.md](../../../context.md)
and [CLAUDE.md](../../../CLAUDE.md)). Reading `src/services/*.js` only tells you
what path the code *intends* to call — not whether that path currently exists,
what shape it returns, or whether the tunnel in front of it is even up right
now. In this repo, real bugs found by actually hitting the backend have
included: a path missing an `/api/v1` prefix (fundApi.js/insightsApi.js — pure
route mismatch), a dead ngrok tunnel (auth backend — infra, not code), a
backend field mislabeling Thai stocks as `FOREIGN` (data quality — and it
self-resolved between two checks an hour apart), and a genuinely huge but
correctly-paginated dataset that just needed a loading indicator (not a bug at
all). Four different root causes that all *looked* like "the page is broken"
from the outside — none of them discoverable by reading the Vue component.

## The workflow

1. **Reproduce it for real, not from the diff/description.** Start the dev
   server (`npm run dev`) and open the actual affected page/route. Read the
   browser's network tab (or use the Browser tool's `read_network_requests`)
   for the real request URLs and status codes. Don't reason about what a
   request "should" look like — read the one that actually fired.

2. **Isolate frontend vs. backend by calling the backend directly.** Take the
   exact path the failing request used and `curl` (or `node -e "fetch(...)"`)
   the real upstream host directly — skip the Vite dev proxy entirely. The
   real hosts are the `VITE_PROXY_*` values in `.env` / `vite.config.js`
   (`VITE_PROXY_FUND_API`, `VITE_PROXY_FUND_BACKEND`, `VITE_PROXY_WP_SITE`).
   This one step answers the most important question first: is this even our
   bug?
   - Same 404/error direct from the backend → route mismatch or backend gap.
     Check whether the calling service (`fundApi.js`, `insightsApi.js`,
     `fundinfoApi.js`, `authApi.js`) is using a stale/wrong path — compare
     against a sibling service that's known to work.
   - Backend unreachable entirely (connection refused, an ngrok interstitial
     page, TLS handshake failure) → this is infra, not app code. Say so
     explicitly instead of "fixing" a symptom in the frontend. (An ngrok TLS
     handshake failure specifically often means `proxy_ssl_server_name` /
     SNI is missing on a reverse proxy in front of it, if you're the one
     running that proxy — see `docker/nginx.conf.template` for the pattern.)
   - Backend responds 200 but with wrong/nonsensical data (e.g. a stock
     tagged `market_type=FOREIGN` that is obviously a Thai bank) → backend
     data-quality issue. Check `src/services/fundinfoApi.js` for an existing
     defensive filter first (grep for `API Data Quality` comments) before
     assuming nothing has been done about it — someone may have already
     hardened the client against exactly this.

3. **Re-check, don't recall.** If you or anyone investigated this exact
   endpoint before, re-run the check now rather than reusing the old result —
   this backend visibly changes state between sessions (a misclassification
   bug we found and worked around was gone an hour later; the same tunnel has
   been both up and down across different checks). "It was broken yesterday"
   is not evidence about right now.

4. **Check the store cache before assuming a fetch re-ran.** `fundinfoStore.js`
   caches per key (`fundsByType[type]`, `topStocksByMarket[market]`, etc.) and
   de-dupes in-flight requests. If a page "isn't picking up" a backend change,
   confirm whether you're looking at cached state (same Pinia store instance,
   e.g. across SPA navigations in one browser session) before concluding the
   fix didn't work — a hard reload or `{ force: true }` re-fetch may be needed
   to actually observe new backend data.

5. **State which of the four categories it is, plainly:** route mismatch (our
   code, fixable now), infra outage (not our code, needs someone to restart
   something), backend data quality (may need a client-side guard, may need
   the backend team), or not actually a bug (e.g. a real large dataset with
   no loading indicator). Don't fix the wrong one.

## Quick reference: known-good vs. known-broken patterns in this repo

- `fundinfoApi.js`'s direct-mode calls all use `/api/v1/...` paths — this is
  the currently-correct backend contract.
- `fundApi.js` and `insightsApi.js` (as of this writing) still call paths
  *without* `/api/v1` and 404 — a known, still-open route mismatch. Don't
  assume they've been fixed without re-checking (step 3).
- Auth (`authApi.js`) goes through a separate ngrok tunnel
  (`VITE_PROXY_FUND_BACKEND`) that is infra someone else owns — check it's up
  with a plain `curl` to the tunnel root before debugging `authApi.js` itself.
