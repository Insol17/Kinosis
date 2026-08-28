# KINOSIS 0.4.5.6

## Scope

0.4.5.6 consolidates every product/UI request made after 0.4.5.4. It focuses on authored Arthouse programmes, stable Library/Profile surfaces, richer film detail media, factual KOBIS ranking, and a cleaner card/navigation system.

## Programme authoring

- Director Archive is now explicitly selected by the admin. Runtime/full-filmography auto population is no longer the source of truth.
- Editorial Curation requires a curator explanation for every selected film.
- `그럼에도 삶은 계속된다` now contains, in order: Taste of Cherry, Eureka, The Hunt, Manchester by the Sea, Leviathan, Perfect Days.
- Studio movie search shows poster, original title, year and director.
- Studio can choose a representative movie and directly pick a Hero image from that movie's backdrop/stills or enter a TMDB image URL.
- Published programme movie summaries are hydrated at build time when `TMDB_READ_ACCESS_TOKEN` is available, so Arthouse does not need a Detail visit before images appear.
- Curation and Director Archive can both be saved into a user's personal Collection.

## Discover / rails / cards

- Discover Hero is movie-only. Editorial Curation is promoted as a full-width inline programme banner between discovery sections.
- KOBIS box-office is treated as factual ranking; rank #1 is never removed by Hero dedupe.
- Rail arrows hide at the beginning/end and react to scrolling/resizing.
- Movie cards show the user's own rating (`내 ★ x.x`) or `감상함` when applicable.
- OTT logos/badges were removed from movie cards. Provider information remains on provider-centric surfaces such as Detail.
- WATCHA uses a compact W mark rather than the long wordmark.

## Library / Profile

- Removed the oversized Library manifesto/header block.
- Shelf and Watchlist now share a stable-height compact header to prevent vertical jumping when switching.
- Profile was rebuilt around compact identity, record counters and a small last-viewed row; the random large movie-cover header is gone.
- Existing cinematic calendar behavior from 0.4.5.4 is retained.

## Detail media

- Added lazy, independently loaded TMDB trailer/still media via `/api/movie-media`.
- YouTube trailers use the privacy-enhanced `youtube-nocookie.com` embed and do not block base Detail.
- Up to eight stills are shown in a responsive gallery.

## Visual identity

- Arthouse keeps the same KINOSIS typography/components but receives a stronger cinema/archive surface: emulsion grain, fine scratches, frame inset, perforation cues and more deliberate film framing.
- Replaced the old abstract K icon with a K inside a film-frame/sprocket mark; favicon and touch icon were regenerated.

## Reliability / architecture

- Programme snapshots are seeded before Curation/Archive rendering.
- Studio draft movie rows retain compact movie snapshots so dynamic programmes can render without a second metadata round trip.
- Removed retired automatic Director sync controls and dead movie-card provider badge generation.
- CSP now explicitly permits privacy-enhanced YouTube trailer frames.
