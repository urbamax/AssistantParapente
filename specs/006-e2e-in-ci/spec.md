# Feature Specification: End-to-End and Script Tests in CI

**Feature Branch**: `ci/e2e-tests`

**Created**: 2026-09-29

**Status**: Draft

**Input**: Constitution audit gap B4. Principle IV requires end-to-end tests to pass before any merge, but CI only runs lint, format, typecheck, unit tests and build; the Playwright suite (14 scenarios today, on Chromium and WebKit) and the Python tests of the data-repair helper only run on a developer machine.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every pull request runs every test (Priority: P1)

The owner opening or reviewing a pull request sees, in its checks, the result of the end-to-end tests on both browsers and of the Python script tests, without relying on anyone's local run.

**Independent Test**: open a pull request: a check runs the end-to-end suite on Chromium and WebKit and the Python tests; a failing scenario makes the check fail and its report is downloadable.

**Acceptance Scenarios**:

1. **Given** a pull request to `main`, **When** CI runs, **Then** a check runs all end-to-end scenarios on Chromium and WebKit.
2. **Given** a failing scenario, **When** CI finishes, **Then** the check fails and the Playwright report is available as a downloadable artifact.
3. **Given** the Python script tests, **When** CI runs, **Then** they run and a failure fails the check.

## Requirements *(mandatory)*

- **FR-001**: CI MUST run the full end-to-end suite on Chromium and WebKit for every pull request to `main` and every push to `main`.
- **FR-002**: CI MUST run `python3 -m unittest discover -s tests/scripts`.
- **FR-003**: On an end-to-end failure, CI MUST publish the Playwright HTML report as an artifact.
- **FR-004**: The existing checks (lint, format, typecheck, unit tests, build) MUST be unchanged.

## Success Criteria *(mandatory)*

- **SC-001**: The pull request of this feature shows the new end-to-end check passing on both browsers.

## Assumptions

- The end-to-end tests need no network: Open-Meteo, geocoding and Firebase are mocked or bypassed; the service worker is blocked in the scenarios that mock the network.
- The existing Playwright CI settings (1 worker, 2 retries, `forbidOnly`) are kept; retries hide flaky tests, so a scenario that only passes on retry is reported as « flaky » in the report and must be fixed separately.
