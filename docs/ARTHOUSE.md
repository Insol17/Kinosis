# ARTHOUSE — 0.4.4.1

ARTHOUSE is the permanent KINOSIS destination for auteur, canon, historical and independent-cinema exploration. It uses the same visual grammar as Discover; the difference is editorial selection, not a second theme.

## Default order

1. Featured carousel
2. 최신 공개작
3. 높은 평가를 받은 영화
4. Curation
5. Curation
6. Curation
7. Curation

The deterministic classifier is a candidate engine only. The visible Arthouse pool respects the configured threshold (`isArt`); a film with merely a weak positive score is not admitted automatically.

## Performance rule

The Arthouse landing never resolves director filmographies in the background. Git-authored Curation cards render immediately from their definition. A director-source Curation calls `/api/director-filmography` only when the user opens that Curation.

This makes network cost proportional to actual editorial exploration rather than the number of Curation files in the repository.
