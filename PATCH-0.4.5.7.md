# KINOSIS 0.4.5.7

## Watchlist becomes useful before it becomes large
- `보고싶어요` now opens a utility overview instead of immediately dumping the entire grid.
- Dynamic local slices: currently available on selected subscriptions, <=100 minute films, films waiting 6+ months, and recently saved films.
- Explicit `전체 보기` opens the exhaustive Watchlist grid; `요약 보기` returns to the utility surface.
- Personal schema v9 stores `watchlistedAt` separately from generic relationship updates so waiting-time views stay meaningful.

## Availability correctness
- A Korean theatrical release date is no longer treated as evidence that the film is still in theatres.
- Current theatrical badges require current evidence (`KOBIS` snapshot when available or TMDB KR now-playing), not a stale catalogue flag.
- Partial provider API failures no longer erase previously known OTT providers.
- A small timestamped KINOSIS verification layer can supplement gaps in TMDB/JustWatch. Eureka (2000, TMDB 38047) is corrected to WATCHA subscription + YouTube rent/buy and no current theatrical availability from the user-verified 2026-08-20 state.
- Provider source copy distinguishes KINOSIS-verified supplementation from pure JustWatch/TMDB data.

## Discover exploration
- The old poster-only subscription rail is replaced by a landscape `지금 바로 볼 수 있는 영화` strip using backdrops/stills and the user's selected subscriptions.
- A visual `장르로 둘러보기` surface adds Horror / Comedy / SF / Romance cards. Selecting one opens a weighted genre rail without pretending it is personalized AI recommendation.
- Movie cards remain free of OTT icons; availability belongs to dedicated viewing-availability surfaces.

## Maintenance
- WATCHA keeps the compact W mark; YouTube is recognized as a provider identity.
- Availability overrides are intentionally small, explicit and timestamped rather than becoming an unbounded shadow database.
