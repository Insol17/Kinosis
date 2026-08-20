# OTT provider identity — 0.4.4.3

## Rule

Provider availability comes from TMDB Watch Providers / JustWatch. Provider *identity* is normalized by KINOSIS so presentation is stable even when upstream tiers have separate provider rows.

`data/providers.js` is the editable provider registry. UI code must not contain provider-specific `if (name === ...)` branding rules.

## WATCHA

KINOSIS uses `assets/branding/providers/watcha-mark.svg`, sourced from the official WATCHA media kit. It is an compact W mark and is rendered with `object-fit: contain`.

The Watcha `logo_path` currently present in the imported provider data is intentionally ignored by the KINOSIS brand registry. This is a presentation override only; Watch Provider availability itself still comes from TMDB/JustWatch.

## Fallbacks

- Known provider + logo override: use override.
- Known/unknown provider with TMDB logo: use the returned TMDB logo.
- No usable image: render a small text mark rather than an opaque fake icon.
- Ad/subscription variants with the same canonical brand are consolidated in Where to Watch.
