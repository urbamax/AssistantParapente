# Feature Specification: User Manual Catch-Up

**Feature Branch**: `docs/053-manual-catch-up`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "Bring the in-app user manual (« Mode d'emploi ») back in line with the app. It has not been substantively updated since 2026-11-07 while many features shipped since. Audit every manual section (public and beta/owner-gated) against the current app and fix what is missing, wrong or outdated. Public changes must be mirrored in the Discord guide (#guide-utilisation). The manual is for all users, so a French update notice for #mises-a-jour is drafted."

## Context

The « Mode d'emploi » is the only user documentation inside the app. It has ten tabs: À propos,
Général, Sites de vol (owner), Calcul Volabilité (beta), Carnet de Vol, Matériel & Usure,
Sécurité, QCM, Bibliothèque, Statistiques. Its last real content update was on 2026-11-07. A
first read of every tab against the features merged since then (2026-11-21) found these gaps:

**Missing entirely**

| Topic | Where it belongs | Shipped in |
|---|---|---|
| Fiche ICE (emergency contacts, medical information, helmet sticker, optional online copy with consent on each device) | Sécurité: the manual lists 3 tabs, the screen has 4 | ICE work, PRs 180, 305, 307 |
| Feedback form (report a bug, suggest an improvement) from the footer | Général | Spec 048 |
| Community Discord server (header button, footer link) | Général | Spec 051 |
| Installing the app on the home screen (one-click button; guided steps on iPhone/iPad) | Général | Spec 051 |
| Acronym tooltips in quiz explanations, each with a library source | QCM | PRs 251, 252, 309 |
| Flights follow the current name of their FFVL site after a rename | Carnet de Vol | PR 263 |
| Official FFVL texts (statuts, chartes, qualifications, accident declaration), public safety and weather texts, the reserve-parachute guide | Bibliothèque | PRs 253, 260, 262 |

**Outdated or wrong**

| Manual says | App does now | Shipped in |
|---|---|---|
| « un message vous le signale pour que vous puissiez recharger la page » | Update is mandatory: a full-screen overlay with a single « Mettre à jour » button blocks the app until reload | PR 278 |
| Statistics: tiles let you « filtrer la liste ou lancer directement une série de Perfectionnement » | Tiles and themes can be checked together (faceted: each group updates the other's counts); « S'entraîner sur ces N questions » starts a series on exactly the listed questions, which ends on « Retour aux statistiques » with filters cleared | PRs 316, 317, 319 |
| Revision axes classified as « Point bloquant, À rafraîchir, À découvrir, Maîtrisé » | Mastered chapters, the « Maîtrisés » filter and mastered questions in the key points are hidden; empty filter buttons are hidden | PR 289 |
| Safety: « donnant accès à ses trois rubriques » | Four tabs: Urgence, Check-lists, Ma SIGR, Fiche ICE | ICE work |

**To verify in the app** (described, but possibly out of date): equipment screen (inactive
filter, status colours), revision due by calendar day (PR 315), forecast hour in the site's
time zone (owner, PR 313), voice reading timings (PR 311), local backup and export/import,
multi-IGC import, FFVL logbook import, detailed logbook PDF, automatic flight classification,
the « Sites de vol » and « Calcul Volabilité » tabs for beta/owner.

This list is a starting point. The audit in this feature covers every paragraph, not only the
rows above.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A pilot finds every feature they can use described in the manual (Priority: P1)

A pilot opens « Mode d'emploi » to find out how something works (the ICE sheet, the feedback
form, installing the app). Today several features they can see on screen are not in the
manual. After this feature, every feature visible to their role is described in the tab where
they would look for it.

**Why this priority**: the manual is the only help inside the app; a missing feature is a
feature the pilot may never find.

**Independent Test**: for each row of the "Missing entirely" table, open the manual as a
signed-out user (or with the role that sees the feature) and find the description in the
expected tab.

**Acceptance Scenarios**:

1. **Given** a signed-out user, **When** they open Sécurité in the manual, **Then** it lists four tabs, including Fiche ICE, and explains that the sheet stays on the device unless they agree on that device to an online copy.
2. **Given** any user, **When** they open Général, **Then** they find how to install the app (one-click button, and the steps on iPhone/iPad), how to send feedback, and how to join the Discord server.
3. **Given** any user, **When** they open QCM, **Then** they learn that acronyms in explanations can be tapped to see their meaning and the library page it comes from.

---

### User Story 2 - A pilot is never misled by an outdated description (Priority: P1)

A pilot follows the manual and the app behaves differently (no "close" button on the update
message, statistics filters that combine, no « Maîtrisé » axes). After this feature, no
sentence in the manual contradicts the current app.

**Why this priority**: a wrong instruction is worse than a missing one; it costs trust in the
whole manual (Principle I).

**Independent Test**: for each row of the "Outdated or wrong" table, compare the manual's
wording with the app and confirm they match.

**Acceptance Scenarios**:

1. **Given** a new version is available, **When** the user reads the manual's « Hors ligne et mises à jour » part, **Then** it says the update is required and is applied with the « Mettre à jour » button.
2. **Given** the statistics tab of the manual, **When** a user reads it, **Then** it explains combining mastery tiles and themes, « S'entraîner sur ces N questions » and the return to statistics.
3. **Given** the revision axes paragraph, **When** a user reads it, **Then** it no longer mentions a « Maîtrisé » class and says mastered chapters are hidden.

---

### User Story 3 - Each role sees the manual that matches its app (Priority: P2)

Some features are limited to `beta` or `owner` (calculated weather, flying sites). The manual
already hides those parts from other users. Updates must keep that split: a signed-out user
never reads about a feature they cannot use, and a beta or owner user sees their extra parts
up to date too.

**Why this priority**: describing hidden features to everyone would confuse users and reveal
unreleased work; leaving the gated parts stale would mislead testers.

**Independent Test**: view the manual as signed-out, beta and owner; check each sees only the
parts for its role, and that the gated parts were audited like the public ones.

**Acceptance Scenarios**:

1. **Given** a signed-out user, **When** they read every tab, **Then** no paragraph mentions calculated weather, flyability scores or the flying-sites screen.
2. **Given** an owner, **When** they read Sites de vol, **Then** the description matches the current screen (including the forecast hour shown in the site's time zone).

---

### User Story 4 - The community sees the same manual on Discord and hears about the update (Priority: P3)

Pilots on the community Discord server read the manual in `#guide-utilisation` and follow
`#mises-a-jour`. After this feature, the Discord guide matches the public manual, and a short
notice tells pilots the manual was refreshed.

**Why this priority**: it reaches pilots outside the app, but depends on the in-app manual
being right first.

**Independent Test**: compare each public manual tab with the matching Discord guide card;
check the notice text exists and was approved by the owner before posting.

**Acceptance Scenarios**:

1. **Given** the updated public manual is deployed, **When** the owner approves, **Then** `#guide-utilisation` is republished with the same content as the public manual.
2. **Given** the deployment, **When** the owner approves the text, **Then** the notice is posted to `#mises-a-jour`, and nowhere else.

### Edge Cases

- A feature is visible to beta but not to everyone: its description goes only in a beta-gated block, never in the public text or the Discord guide.
- A tab gains or loses a sub-part (Sécurité gains Fiche ICE): the manual's own wording that counts tabs (« trois rubriques ») must change with it.
- A behaviour differs between devices (installing on iPhone vs Android/desktop; keyboard shortcuts only on a computer): the manual says which device each instruction is for.
- The manual mentions a feature that no longer exists: the sentence is removed, not left as history.
- The Discord guide has a length limit per card: a long manual part is shortened there, never changed in meaning.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every paragraph of every manual tab (public and role-gated) MUST be checked against the current app, and the result of that check MUST be recorded (kept, corrected, added or removed).
- **FR-002**: The manual MUST describe every feature in the "Missing entirely" table, in the tab listed there, and for the roles that can use it.
- **FR-003**: The manual MUST correct every statement in the "Outdated or wrong" table so it matches the app.
- **FR-004**: The manual MUST NOT contain any statement that contradicts the app's current behaviour for the reader's role.
- **FR-005**: Parts describing features limited to `beta` or `owner` MUST stay visible only to those roles; public text MUST NOT mention them.
- **FR-006**: The Sécurité tab MUST state that the ICE sheet holds health data, stays on the device by default, and is copied online only after the pilot's consent on each device, and that the online copy can be deleted at any time.
- **FR-007**: Descriptions MUST use the labels shown on screen (button and tab names) so a reader can find them.
- **FR-008**: All new or changed manual text MUST be in French and kept with the other manual strings (centralised strings module), as for the rest of the manual.
- **FR-009**: Every change to a public part of the manual MUST be mirrored in the Discord guide (`#guide-utilisation`), without role-gated content; the channel is republished after deployment, only with the owner's approval.
- **FR-010**: A French update notice MUST be drafted for `#mises-a-jour` and posted only after deployment and the owner's approval of its text.
- **FR-011**: The manual MUST remain usable offline, readable in light and dark themes, and operable with a keyboard, as today.

### Key Entities

- **Manual part**: a heading or paragraph of a manual tab, with the role that may see it (everyone, beta, owner) and its audit result.
- **Discord guide card**: the Discord copy of one public manual tab.
- **Update notice**: the short French text announcing the refreshed manual.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the manual's parts carry an audit result (kept, corrected, added or removed).
- **SC-002**: All 7 "Missing entirely" topics and all 4 "Outdated or wrong" statements are resolved.
- **SC-003**: For a signed-out user, 0 manual sentences mention calculated weather, flyability or the flying-sites screen.
- **SC-004**: A pilot looking for any of the 7 missing topics finds it in the expected tab in under 1 minute.
- **SC-005**: Every public manual tab has a matching Discord guide card with the same meaning.

## User Manual Impact *(mandatory)*

- **Sections checked**: all ten tabs (À propos, Général, Sites de vol, Calcul Volabilité, Carnet de Vol, Matériel & Usure, Sécurité, QCM, Bibliothèque, Statistiques); first pass recorded in the Context tables above.
- **Updates required**: this feature is the manual update itself; see FR-002 and FR-003.
- **Outdated content found nearby**: listed in the "To verify in the app" paragraph.
- **Discord guide (`#guide-utilisation`)**: every public tab that changes (at least Général, Carnet de Vol, Sécurité, QCM, Bibliothèque, Statistiques) is mirrored there.

## Release Announcement *(mandatory)*

- **Availability**: All users (the public manual); the beta/owner parts change only for those roles.
- **Discord notice (French, for pilots)**: « 📖 Le mode d'emploi est à jour ! On y trouve maintenant la fiche ICE et l'étiquette casque, l'installation de l'application en un clic, le formulaire « Signaler un problème / Suggestion », les filtres combinés des statistiques avec « S'entraîner sur ces N questions », les sigles expliqués dans le QCM et les nouveaux textes officiels de la bibliothèque. Retrouvez-le dans l'application (bouton Manuel) ou dans #guide-utilisation. » (final text; posted to #mises-a-jour only after deployment and the owner's approval)

## Assumptions

- The app on `main` at 2026-11-21 is the reference; features still on open branches (flight envelope, owner usage report) are out of scope and will update the manual through their own specs.
- The manual keeps its current ten tabs; new public topics go in an existing tab (Général for installing, feedback and Discord) rather than a new tab.
- The manual's look and navigation do not change; only its text and, where needed, its headings.
- The Discord guide and the notice are published with the owner's local tooling, which stays outside the repository; this feature only changes what they publish.
- Quiz question content and explanations are out of scope (they follow the quiz audit process).
