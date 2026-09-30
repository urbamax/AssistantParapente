# Feature Specification: Weather Labels of a Ground Handling Session

**Feature Branch**: `fix/ground-handling-weather-labels`

**Created**: 2026-09-30

**Status**: Implemented

**Input**: Owner report (screenshot of a « GONFLAGE » card): « Décollage et atterrissage en gonflage… ? ». The weather block of every logbook card labels its two rows « Décollage » and « Atterrissage », which makes no sense for a ground handling session.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Meaningful weather labels (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a ground handling session with weather, **When** its card is shown, **Then** the rows read « Début » and « Fin », never « Décollage » or « Atterrissage ».
2. **Given** a flight with weather, **When** its card is shown, **Then** the rows still read « Décollage » and « Atterrissage ».

## Requirements *(mandatory)*

- **FR-001**: Weather row labels MUST depend on the session type; stored weather data is unchanged.

## Success Criteria *(mandatory)*

- **SC-001**: A unit test fails without the fix and passes with it.
