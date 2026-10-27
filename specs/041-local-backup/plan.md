# Implementation Plan: Local Backup Without an Account

**Branch**: `feat/local-backup-no-account` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

## Summary

Move export / import out of `FirebaseAuthEngine` into a cloud-free service
(`js/services/backup_service.js`: build, validate, apply) and a small UI module
(`js/core/backup_ui.js`: file picker, confirmation, status line, reload, signed-in sync). Add the
buttons to a block of the "Espace Synchro" dialog that is always visible and to the privacy options.

## Technical Context

JavaScript ES modules, Vitest (happy-dom), Playwright. No dependency added. Same file layout as before.

## Constitution Check

| Principle | Status |
|-----------|--------|
| GDPR consent | Pass: the file never leaves the device; the cloud is touched only by a signed-in pilot, as before |
| UX and data integrity | Pass: validation before any write, confirmation, atomic rejection of damaged files |
| Test-first | Pass: unit tests for the service and UI flow, e2e on both browsers |
| Security | Pass: JSON.parse only, type checks, roles never restored, size limit |

No violation.

## Project Structure

```text
js/services/backup_service.js   # new: buildBackup / parseBackup / applyBackup / exportBackup
js/core/backup_ui.js            # new: export and import actions
js/core/main.js                 # events exportBackup, importBackupFile
js/services/firebase_service.js # exportAllData / importAllData removed
index.html, css/auth.css        # backup block (auth dialog, privacy options), hidden file input
js/i18n/fr.js, fr_html.js       # texts
tests/services/backup_service.test.js, tests/core/backup_ui.test.js, tests/e2e/local_backup.spec.js
```
