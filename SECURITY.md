# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private reporting: **Security tab → "Report a vulnerability"** on this repository. I will acknowledge your report and keep you informed. This is a personal, unpaid project: there is no bug bounty.

## Scope

- The web application served from the project's own domain.
- The Firestore security rules (`firestore.rules`) and the scheduled Cloud Function (`functions/`).

Out of scope: third-party content and services (FFVL documents, Open-Meteo, map providers, Firebase itself), social engineering, denial-of-service, and automated scanning of production at volume.

## Please do not

- Access, modify or delete other people's data. The rules are tested to refuse it; if you find a way around them, stop and report it.
- Test against real accounts you do not own.

## Rights

The source code is **not** open source: all rights are reserved (see `LICENSE`). Looking for a vulnerability does not grant any right to copy, reuse or redistribute the code.
