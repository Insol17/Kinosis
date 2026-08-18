# ARTHOUSE — 0.4.4

ARTHOUSE is a permanent KINOSIS destination for cinema explored through auteur, canon, independent/film-festival and historical signals.

It is not a visual theme and it does not hide mainstream films from Search or Library.

## Candidate engine

The deterministic classifier uses signals such as:
- seeded/canonical titles
- auteur director list
- metadata keywords
- production/distribution signals
- classic-film signals

The weekly updater also resolves seeded directors to several actual directing credits so the Arthouse pool is not limited to the small general Discover cache.

## Current-theatre shelf

`지금 극장에서 만나는 Arthouse` ranks current KR theatrical titles by Arthouse affinity. The updater fetches multiple `now_playing` pages to improve coverage. Cards are fixed and smaller than Discover cards so two or three results never stretch into oversized posters.


## Editorial Curation

ARTHOUSE also accepts repository-authored Curation definitions from `content/curations/arthouse` and `content/curations/both`. These appear as a compact rail before algorithmic shelves. Curation membership is editorial and can intentionally override the classifier; the classifier is a candidate engine, not the final authority.
