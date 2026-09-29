# Feature Specification: Honest Handling of Missing and Unknown Weather Data

**Feature Branch**: `fix/honest-missing-weather-data`

**Created**: 2026-09-29

**Status**: Draft

## Clarifications

### Session 2026-09-29

- Q: Thunderstorm risk — evaluate it, or stop claiming it? → A: Evaluate it for real (request the indicator, treat it as required data) and remind on every verdict that it is an estimate to confirm on site (FR-010, FR-010a, FR-010b).

**Input**: User description: "Honest handling of missing and unknown weather data (constitution audit gaps A1, A2, A5). Today the flyability scoring turns missing inputs into verdicts: a missing mean wind speed yields "flyable"; a missing gust becomes 0 km/h so the gust check always passes; missing precipitation becomes 0 mm; a missing wind speed becomes 0 km/h and is shown as "wind out of limits"; a missing direction is shown as "wrong orientation"; missing sunrise/sunset data is treated as daytime. Sites with no known take-off orientation are scored as perfectly oriented (100/100). The thunderstorm (CAPE) check exists in the scoring code but CAPE is never requested from the forecast provider, so storm risk is never evaluated. Pilots must never see a verdict built on missing or unknown data: the app must show clearly which information is unavailable, never present unknown data as the best case, and either actually evaluate thunderstorm risk or stop implying that it does. This covers the in-app scoring and the server-side copy of the logic used for notifications."

**Related**: Constitution v1.0.0 — Principles I (User Experience and Data Integrity First) and II (Decision Support, Not Decision); constitution audit 2026-09-29, gaps A1, A2, A5.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - No verdict from incomplete forecasts (Priority: P1)

A pilot looks at a site on the map, in the list or on its sheet for a given hour. For that hour, the forecast provider did not supply one or more values the app relies on (mean wind, gusts, wind direction, precipitation, daylight). Instead of a flyability verdict, the pilot sees that the forecast for that hour is incomplete, and which values are missing.

**Why this priority**: today a missing mean wind produces "flyable" and a missing gust is treated as calm air. A pilot can be told a site is flyable based on data that does not exist. This is the most direct safety risk found by the audit.

**Independent Test**: feed forecasts with each value missing in turn and check that no hour ever shows a flyable or unflyable verdict, that each shows an "incomplete forecast" state naming the missing values, and that a complete forecast still produces the same verdict as before.

**Acceptance Scenarios**:

1. **Given** an hour whose mean wind speed is missing, **When** the pilot views the site for that hour, **Then** no verdict is shown, the marker and list entry use a distinct "incomplete data" appearance (neither green, orange nor red), and the detail names "mean wind" as unavailable.
2. **Given** an hour whose gust value is missing, **When** the pilot views the site, **Then** no verdict is shown and "gusts" is named as unavailable; the gust limit is never considered satisfied.
3. **Given** an hour whose wind direction is missing, **When** the pilot views the site, **Then** the app does not show "wrong orientation" and names "wind direction" as unavailable.
4. **Given** an hour whose mean wind speed is missing, **When** the pilot views the site, **Then** the app does not show "wind out of limits".
5. **Given** an hour whose precipitation value is missing, **When** the pilot views the site, **Then** no verdict is shown and "precipitation" is named as unavailable.
6. **Given** a day for which sunrise and sunset times are missing, **When** the pilot views an hour of that day, **Then** the app does not assume daylight, shows no verdict and names "daylight hours" as unavailable.
7. **Given** a forecast where every value is present, **When** the pilot views the site, **Then** the verdict, score and reason are identical to today's behaviour.

---

### User Story 2 - Unknown take-off orientation is never shown as ideal (Priority: P1)

A pilot looks at a site for which the app does not know the take-off orientation(s). The app no longer gives it a perfect orientation score. It evaluates what it can (wind strength, gusts, rain, daylight) and states clearly that the orientation is unknown, so the pilot must check whether the wind direction suits the take-off.

**Why this priority**: today such sites get "Excellent (100/100)" in good wind, whatever the wind direction. Unknown data is presented as the best case, the opposite of what the constitution requires.

**Independent Test**: take a site without orientation data and complete forecasts with good wind from every direction; check that it is never rated "Excellent" on the basis of orientation, that the orientation is shown as unknown, and that sites with known orientations are unaffected.

**Acceptance Scenarios**:

1. **Given** a site without known orientation and a complete forecast within the pilot's wind limits, **When** the pilot views it, **Then** the app shows that the orientation is unknown and must be checked by the pilot, and does not show a numeric score or a quality rating ("Excellent", "Good", "Fair").
2. **Given** a site without known orientation, **When** conditions fail any other check (wind limits, gusts, rain, night), **Then** the app shows that failure as it does for any other site.
3. **Given** a site with known orientations, **When** the pilot views it, **Then** its behaviour is unchanged.

---

### User Story 3 - Thunderstorm risk is either evaluated or not claimed (Priority: P2)

A pilot relies on the verdict and assumes the app has considered thunderstorm risk, because the reasons it can display include "storm risk". Today that check never runs. After this change, the app actually evaluates thunderstorm risk from forecast data, and every verdict reminds the pilot that this indicator is only an estimate to be confirmed on site.

**Why this priority**: an implied but inactive safety check misleads pilots; it is less immediate than a false "flyable" on missing wind, hence P2.

**Independent Test**: feed forecasts with a storm indicator above, at and below the threshold, and with the storm indicator missing; check the verdict, the reason, the "incomplete" state and the presence of the estimate reminder.

**Acceptance Scenarios**:

1. **Given** an hour whose storm indicator is above the threshold, **When** the pilot views the site, **Then** the site is shown unflyable with the reason "thunderstorm risk".
2. **Given** an hour whose storm indicator is missing, **When** the pilot views the site, **Then** no verdict is shown and "thunderstorm risk" is named as unavailable (FR-002).
3. **Given** any verdict (flyable or unflyable), **When** the pilot views it, **Then** a reminder states that the thunderstorm risk indicator is an estimate from forecasts and must be confirmed on site.

---

### User Story 4 - Notifications never rely on missing or unknown data (Priority: P2)

A pilot who has enabled notifications for favourite sites is never notified that a site has become flyable when the underlying forecast is incomplete or the site's orientation is unknown.

**Why this priority**: notifications reach the pilot outside the app, without any context; a notification built on missing data is at least as misleading as an in-app verdict. The wording of notifications themselves (audit gap A3) is handled in a separate specification.

**Independent Test**: run the notification evaluation with incomplete forecasts and with sites without orientation; check that no "becomes flyable" notification is produced, while complete data still produces the same notifications as before.

**Acceptance Scenarios**:

1. **Given** a favourite site whose current forecast is missing any value used in the evaluation, **When** the periodic evaluation runs, **Then** no notification is sent and the site is not recorded as flyable.
2. **Given** a favourite site without known orientation, **When** the periodic evaluation runs, **Then** no "becomes flyable" notification is sent.
3. **Given** the same forecast and preferences, **When** the app and the notification evaluation both assess a site, **Then** they reach the same outcome (flyable, unflyable or incomplete).

---

### Edge Cases

- A forecast value is present but not a valid number (text, infinite or out of physical range, e.g. negative wind): treated as missing.
- Several values are missing at once: all of them are named, not only the first.
- Only some hours of a site's forecast window are incomplete (e.g. beyond a model's range): only those hours show "incomplete"; complete hours keep their verdict.
- Every hour of a site is incomplete: the site shows "no reliable forecast" instead of "no flyable slot".
- "Flyable hours" counts, best-slot summaries and the "hide unflyable sites" filter: incomplete hours count neither as flyable nor as unflyable.
- The "equipment" filter mode (wind range of the pilot's wings) with missing wind: incomplete, not "out of equipment limits".
- A site with an orientation value the app cannot interpret (unrecognised label): treated as unknown orientation.
- Offline or provider error for a whole site: existing error states are kept; this feature does not change them.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST treat a forecast value as missing when it is absent, empty, not a number, infinite, or physically impossible (negative wind speed or gust, negative precipitation, direction outside 0–360°).
- **FR-002**: For any hour where at least one value used by the flyability evaluation is missing (mean wind, gusts, wind direction when the site has known orientations, precipitation, daylight hours), the app MUST NOT produce a flyable or unflyable verdict, a score, or a quality rating for that hour.
- **FR-003**: Such an hour MUST be shown in a distinct "incomplete forecast" state, visually different from flyable, marginal, unflyable and loading states on the map (marker and popup), on the site's card in the list (weather block, 120-hour timeline and expanded details) and in the favourites comparison table.
- **FR-004**: The "incomplete forecast" state MUST name every missing value in plain French (e.g. "rafales indisponibles").
- **FR-005**: A missing value MUST NEVER be replaced by a default (zero wind, zero gust, zero rain, daylight) in any evaluation.
- **FR-006**: The app MUST NOT show a reason that depends on a missing value ("wind out of limits", "wrong orientation", "gusts out of limits", "rain", "night") when that value is missing.
- **FR-007**: For a site without known or interpretable take-off orientation, the app MUST NOT award an orientation score, MUST NOT show a numeric score or quality rating, and MUST state that the orientation is unknown and must be checked by the pilot. All other checks still apply and can still make the site unflyable.
- **FR-008**: Incomplete hours MUST be excluded from flyable-hour counts, best-slot summaries and consecutive-hour counts, and MUST NOT be counted as unflyable.
- **FR-009**: When all hours of a site's forecast window are incomplete, the app MUST show that no reliable forecast is available rather than "no flyable slot".
- **FR-010**: The app MUST obtain a storm-related indicator from the forecast provider for every evaluated hour and MUST evaluate thunderstorm risk with it; an hour above the threshold is unflyable with the reason "thunderstorm risk". The storm indicator is one of the values covered by FR-002: when it is missing, the hour is incomplete.
- **FR-010a**: The thunderstorm threshold MUST be documented together with its source. If no admissible source (constitution Principle III) supports the current value, this MUST be reported to the project owner before implementation, and the chosen value recorded with the reason.
- **FR-010b**: Every verdict (flyable or unflyable) MUST remind the pilot that the thunderstorm risk indicator is an estimate derived from forecasts and must be confirmed on site.
- **FR-011**: The server-side evaluation used for favourite-site notifications MUST apply FR-001 to FR-010 identically and MUST NOT send a "becomes flyable" notification based on an incomplete forecast or a site with unknown orientation.
- **FR-012**: For identical forecast data and preferences, the in-app evaluation and the notification evaluation MUST produce the same outcome (flyable, unflyable or incomplete).
- **FR-013**: When all forecast values are present and the site's orientation is known, verdicts, scores and reasons MUST remain identical to the current behaviour (no regression).

### Key Entities

- **Hourly forecast**: the values for one site and one hour — mean wind, gusts, wind direction, precipitation, daylight status, and storm indicator. Each value is either present and valid, or missing.
- **Evaluation outcome**: for one site and one hour, exactly one of: flyable (with score and rating), unflyable (with reason), incomplete (with the list of missing values). A site with unknown orientation adds an "orientation unknown" notice and has no score.
- **Site orientation**: the set of wind directions suitable for a take-off; either known or unknown.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In automated checks covering every combination of one or more missing values, 0 % of hours with missing data produce a flyable or unflyable verdict.
- **SC-002**: 100 % of incomplete hours name all of their missing values.
- **SC-003**: 0 sites without known orientation are shown with a score or an "Excellent/Good/Fair" rating.
- **SC-004**: For complete forecasts on sites with known orientations, 100 % of existing verdicts, scores and reasons are unchanged (verified against the current test suite and a reference set of forecasts).
- **SC-005**: 0 "becomes flyable" notifications are produced from incomplete data or for sites with unknown orientation in automated checks.
- **SC-006**: In a check on a sample of real forecasts, the app and the notification evaluation agree on 100 % of site-hour outcomes.
- **SC-007**: In automated checks, 100 % of hours above the thunderstorm threshold are unflyable with the reason "thunderstorm risk", and 100 % of hours with a missing storm indicator are incomplete.
- **SC-008**: 100 % of verdict displays (map popup and legend, site card in the list, favourites comparison table) carry the thunderstorm estimate reminder (verified by review).

## Assumptions

- Values the app relies on today are mean wind, gusts, wind direction, precipitation and daylight; this feature does not add new criteria (thermals, cloud base, etc.) beyond activating the existing thunderstorm check (FR-010).
- The notification wording and the decision to keep or disable notifications are out of scope (audit gap A3, separate specification); this feature only guarantees that notifications never rely on missing or unknown data.
- Showing the forecast model, forecast time and model disagreement next to verdicts (audit gaps A4, A6) is out of scope and handled separately.
- Sites without orientation are about as frequent as in the current site database; no data-cleaning of the site database is part of this feature.
- The "hide unflyable sites" filter keeps hiding sites with no flyable slot; a site whose hours are all incomplete therefore stays hidden when the filter is on, which is acceptable because it offers no verdict either.
- All user-facing text is in French, grouped in a central place per the constitution's Language constraint.
