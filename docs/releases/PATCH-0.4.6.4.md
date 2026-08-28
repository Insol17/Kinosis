# KINOSIS 0.4.6.4

## Arthouse correction

0.4.6.3 over-interpreted the Discover/Arthouse distinction and replaced the existing Arthouse carousel Hero with a static editorial masthead. This release restores the original interaction model: Arthouse opens on an auto-advancing authored Curation Hero.

The visual distinction now happens below and around that Hero rather than by changing the page's primary interaction. Arthouse uses slightly warmer/desaturated imagery, cleaner editorial spacing, wide Curation banners and compact portrait-first Director cards. Discover keeps the brighter, rounder product/discovery grammar.

## Removed ornament

- Removed the static “계보” masthead and archive-count block.
- Removed decorative `01 / CURATION` and `02 / DIRECTORS` side labels.
- Removed numeric indexes from the Arthouse Curation preview banners.
- Removed faux inner-frame / film-perforation decoration from the Arthouse Hero.
- Kept the shared KINOSIS typography and palette; no Arthouse-only font system is introduced.

## Preserved behavior

- Desktop ARTHOUSE hover submenu still routes to Curation and Director's Archive.
- Curation and Director full-index pages remain separate routed screens.
- Director overview density remains seven columns on wide desktop (35 preview cards / five rows).
- Discover's three-slide Curation spotlight and the works-first Collection/search flow are unchanged.

## Regression

`npm test` covers build, checkJs, generated data, Arthouse Hero allocation, Curation contracts, Library/Collection editing, search performance, architecture and runtime contracts.
