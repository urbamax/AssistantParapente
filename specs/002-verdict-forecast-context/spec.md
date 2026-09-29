# Feature Specification: Forecast Context Next to Every Verdict

**Feature Branch**: `feat/verdict-forecast-context`

**Created**: 2026-09-29

**Status**: Draft

## Clarifications

### Session 2026-09-29

- Q: Which sites get the second-model comparison? → A: Favourite sites plus the sites shown in the list within the chosen radius (FR-010).
- Q: When is a forecast "old"? → A: More than 3 hours after it was retrieved, in line with the AROME run cycle (FR-005).
- Owner input: the default search radius must be 50 km; the "Illimité" (unlimited) setting is useless and exceeds Open-Meteo's request limit on its own, so it is removed and the radius slider ends at 200 km (User Story 4, FR-014–FR-018).
- Owner input: without GPS or an address, the reference position is Boulogne-sur-Mer — the owner's home and the app's place of origin (FR-017).

**Input**: User description: "Show forecast context next to every flyability verdict (constitution audit gap A6, Principle II). Today a verdict (map marker and popup, site card in the list with its 120-hour timeline, favourites comparison table) does not say which weather model it comes from (AROME, ICON, GFS, ECMWF...), when that forecast was issued or fetched, or whether other models disagree. The model name only appears in the loading message, and model disagreement ("Fiable"/"Incertain") is only computed for favourite sites in the comparison table, for the current hour only, and currently compares the secondary model's current hour with the primary model's selected hour. Pilots need to judge how much to trust a verdict: every verdict must show the model it is based on and the age of the forecast (fetch time, and model run time if available), clearly flag stale forecasts (e.g. data served from cache or fetched long ago), and make model disagreement visible wherever a verdict is shown, for the same hour being displayed. This is an aid to the pilot's own analysis, not a decision."

**Related**: Constitution v1.0.0 — Principles I (User Experience and Data Integrity First) and II (Decision Support, Not Decision: "the age of a forecast MUST be shown explicitly, with the forecast timestamp"; "disagreement between weather models MUST be shown explicitly"); constitution audit 2026-09-29, gap A6; spec 001 (verdict states and reminder).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Know which model and how old (Priority: P1)

A pilot looking at a verdict on the map, in a site card or in the favourites comparison table sees, in the same place, which weather model the verdict comes from and how old the forecast is: when the app retrieved it and, when the provider says so, when the model run was computed.

**Why this priority**: without the source and age, a pilot cannot weigh a verdict against their own analysis; the constitution requires the forecast timestamp wherever a verdict is shown.

**Independent Test**: load forecasts with each available model and check that every verdict display names that model and shows the retrieval time (and run time when known).

**Acceptance Scenarios**:

1. **Given** forecasts loaded with the AROME model, **When** the pilot opens a map popup, a site card or the comparison table, **Then** each shows "AROME (Météo-France)" and the retrieval time (e.g. "récupérée à 14 h 05").
2. **Given** the provider reports when the model run was computed, **When** the pilot views a verdict, **Then** the run time is shown too (e.g. "run de 12 h").
3. **Given** the provider does not report a run time, **When** the pilot views a verdict, **Then** only the retrieval time is shown and nothing suggests a run time.
4. **Given** the pilot switches to another model, **When** new forecasts arrive, **Then** all displays show the new model name and the new retrieval time.
5. **Given** the model option whose data actually comes from the provider's automatic multi-model selection, **When** it is selected, **Then** its name in the model list and next to verdicts describes that source truthfully, not as another provider.

---

### User Story 2 - Stale forecasts are flagged (Priority: P1)

A pilot who left the app open, or who reopens it later, is clearly warned when the verdicts shown rely on a forecast retrieved long ago, and can refresh it.

**Why this priority**: a verdict computed from an old forecast looks exactly like a fresh one today; stale data presented as current violates Principle I.

**Independent Test**: simulate forecasts retrieved at different times and check the warning appears beyond the staleness threshold, on every verdict display, with a refresh action.

**Acceptance Scenarios**:

1. **Given** forecasts retrieved less than 3 hours ago, **When** the pilot views a verdict, **Then** no staleness warning is shown.
2. **Given** forecasts retrieved more than 3 hours ago, **When** the pilot views a verdict, **Then** a visible warning says the forecast is old, with its age, and offers a refresh action.
3. **Given** the pilot refreshes, **When** new forecasts arrive, **Then** the warning disappears and the retrieval time is updated.
4. **Given** a refresh is not possible (offline, provider limit reached), **When** the pilot tries, **Then** the warning stays and explains why the forecast could not be refreshed.

---

### User Story 3 - Model disagreement visible for the displayed hour (Priority: P2)

Wherever a verdict is shown for a site covered by the second-model comparison, the pilot sees whether a second, independent model agrees with the verdict for the same hour being displayed.

**Why this priority**: disagreement between models is one of the best signals of uncertainty; today it is hidden in the comparison table and compares the wrong hours.

**Independent Test**: provide two models that agree and disagree on chosen hours, move the forecast slider, and check the agreement shown always refers to the displayed hour.

**Acceptance Scenarios**:

1. **Given** both models give the same verdict for the displayed hour, **When** the pilot views the verdict, **Then** it shows that the second model agrees, naming it.
2. **Given** the models disagree for the displayed hour, **When** the pilot views the verdict, **Then** it shows a clear "models disagree" notice with the second model's verdict.
3. **Given** the pilot moves the forecast slider, **When** the displayed hour changes, **Then** the agreement shown is recomputed for that hour (never the current hour of one model against another hour of the other).
4. **Given** either model's forecast for that hour is incomplete or not loaded, **When** the pilot views the verdict, **Then** agreement is shown as unavailable, not as agreement.
5. **Given** a site not covered by the comparison, **When** the pilot views its verdict, **Then** nothing suggests the models were compared.

---

### User Story 4 - Weather is only requested for sites around the pilot (Priority: P1)

A pilot opening the sites screen gets weather for the sites within 50 km of their position by default, and can widen the radius up to 200 km. The app never requests weather for every site in the database at once, so it stays within the forecast provider's request limit and verdicts keep loading.

**Why this priority**: today the default radius is "unlimited", and without a known position the radius is ignored: the app requests weather for about 2 000 sites in one go, which alone exceeds the provider's hourly limit and leaves every verdict empty. Comparing two models (User Story 3) would double that load.

**Independent Test**: open the sites screen as a new user, with and without a position; count the sites whose weather is requested; move the radius slider to its maximum.

**Acceptance Scenarios**:

1. **Given** a new user with a known position, **When** the sites screen opens, **Then** the radius is 50 km and weather is requested only for sites within 50 km (plus favourites).
2. **Given** the radius slider, **When** the pilot moves it to its maximum, **Then** it stops at 200 km; no "Illimité" option exists.
3. **Given** no known position (no GPS, no address), **When** the sites screen opens, **Then** Boulogne-sur-Mer is used as the reference position: weather is requested for sites within 50 km of it (plus favourites), and a message states that the search is centred on Boulogne-sur-Mer and invites the pilot to enable GPS or enter an address.
4. **Given** a user whose saved preferences still hold the former "unlimited" value, **When** the app loads them, **Then** the radius becomes 50 km.
5. **Given** the pilot then enables GPS or enters an address, **When** the position is known, **Then** it replaces Boulogne-sur-Mer and the message disappears.

---

### Edge Cases

- Forecast served from the app's short-term cache: the retrieval time shown is the time of the original retrieval, not the time it was read from cache.
- Different sites retrieved at different times (batched requests, partial failures): each verdict shows its own retrieval time.
- Clock or time zone: times are shown in the pilot's local time, with the day when it is not today.
- The page stays open across midnight or for hours: the age and staleness update without a reload.
- Incomplete hours (spec 001): no verdict, so no agreement; model and age are still shown for the site.
- Both models are the same (primary equals the comparison model): agreement is not shown.
- Offline with no forecast at all: existing "no forecast" states are kept; nothing shows a fake time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every verdict display (map popup, site card, favourites comparison table) MUST show the name of the weather model the verdict comes from, in plain French (e.g. "AROME (Météo-France)").
- **FR-002**: Every verdict display MUST show when the forecast was retrieved by the app, in the pilot's local time.
- **FR-003**: When the provider reports the model run time, every verdict display MUST show it; when it does not, nothing MUST suggest a run time.
- **FR-004**: The retrieval time MUST be the time of the actual retrieval from the provider; reading from any cache MUST NOT refresh it.
- **FR-005**: A forecast retrieved more than 3 hours ago MUST be flagged as old on every verdict display, with its age and a refresh action.
- **FR-006**: If a refresh fails, the old forecast MAY remain visible but MUST stay flagged as old, with the reason the refresh failed.
- **FR-007**: The age and the staleness flag MUST update while the page stays open, without a reload.
- **FR-008**: Model names shown anywhere (model list, verdicts, loading messages) MUST describe the real source of the data; the option currently labelled "Meteoblue (Multi-modèle)" MUST be renamed to describe the provider's automatic multi-model selection, since it does not use Meteoblue.
- **FR-009**: Model agreement MUST be computed for the same hour as the displayed verdict, for both models.
- **FR-010**: Model agreement MUST be shown on every verdict display of sites covered by the comparison: favourite sites and the sites shown in the list within the chosen radius. Every displayed site is therefore covered; sites outside the radius are neither displayed nor requested.
- **FR-010a**: Extending the comparison MUST NOT make the app exceed the provider's request limits in normal use: second-model requests MUST be grouped, reuse recent results, and stop (showing agreement as unavailable) when the provider refuses requests.
- **FR-011**: When models disagree, the display MUST name the second model and show its verdict for that hour; the primary verdict itself MUST NOT be changed (the app informs, it does not decide).
- **FR-012**: When either model's hour is incomplete or not loaded, agreement MUST be shown as unavailable, never as agreement.
- **FR-014**: The default search radius MUST be 50 km.
- **FR-015**: The radius MUST range from 10 km to 200 km; the "Illimité" (unlimited) setting MUST be removed.
- **FR-016**: Weather MUST be requested only for sites within the radius of the pilot's position, plus favourite sites; never for the whole site database.
- **FR-017**: Without a known position (no GPS, no address), the reference position MUST be Boulogne-sur-Mer (town centre); distances, the radius filter and weather requests MUST use it, and the screen MUST state that the search is centred on Boulogne-sur-Mer and invite the pilot to enable GPS or enter an address. A known position always replaces it.
- **FR-018**: A saved radius above 200 km or equal to the former "unlimited" value MUST be replaced by 50 km when preferences are loaded (locally and from the cloud).
- **FR-013**: All new texts MUST follow the existing verdict reminder rules (spec 001) and live in the French strings catalogue.

### Key Entities

- **Forecast provenance**: for a batch of sites — model identifier and display name, retrieval time, model run time (optional).
- **Model agreement**: for one site and one hour — primary verdict, second-model verdict, and one of: agree, disagree, unavailable.
- **Staleness**: derived from retrieval time and the 3-hour threshold — fresh or old, with age.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % of verdict displays show the model name and the retrieval time (verified on every display type).
- **SC-002**: 0 displays show a run time when the provider did not report one.
- **SC-003**: For forecasts retrieved more than 3 hours ago, 100 % of verdict displays show the staleness warning with a working refresh action.
- **SC-004**: In automated checks moving through every hour of a 48-hour window, 100 % of agreement results compare the same hour for both models.
- **SC-005**: 0 cases where an incomplete or missing second-model hour is shown as agreement.
- **SC-006**: No model label names a provider that is not the actual data source (verified against the provider settings).
- **SC-008**: In automated checks, 0 page loads request weather for sites outside the radius (other than favourites), and no radius setting above 200 km is reachable.
- **SC-007**: A pilot can tell the source, age and model agreement of a verdict in under 5 seconds without opening another screen (checked by review of each display).

## Assumptions

- The second model used for the comparison stays the current one (GFS, or AROME when GFS is the primary model).
- Showing forecast context is informative only: verdicts, scores and colours from spec 001 are unchanged.
- Whether the provider exposes model run times, and how, is determined during planning; FR-003 already covers its absence.
- Making the last forecast available offline (audit gap B1) is a separate specification; this feature only labels what is shown.
- All user-facing text is in French and goes into the strings catalogue created by spec 001.
- The reset of saved "unlimited" radii to 50 km is a default chosen for the provider's request limit; the owner can change it at clarification time.
- The map, the list and the favourites table show the same sites: those within the radius, plus favourite sites wherever they are (favourites are always kept so the pilot never loses them when the radius shrinks).
