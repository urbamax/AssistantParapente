# Tasks: Flight Auto-Classification

1. Extract the synthetic-flight builder of `igc_analysis.test.js` into `tests/helpers/synthetic_flight.js`.
2. Write failing tests for `classifyFlight` (rule table, boundaries, null analysis, end to end on synthetic traces and on the real winch fixture).
3. Implement `js/services/flight_classifier.js`.
4. Write failing view tests: a thermal trace imported in a new session pre-fills the type and explains why; a type chosen by the pilot is kept; an edited session keeps its type.
5. Use the classifier in `LogbookView._fillFormFromIgc`; add the French reasons.
6. Update the manual and the roadmap.
