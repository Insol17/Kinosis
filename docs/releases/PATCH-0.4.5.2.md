# KINOSIS 0.4.5.2 Patch Notes

0.4.5.2 is a consolidation pass. It does not add the previously discussed Editorial Studio. The release instead closes the product-rule, navigation, Arthouse data and portfolio-demo problems accumulated through 0.4.5.1.

## 1. What makes a film part of `내 영화장`

The UI no longer asks users to understand `LibraryMembership` as a prerequisite for normal film activity.

```text
보고싶어요만 함
→ 보고싶어요에만 존재

평점 / 현재 한줄평 / 좋아요 / 새 감상 / 컬렉션 추가
→ 현재 내 영화장에 자동 귀속
```

A user can still manually save a film without another action from the Detail overflow menu. Removing a film from the shelf removes membership only; personal rating, comment, viewing history, watchlist, favorite and Collections remain intact.

The v8 migration promotes existing engaged films once. It does not continually rebuild membership during normalization, so a later intentional shelf removal survives reload and Cloud normalization.

## 2. Current opinion vs historical viewing

`FilmRelationship` and `ViewingEvent` now stay separate in the input flow as well as in the schema.

- Current rating and one-line comment are edited from the Detail relationship surface.
- A new viewing stores `ratingSnapshot` + viewing note and may update the current rating.
- Editing an old viewing starts from that event's snapshot and never rewrites the current rating/comment.
- Editing old history also does not automatically re-add a film that the user later removed from the current shelf.

## 3. Arthouse is a programme surface

Removed:

- `최근 공개된 작가영화`
- `다시 볼 만한 작품`

The second label was especially incorrect because its source did not inspect the user's viewing history.

Arthouse now consists of authored Editorial Curations and Director Archives. The Hero allocates one representative slot per programme instead of slicing the front of a heuristic movie pool.

### Director Archive reliability

Each Director Archive now has:

- stable TMDB person identity,
- a static movie snapshot shipped with the build,
- live refresh as enrichment rather than a prerequisite.

The loader tracks `idle / loading / ready / empty / error`, retains snapshots on failure and exposes retry. Network failure is not treated as a real empty filmography.

Director filmography records also carry `director`/`directorId`, removing the large-Hero `감독 정보 없음` failure mode.

## 4. Discover breadth

Discover Hero is deliberately mixed across available source types, with one Editorial curation slot when available. A shared visible allocation policy then removes immediate duplicates from Box Office, Upcoming, subscription and high-rated rails.

High-rated ordering uses a confidence-weighted score rather than raw TMDB average, reducing the chance that a tiny rating sample outranks a broadly supported film solely on the displayed mean.

## 5. Search and navigation

- Search displays explicit loading state and skeletons.
- The main search option is a single interactive option; watchlist/log actions are siblings rather than nested buttons inside an option.
- Opening a film closes Search. Returning from Detail restores the previous query/results instead of resetting the task.
- PROFILE always opens the personal overview. The avatar is an account affordance and opens Profile / Settings / Logout (or demo exit) actions.

## 6. Profile / Library affordance fixes

- Profile count labels are explicit: `감상 영화 / 평가 / 한줄평 / 컬렉션`.
- Rating count opens the rating archive rather than the generic viewing timeline.
- Watchlist cards expose `보고싶어요에서 제거` directly.
- Favorite remains a visible Detail secondary action instead of being hidden only in overflow.
- Creating the first Collection from a film now creates the Collection with that film already inside it.

## 7. Portfolio demo

`KINOSIS 둘러보기` loads a seeded, session-only local profile with Library films, watchlist-only films, ratings, comments, Collections, viewing history and a populated current-month calendar.

It is not a shared Supabase account. Cloud read/write paths are disabled while demo mode is active, so one reviewer cannot corrupt the next reviewer's state.

## 8. Regression cleanup

- Removed the stale active Hero-dot background rule responsible for the large amber square.
- Removed unused status-pill CSS and dead watchlist filtering code.
- Generalized Movie Entity merge preservation for director/directorId/runtime and enriched array fields.
- Added Discovery hero/rail/weighted-ranking tests and expanded static/runtime contracts.

## Deliberately not included

- Physical Blu-ray / digital-purchase ownership tracking.
- Social feed/following.
- Editorial Studio/CMS.

Those features would widen product scope; 0.4.5.2 concentrates on making the existing Personal Film Library coherent and reliably demonstrable.
