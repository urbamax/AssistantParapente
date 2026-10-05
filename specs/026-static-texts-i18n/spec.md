# Feature Specification: Static HTML Texts Keyed to the Strings Catalogue

**Feature Branch**: `feat/static-texts-i18n`

**Created**: 2026-10-02

**Status**: Implemented

**Input**: Constitution audit gap C8, last part: the fixed texts of `index.html`, `components/header.html` and `components/footer.html` (menus, forms, setup screens, legal pages, dialogs). Owner's choice among three options: keep the text in the HTML and add a catalogue key to each element (no empty screen, no change for the pilot).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Nothing changes for the pilot (Priority: P1)

The HTML keeps its French text; only `data-i18n*` attributes are added (579 keys, attributes only, no line moved).

**Independent Test**: applying the French catalogue to `index.html` leaves every visible text unchanged; unit and e2e tests pass.

### User Story 2 - Every fixed text is translatable from one place (Priority: P1)

**Independent Test**: `tests/views/static_texts.test.js` fails when a text or a readable attribute (`placeholder`, `title`, `aria-label`, `alt`) has no key, or when the HTML text differs from the catalogue.

## Requirements *(mandatory)*

- **FR-001**: Each element whose own text contains words MUST carry `data-i18n` (its text, child elements such as icons kept) or sit inside an element carrying `data-i18n-html` (text mixed with links or bold, 45 cases).
- **FR-002**: Each readable attribute MUST carry `data-i18n-<attribute>`.
- **FR-003**: The HTML text MUST be identical (whitespace-normalised) to `FR.html` in `js/i18n/fr.js`.
- **FR-004**: `applyStaticTexts(root, lookup)` (`js/utils/i18n_dom.js`) MUST be able to apply another language later; it is tested but not wired (French needs nothing at run time).

## Edge Cases

- Scripts, styles, inline SVG, `<title>` and `<template>` are not texts to key.
- Keys are generated once (`<section>.<first words>`); a new text needs a key added by hand, the test says which.

## Success Criteria *(mandatory)*

- **SC-001**: 0 fixed text or readable attribute without a key in the three HTML files.
- **SC-002**: 579 / 579 keyed texts identical to the catalogue.
- **SC-003**: All tests pass; the test fails on a deliberately added unkeyed text (checked).
