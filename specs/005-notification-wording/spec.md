# Feature Specification: Honest Favourite-Site Notification

**Feature Branch**: `fix/notification-wording`

**Created**: 2026-09-29

**Status**: Draft

**Input**: Constitution audit gap A3. The push notification sent when a favourite site's conditions become favourable reads « {site} est volable ! » / « Vent 15 km/h (S), conditions favorables maintenant. »: a verdict phrased as a go-ahead, with no source, no time and no reminder that the pilot decides and must check on site. Spec 001 made sure it is never sent from incomplete data or for unknown orientations; this spec fixes what it says.

**Related**: Constitution v1.0.0 — Principle II (the app gives an opinion, never authorises a flight; reminder wherever a verdict is shown); spec 001 (US4), spec 002 (model labels).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A notification that informs, not authorises (Priority: P1)

A pilot receives a notification about a favourite site. It says that the forecast announces favourable conditions for that site and hour, names the forecast source, gives the wind, and reminds that the decision is theirs and must be checked on site.

**Why this priority**: a notification reaches the pilot outside the app, without any other context; « est volable ! » reads as permission to fly.

**Independent Test**: build the notification for a flyable outcome and check the title and body against the rules below.

**Acceptance Scenarios**:

1. **Given** a favourite site becoming favourable, **When** the notification is built, **Then** the title is « {site} : conditions favorables annoncées » and never contains « est volable ».
2. **Given** the same, **When** the body is built, **Then** it contains the forecast hour in French local time, the wind (direction, speed, gusts), the forecast source, and the reminder « Avis basé sur des prévisions : la décision vous appartient, vérifiez sur place. ».
3. **Given** a site without a name, **When** the notification is built, **Then** « Site favori » is used.

### Edge Cases

- Missing wind values cannot happen (spec 001 never notifies from incomplete data); the builder still shows « — » rather than `null`.
- The server runs in UTC: the hour shown is in Europe/Paris time.

## Requirements *(mandatory)*

- **FR-001**: The notification MUST NOT present the site as « volable » or conditions as certain; it MUST say that the forecast announces favourable conditions.
- **FR-002**: The body MUST include the forecast hour (Europe/Paris), wind direction, speed and gusts, and the forecast source.
- **FR-003**: The body MUST end with the reminder that the decision belongs to the pilot and must be checked on site.
- **FR-004**: Texts MUST live in the French strings catalogue shared with the app.

## Success Criteria *(mandatory)*

- **SC-001**: 100 % of notifications built in automated checks satisfy FR-001 to FR-003.

## Assumptions

- The notification keeps using Open-Meteo's automatic multi-model selection (label « Sélection automatique (Open-Meteo, multi-modèles) »); using the pilot's chosen model is a separate improvement.
- Push notifications stay limited by the platform's text length; the body stays under ~240 characters.
