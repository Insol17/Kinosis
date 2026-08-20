# KINOSIS 0.4.5.8

## Availability provenance + Collectio verification

0.4.5.8 stops treating every TMDB/JustWatch watch-provider row as a confirmed, real-time playback claim.

- TMDB watch-provider rows are tagged `source: tmdb-justwatch` and `confidence: reported`.
- Detail pages split **confirmed availability** from **external DB / verification required** rows.
- Watchlist “available on my subscriptions” summaries only make a positive claim from verified rows.
- Discover can still surface unverified TMDB/JustWatch candidates, but labels them as candidates rather than “watch now”.
- Collectio is checked against its public official catalogue search. Exact title + year matches become `confidence: verified` / `source: collectio-official`.
- Collectio verification is cached and failure-tolerant; a timeout or markup change does not erase TMDB data or break the detail page.
- Existing KINOSIS manual corrections now explicitly upgrade duplicate stale aggregator rows instead of being discarded during deduplication.

This is an evidence-layer change, not a claim that every Korean OTT now exposes a first-party catalogue API. Providers without a reliable official feed remain reported/unverified until KINOSIS has a direct verifier or partner-grade source.
