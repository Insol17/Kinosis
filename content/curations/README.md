# KINOSIS Curations

`content/curations/*.curation.json` 파일 하나가 ARTHOUSE의 기획전 하나입니다. 현재 편집 방식은 Git 기반이며 push 시 Netlify build가 정의를 검증하고 `data/curations.js`를 생성합니다.

## 감독 기반 Curation

```json
{
  "slug": "kiarostami",
  "title": "그럼에도 삶은 계속된다: 키아로스타미 컬렉션",
  "source": {
    "type": "director",
    "name": "Abbas Kiarostami",
    "sort": "release_asc",
    "mode": "all-directed"
  }
}
```

가능하면 동명이인 위험이 있는 감독은 `personId`를 canonical key로 추가할 수 있습니다.

```json
"source": {
  "type": "director",
  "personId": 12345,
  "name": "Director Name",
  "mode": "all-directed",
  "include": [111],
  "exclude": [222]
}
```

`mode`:
- `all-directed` — TMDB movie credits에서 해당 인물이 Director인 고유 영화 전체.
- `solo-features` — 60분 이상이면서 해당 인물이 유일한 Director인 장편만. 빅토르 에리세 컬렉션이 이 모드를 사용합니다.

동일 영화는 TMDB id와 정규화된 원제/연도 기준으로 중복 제거됩니다. `include`/`exclude`는 자동 필모그래피에 대한 편집자 override이며 앱 코드에 영화 제목별 조건문을 넣을 필요가 없습니다.

중요: ARTHOUSE 홈에서는 감독 필모그래피 API를 미리 호출하지 않습니다. 사용자가 기획전을 열 때 한 번만 해석하고 캐시합니다.

## 직접 선택 Curation

특정 작품만 직접 편집하려면 `movies: [TMDB_ID, ...]` 형식을 사용합니다. 배열 순서가 기획전 순서입니다.
