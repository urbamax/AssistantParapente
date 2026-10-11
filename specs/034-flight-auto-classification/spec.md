# Feature Specification: Flight Auto-Classification from the IGC Trace

**Feature Branch**: `feat/flight-auto-classification`
**Status**: Draft
**Related**: Constitution v1.0.0 — Principle I (data is never invented or silently replaced), II (uncertainty stays visible), VIII (logic in a service).

## Problem

The type of a flight (Plouf, Thermique, Soaring, Restit, Cross, Treuil) is chosen by hand, although
the IGC analysis already knows whether the pilot circled in thermals, how far they went and whether
they were towed. Only the winch launch is recognised today.

## User Story

When the pilot imports an IGC trace into a new session, the flight type is pre-filled from the trace
and the line under the form says why. The pilot can always change it, and a type they chose is never
overwritten.

## Rules (first match wins)

| Type | Rule |
|---|---|
| Treuil | A winch tow is detected at take-off (existing detection). |
| Cross | At least one thermal gaining 50 m or more **and** a free distance of 15 km or more. |
| Thermique | At least one thermal gaining 50 m or more. |
| Soaring | No such thermal, a flight of 10 min or more, and an average vertical speed of -0.6 m/s or better (the pilot stays up without circling: ridge soaring). |
| Plouf | Anything else with a usable analysis: a direct descent. |

- **Restit** (school flight shown to the instructor) cannot be read from a trace: it is never suggested.
- With no usable analysis (trace too short) nothing is suggested and the field is left alone.
- The thresholds are heuristics gathered in one exported constant, so they can be tuned in one place.

## Requirements

- **FR-1**: Classification is a pure function of the analysis and the duration (`js/services/flight_classifier.js`).
- **FR-2**: Import only suggests for a new session whose type was not touched by the pilot.
- **FR-3**: The learned-fields line names the reason ("thermiques repérés dans la trace", …).
- **FR-4**: Editing an existing session and "Recalculer depuis la trace" keep the type, except the
  existing winch rule (unchanged), so a deliberate choice is never replaced.
- **FR-5**: "Tout recalculer" does not touch the type (unchanged).

## Out of Scope

- Learning the thresholds from the pilot's own flights.
- Re-classifying past sessions in bulk.
