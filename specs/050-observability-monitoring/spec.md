# Feature Specification: Observability & Health Monitoring (Spec 050)

**Feature Branch**: `feat/observability-monitoring`  
**Created**: 2026-11-20  
**Status**: In Progress  
**Extends**: `specs/048-feedback-modal/spec.md`  

## Problem

After deploying the self-hosted Discord relay microservice (`deploy/feedback_server/server.py`), the operator has no automated way to:
1. Probe whether the microservice and Raspberry Pi are healthy via an external uptime monitor (HTTP GET health check).
2. Receive notifications when unexpected runtime JavaScript errors or unhandled promise rejections occur on pilot devices in production.
3. Receive a startup confirmation on Discord when the service starts up on boot.

## Solution Architecture

1. **HTTP GET Health Check (`deploy/feedback_server/server.py`)**:
   - `GET /api/health` and `GET /api/feedback` return HTTP 200 with JSON:
     ```json
     {
       "status": "healthy",
       "service": "Assistant Parapente Backend",
       "version": "1.0.0",
       "uptime_seconds": 1234,
       "uptime": "20m 34s",
       "timestamp": "2026-11-20T13:10:00Z"
     }
     ```
   - Works immediately with the existing Cloudflare Tunnel route (`^/api/feedback*`).

2. **Startup Notification to Discord**:
   - On server initialization, if `DISCORD_WEBHOOK_URL` is set, a discreet green embed is sent to Discord:
     `🟢 Assistant Parapente Backend démarré (PID ..., Port ...)`

3. **Client-Side Crash Telemetry (`js/services/crash_reporter.js`)**:
   - Listens to unhandled errors and promise rejections.
   - Filters out third-party extension errors (`chrome-extension://`, etc.) and transient offline network failures.
   - Deduplicates identical error signatures so that recurring loops only fire once per session (max 5 per session).
   - Transmits non-blocking JSON beacon via `navigator.sendBeacon` or `fetch(..., { keepalive: true })`.
   - Contains zero personal data, zero GPS coordinates, and zero flight logs: only error details, stack, app version, and screen name.

4. **Server-Side Crash Embed Formatter**:
   - Categorized as `crash` (Color: `0xDC2626` Red, Emoji: `🚨`).
   - Displays error name, location (`file:line:col`), stack trace formatted inside a Markdown code block, and technical context.
   - Stores locally in `logs/crashes/{timestamp}_{hash}.json`.

## Success Criteria

- Python unit tests in `tests/scripts/test_feedback_server.py` pass.
- Frontend unit tests in `tests/services/crash_reporter.test.js` pass.
- Pre-push verification (`scripts/verify.sh`) passes with 0 errors.
