# KINOSIS Curations

`content/curations/*.curation.json` 파일 하나가 ARTHOUSE의 기획전 하나입니다.

현재 편집 방식은 Git 기반입니다. 파일을 추가/수정하고 push하면 Netlify build가 정의를 검증하고 `data/curations.js`를 생성합니다.

감독 전작전은 `source.type = "director"`와 감독 이름만 지정하면 됩니다.

```json
{
  "slug": "kiarostami",
  "title": "그럼에도 삶은 계속된다: 키아로스타미 컬렉션",
  "source": {
    "type": "director",
    "name": "Abbas Kiarostami",
    "sort": "release_asc"
  }
}
```

중요: ARTHOUSE 홈에서는 감독 필모그래피 API를 미리 호출하지 않습니다. 사용자가 해당 기획전을 열 때 한 번만 `/api/director-filmography`로 TMDB 감독 크레딧을 해석합니다. 따라서 기획전 수가 늘어나도 홈 진입 시 네트워크 요청이 비례해서 늘지 않습니다.

특정 작품만 직접 편집하려면 `movies: [TMDB_ID, ...]` 형식도 지원합니다. 기획전 데이터에 영화 제목별 조건문을 넣는 방식은 사용하지 않습니다.
