# Tasks: Mobile Quiz Compact Layout

- [x] T001 Add unit test in `tests/views/quiz_voice.test.js` checking that voice action buttons are wrapped in `.qcm-voice-buttons` and that `.qcm-voice-link` is placed outside `.qcm-voice-buttons`
- [x] T002 Update `js/views/quiz_voice_ui.js` to group action buttons in `.qcm-voice-buttons` and place `.qcm-voice-link` below
- [x] T003 Update `css/quiz.css` desktop and mobile rules:
  - compact top margin for `.main-stage` on mobile
  - compact bottom margin for `.level-tag`
  - `.quiz-header-row` and `.quiz-meta` horizontal alignment side by side
  - `.qcm-voice-buttons` horizontal layout for action buttons
  - safe area clearance on `#qcm-screen.mode-screen`
- [x] T004 Run all unit tests, format, lint, typecheck, and ensure all pass
