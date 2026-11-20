# TrumpVIX — Demo Snapshot

**This is a static, read-only demo snapshot of [TrumpVIX](https://github.com/JonPinto/trumpvix).**

It is **not** the live application. Every post, market figure and reaction shown here was
baked in when this snapshot was generated, and nothing on this site updates. There is no
server, database or API behind it. For the full app — with a live database that refreshes —
see the main repository:

**https://github.com/JonPinto/trumpvix**

| | |
|---|---|
| App version | `v1.2` |
| Snapshot version | `20.11.26` |
| Data up to date as of | 20 Nov 2026, 08:43 UTC |
| Generated | 2026-11-20T08:43:03+00:00 |

## Disclaimer

This site is a static snapshot. The data was fetched once, from the same sources the live
app uses — the trumpstruth.org RSS feed, Yahoo Finance (via `yfinance`), FRED, OpenGraph
link previews and Wikimedia Commons — and frozen at the timestamp above. It does not
refresh, and no server or API runs behind this page.

Market data comes from Yahoo Finance via `yfinance` and from FRED. Yahoo data is
unofficial, may be delayed, and can be revised or missing. FRED data is subject to
revision. Nothing here is financial advice.

Wikimedia Commons photos are credited in the page; licences vary by image. Post media is
linked from its original source and may expire.

## What this repository contains

```
index.html      The dashboard, with a demo banner at the top
static/         Stylesheet and logo
snapshot.js     The baked data (window.__SNAPSHOT__)
demo.js         Fetch shim that answers /api/* from snapshot.js
netlify.toml    Static publish config (no build step)
```

This repository is generated. The source of truth, and the export script that produced it,
live in the main [TrumpVIX](https://github.com/JonPinto/trumpvix) repository
(`scripts/export_demo.py`).

## Deployment

Netlify is configured for a static publish from the repository root (`netlify.toml`), with
no build command. Connect this repository in Netlify and it will deploy as-is.
