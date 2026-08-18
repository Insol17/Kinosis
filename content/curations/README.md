# KINOSIS Curations

`content/curations/*.curation.json` 파일 하나가 ARTHOUSE의 기획전 하나입니다.

감독 전작전은 `source.type = "director"`와 감독 이름만 적으면 Netlify의 TMDB 프록시가 해당 감독의 **모든 movie directing credits**를 자동으로 불러옵니다. 새 작품이 TMDB 필모그래피에 추가되면 별도 ID 수정 없이 반영됩니다.

```json
{
  "slug": "kiarostami",
  "title": "그럼에도 삶은 계속된다: 키아로스타미 컬렉션",
  "source": { "type": "director", "name": "Abbas Kiarostami", "sort": "release_asc" }
}
```

특정 작품만 직접 편집하고 싶으면 `movies: [TMDB_ID, ...]` 형식도 계속 지원합니다.
