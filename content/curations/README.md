# KINOSIS Curations — content as code

Curation은 관리자 계정이나 Supabase 편집 화면을 사용하지 않습니다.
Git 저장소의 파일이 곧 편집 데이터입니다.

## 폴더 = 노출 위치

- `discover/*.curation.json` → DISCOVER에 노출
- `arthouse/*.curation.json` → ARTHOUSE에 노출
- `both/*.curation.json` → 두 화면에 노출

파일을 추가하고 push하면 Netlify build가 `data/curations.js`를 자동 생성합니다.
브라우저는 폴더를 직접 열람하지 않으므로, 이 build index 단계가 필요합니다.

## 가장 작은 예시

```json
{
  "title": "Director's Archive",
  "subtitle": "Abbas Kiarostami",
  "description": "키아로스타미의 영화들을 한 흐름으로 다시 봅니다.",
  "movies": [12345, 67890, 13579]
}
```

파일명 예시:

`content/curations/arthouse/kiarostami.curation.json`

파일명에서 `kiarostami`가 URL slug가 됩니다.

## 옵션

```json
{
  "eyebrow": "DIRECTOR'S ARCHIVE",
  "title": "Abbas Kiarostami",
  "subtitle": "길, 얼굴, 그리고 영화",
  "description": "...",
  "credit": "Curated by KINOSIS",
  "priority": 20,
  "heroMovieId": 12345,
  "movies": [
    12345,
    { "tmdbId": 67890, "note": "기획전 메모" }
  ]
}
```

- `priority`: 숫자가 작을수록 먼저 표시됩니다.
- `heroMovieId`: 기획전 대표 backdrop. 생략하면 첫 영화 사용.
- `enabled: false` 또는 `status: "draft"`: build 결과에서 제외됩니다.
- `movies`: TMDB movie id. KINOSIS의 영화 URL `?movie=12345`에서 id를 그대로 사용할 수 있습니다.

## 왜 `.cs`가 아닌 `.json`인가

KINOSIS는 정적 웹/JavaScript 앱이라 C# 파일은 브라우저나 Netlify build에서 별도 컴파일러 없이 실행되지 않습니다.
큐레이션은 로직이 아니라 콘텐츠이므로 JSON으로 두는 편이 안전하고 diff도 명확합니다.

## 로컬 확인

```bash
npm run build
npm test
```

`npm run build`는 `content/curations`를 검사하고 다음 파일을 만듭니다.

- `data/curations.json`
- `data/curations.js`

## GitHub Pages / build 없는 정적 호스팅

Netlify는 build command를 실행하지만 GitHub Pages에 정적 파일만 올리는 경우에는 자동 index 생성이 없습니다. 그 경우 push 전에 `npm run build`를 실행하고 생성된 `data/curations.json` / `data/curations.js`도 함께 커밋하세요.

## 한글 파일명을 쓰고 싶다면

파일명은 한글이어도 됩니다. 다만 공유 URL을 안정적으로 유지하려면 JSON 안에 영문 `slug`를 지정하세요.

예:

`content/curations/arthouse/키아로스타미.curation.json`

```json
{
  "slug": "kiarostami",
  "title": "Director's Archive",
  "subtitle": "Abbas Kiarostami",
  "movies": [12345, 67890]
}
```
