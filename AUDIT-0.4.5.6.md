# KINOSIS 0.4.5.6 Final Audit

## Verified product contracts
- Discover Hero is movie-only; Editorial/Curation is promoted as an inline full-width banner between discovery sections.
- KOBIS box-office ordering is factual and rank #1 is never removed by hero/rail dedupe.
- Rail previous/next controls reflect real scroll bounds and disappear when no further movement is possible.
- Movie cards show personal rating/watched state and no longer show OTT/provider badges.
- WATCHA uses the compact W mark on provider-specific surfaces.
- Library oversized introductory block is removed; Shelf/Watchlist share a stable header footprint to avoid vertical jumps.
- Profile is compact and record-centric rather than using a large arbitrary movie backdrop.
- Director Archive membership is explicitly selected by the administrator; it no longer auto-publishes an entire filmography.
- Editorial Curation requires a curator note for every selected film, while Director Archive does not.
- “그럼에도 삶은 계속된다” uses the six agreed films in the agreed order: Taste of Cherry, Eureka, The Hunt, Manchester by the Sea, Leviathan, Perfect Days.
- Studio movie search presents poster, title, original title, year, and director.
- Studio can choose a programme Hero movie and explicitly choose a Hero image from the representative movie imagery.
- Published programme movie metadata can be enriched into build-time snapshots when TMDB_READ_ACCESS_TOKEN is available, removing the dependency on visiting Detail first.
- Curation and Director Archive can be saved into the user's personal Collections.
- Curation Detail uses film + curator-note presentation; Director Archive uses a simpler selected-film grid.
- Detail media adds lazy, non-blocking trailer and still-image sections.
- Arthouse keeps the same KINOSIS typography/components while adding a stronger film/archive surface layer rather than a separate design system.
- KINOSIS branding icon has been replaced with a cinema/film-frame based mark.
- KOBIS remains snapshot/ingest based, so browser refreshes do not directly consume KOBIS quota.

## Automated verification
- `npm test`: PASS in the working tree.
- Packaged ZIP is extracted into a clean verification directory and `npm test` is run again before handoff.
- `npm run test:browser`: SKIP in this execution environment because the installed Chromium policy blocks local HTTP test origins. Browser E2E is therefore not claimed as passed.

## Deployment-sensitive checks
- Netlify should expose `TMDB_READ_ACCESS_TOKEN` to Builds + Functions so selected programme film metadata and imagery are pre-enriched during deployment.
- `KOBIS_API_KEY` should remain a server/build secret; the public browser reads KINOSIS theatrical snapshots rather than KOBIS directly.
- Existing deployments should already have `supabase/006_kinosis_0454.sql` applied for the lightweight Studio listing schema introduced in 0.4.5.4. No new SQL migration is required solely for the 0.4.5.6 payload changes.

## Known technical debt
- `assets/js/app.js` remains a large orchestration module (~3.2k lines). The next safe extraction targets are Profile and Curation/Studio orchestration; this patch does not claim that debt is solved.
- Director Archive film lists are intentionally admin-selected editorial sets, not incomplete auto-fetch results.
- Final visual regression should be checked on the real Netlify deployment because local Chromium E2E is blocked in this environment.
