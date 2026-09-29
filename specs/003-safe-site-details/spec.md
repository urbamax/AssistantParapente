# Feature Specification: Safe and Faithful Site Details

**Feature Branch**: `fix/escape-site-details`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Constitution audit gaps A7 and C6. Site details (dangers, restrictions, observations, access, rescue access, regulation, etc.) and the site's FFVL link are inserted into the page as raw HTML. The data comes from the FFVL snapshot and community data. Some entries contain intended formatting (links, bold, line breaks), some contain a literal « < » that the browser swallows, so part of the safety text disappears (e.g. SORGIA « <Les terrains concédés… », MATHAY « <<corniches calcaires du Doubs>> »). 246 text fields also contain characters broken by a wrong encoding (apostrophes, quotes, bullets, dashes, « œ », « € »). Quiz questions and explanations are also inserted as raw HTML although they contain no markup. Pilots must see the full, correct text of every site detail, and no data may be able to inject code into the page."

**Related**: Constitution v1.0.0 — Principles I (data shown faithfully to its source), VI (no raw `innerHTML` with unescaped external data; external links with `rel="noopener noreferrer"`); constitution audit 2026-09-29, gaps A7 and C6.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The full safety text of every site is visible (Priority: P1)

A pilot opens the details of a site. Every sentence of the dangers, restrictions, observations and other details is shown in full, including passages that contain « < » or « << … >> », with the intended line breaks, bold text and links still working.

**Why this priority**: today part of the safety text silently disappears on some sites (e.g. the lease conditions on SORGIA, the protected nesting area on MATHAY). A pilot can miss a restriction without knowing it.

**Independent Test**: open the sites listed in the Edge Cases and compare the displayed text with the source data, character for character.

**Acceptance Scenarios**:

1. **Given** a detail containing « <Les terrains concédés … », **When** the pilot opens the site, **Then** the passage is shown in full, with the « < » character visible.
2. **Given** a detail containing « <<corniches calcaires du Doubs>> », **When** the pilot opens the site, **Then** the text « <<corniches calcaires du Doubs>> » is visible.
3. **Given** a detail with intended line breaks, bold text or links to a website, **When** the pilot opens the site, **Then** line breaks and bold are kept, and links are clickable and open in a new tab.
4. **Given** any other site, **When** the pilot opens it, **Then** its details look exactly as before.

---

### User Story 2 - No site or quiz data can inject code (Priority: P1)

Whatever the content of the site database or of the quiz files (including future imports of community data), nothing in them can run a script, load an unexpected resource or open a link to a dangerous address.

**Why this priority**: the constitution forbids inserting unescaped external data; community data (ParaglidingEarth) may be imported later and is not controlled.

**Independent Test**: inject malicious values (script tags, event attributes, `javascript:` links, images with handlers) into site details, the site's FFVL link and quiz texts, and check nothing runs and the text is shown as text.

**Acceptance Scenarios**:

1. **Given** a site detail containing a script, an event attribute or an image, **When** the pilot opens the site, **Then** nothing runs and the markup is shown as plain text.
2. **Given** a link in a detail or as the site's FFVL link whose address is not `http(s)`, **When** it is displayed, **Then** it is not clickable.
3. **Given** a kept link, **When** it is displayed, **Then** it opens in a new tab without giving the target page access to the app.
4. **Given** a quiz question, answer or explanation containing « < », **When** it is displayed, **Then** it is shown as text.

---

### User Story 3 - Broken characters are repaired (Priority: P2)

Apostrophes, quotes, bullets, dashes, « œ », « … » and « € » broken by a wrong encoding in the site database are shown correctly, and a future refresh of the site data does not bring them back.

**Why this priority**: 246 fields are affected; the text stays mostly readable, so it is less urgent than lost text, but it degrades every affected site.

**Independent Test**: after the repair, no text field of the site database contains the broken characters; re-running the data import on a sample with broken characters produces repaired text.

**Acceptance Scenarios**:

1. **Given** a detail containing a broken apostrophe, **When** the pilot opens the site, **Then** a proper apostrophe (’) is shown.
2. **Given** the site data is refreshed by the import scripts, **When** the source contains broken characters, **Then** the stored text is repaired.

---

### Edge Cases

- Known entries to verify: COL DES LIMOUCHES (bold), MATHAY (« << … >> »), NOTRE-DAME-DE-LA-MER (2 sites: links, line breaks, broken characters), SORGIA (« <Les … »).
- A « < » not followed by a letter (e.g. « < 25 km/h »): shown as text.
- Unknown or malformed markup (unclosed tag, unknown tag, attributes other than the link address): shown as text, never interpreted.
- A link whose address is relative, `javascript:`, `data:` or malformed: its text is kept, but it is not a link.
- An empty detail after cleaning: hidden like any empty detail today.
- The site's own FFVL link (« Fiche FFVL » button) with a non-`http(s)` address: no button.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Site details MUST be shown in full: no character of the source text may disappear.
- **FR-002**: The only formatting kept from site data MUST be line breaks, bold text and links to `http` or `https` addresses; any other markup MUST be shown as plain text.
- **FR-003**: Kept links MUST open in a new tab with `rel="noopener noreferrer"`.
- **FR-004**: The site's FFVL link and any other address taken from site data MUST be used only if it is an `http(s)` address; otherwise no link is shown.
- **FR-005**: No value from the site database or the quiz files may be inserted into the page as code: quiz questions, answers and explanations MUST be shown as plain text.
- **FR-006**: Characters broken by a Windows-1252 encoding error (€, …, ‘, ’, “, ”, •, –, —, œ) MUST be repaired in the site database.
- **FR-007**: The site import scripts MUST repair the same characters, so that a refresh does not reintroduce them.
- **FR-008**: Sites without markup or broken characters MUST look exactly as before.

### Key Entities

- **Site detail**: a text field of a site (dangers, restrictions, observations, access, rescue access, ideal aerology, regulation, practicability, agreement, managing structure) — plain text with optional line breaks, bold and web links.
- **Site link**: the site's FFVL page address.
- **Quiz text**: question, answer choices, explanation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100 % of site details in the database, the displayed text (ignoring kept formatting) equals the source text.
- **SC-002**: In automated checks with at least 10 known attack patterns, 0 scripts run and 0 non-`http(s)` links are clickable.
- **SC-003**: After the repair, 0 text fields of the site database contain broken Windows-1252 characters.
- **SC-004**: The 6 known damaged entries (Edge Cases) show their full text in the browser.

## Assumptions

- Keeping line breaks, bold and web links is preferred to showing everything as plain text, because the links point to site charters and prefectoral decrees pilots need.
- The broken characters come from a Windows-1252 encoding error in the source; the mapping of each character is the standard one.
- The repair of the site database is a one-time data change plus a fix in the import scripts; the additive import rule (hand-curated entries are never overwritten) is kept.
- Other places inserting data as HTML (logbook, library) are out of scope; they are covered by their own tests (`logbook_xss`) or by the audit backlog.
