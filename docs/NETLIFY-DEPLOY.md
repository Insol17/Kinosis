# KINOSIS 0.4.0 — Netlify deployment

## Keep editing in GitHub

GitHub remains the source repository. Do not manually upload replacement builds to Netlify after each change.

```text
local files -> git push -> GitHub -> Netlify automatic deploy
```

## One-time Netlify setup

1. Import/connect the GitHub Kinosis repository.
2. Build command: leave empty.
3. Publish directory: `.`
4. The repository `netlify.toml` sets `netlify/functions` as the Functions directory.
5. Add environment variable:
   - Key: `TMDB_READ_ACCESS_TOKEN`
   - Secret: enabled
   - Value: your TMDB API Read Access Token
6. Trigger a new deploy after creating/changing the environment variable.

Do not put the token in this repository.

## Verify live search

After deployment, open:

```text
https://YOUR-SITE.netlify.app/api/movie-search?q=시민 케인
```

Expected: JSON with one or more movie results. Then search the same title from the KINOSIS UI.

## GitHub secret still matters

Keep `TMDB_READ_ACCESS_TOKEN` in **GitHub Actions Secrets** as well. It serves a different purpose:

- GitHub Secret → Thursday Discover catalog refresh
- Netlify Environment Variable → live user search/detail requests

## Updating KINOSIS

Replace/update files in the GitHub repository and push normally. Netlify detects the commit and deploys the website/functions together.

## Local tests

```bash
npm test
```

UI-only:

```text
open index.html
```

Full Netlify Function behavior:

```bash
npm run dev
```
