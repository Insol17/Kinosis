# ART MODE v1

## Product definition

ART MODE is a **Discover lens**, not a light/dark theme and not a claim that art can be measured objectively.

It asks: “Does this film have sufficiently strong signals to belong in a cinephile / auteur / independent / film-history discovery surface?”

Search is never restricted by ART MODE, and Library never hides non-art films. Library only gains an optional `Art Cinema` filter.

## Why no embedding/LLM in 0.4.1

A semantic vector model would require one of:

- paid/limited embedding API calls
- a hosted inference model
- precomputed embeddings for a large film corpus

That introduces cost, latency, opaque errors and a second data pipeline before the product has validated the feature.

Instead 0.4.1 builds a **feature vector** from known metadata and resolves it with deterministic weights. It is cheap, explainable and testable. The interface already exposes a boolean result, so the engine can later be swapped for an embedding classifier without changing the UX contract.

## Inputs

- canon title seeds
- auteur/director seeds
- TMDB keywords
- production/distribution signals
- year/classic signal
- updater-provided curated `artSeed`
- future manual include/exclude override

## Output

Internal:

```text
score -> threshold -> boolean isArt
```

Visible:

```text
ART MODE
- 작가 중심 감독 시드
- 독립·실험·영화제 메타데이터
```

The numeric score is intentionally not shown to users.

## Seed reference

One reference is Jung Sung-il's KMDb article `[시네필 안내서]100편의 영화` (2016). It is used as a canon/curation seed concept, not as a dataset to scrape or reproduce verbatim.
