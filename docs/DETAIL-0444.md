# Film Detail — 0.4.4.4

## Information hierarchy

```text
Back / Share

Backdrop
Poster | Title / original title / year / genres / country / runtime | My rating
       | Director                                                | TMDB ref
       | Log / Watchlist / More

Main                                            Side
Synopsis                                        Where to Watch
Cast portraits                                  My viewing history
Credits / facts
Related films
```

The hierarchy intentionally starts from established film-service patterns rather than inventing a novel dashboard. The distinctive KINOSIS layer is personal viewing history, KR theatrical/OTT context, Arthouse programming and a restrained Korean-first editorial visual system.

## Action hierarchy

Visible primary actions:
- 감상 기록
- 보고싶어요
- 더보기

Secondary actions under 더보기:
- 좋아요
- 컬렉션에 추가

There is no separate `+ Library` action. Library membership is a result of having a relationship with a film.

## Availability

`상영 중` requires current evidence (KOBIS/catalog current-theatrical or TMDB KR now-playing). A merely recent theatrical release is labeled `최근 극장 개봉` rather than falsely claiming current exhibition.

Provider variants are consolidated before rendering. Provider rows are information; the single external availability CTA uses the watch-provider source link.
