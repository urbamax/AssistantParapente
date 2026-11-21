# Data Model: User Manual Catch-Up

No stored data changes. The entities below describe the work.

## Manual part

A heading, paragraph or list item of a manual tab.

| Field | Description |
|---|---|
| tab | One of `about`, `dashboard` (Général), `sites`, `scoring`, `logbook`, `equipment`, `safety`, `qcm`, `library`, `stats` |
| key | Its `manualModal.*` catalogue key |
| role | `all`, `beta` (`data-requires-role="beta"`), `owner`, or `not-beta` (`data-hidden-with-role="beta"`) |
| text | French text, identical in the HTML and the catalogue |

Rules: a part about a beta/owner feature never has role `all`; a part with two variants has one
`beta` and one `not-beta` entry with the same meaning apart from the gated feature.

## Audit record (`audit.md`)

| Field | Description |
|---|---|
| tab, key, role | The manual part |
| result | `kept`, `corrected`, `added` or `removed` |
| evidence | What it was checked against: screen label, PR number, or code path |

Rule: every manual part on `main` before the change, and every added part, has one record (SC-001).

## Discord guide card

The Discord copy of one or more public tabs (`#guide-utilisation`, owner's local tooling).

| Field | Description |
|---|---|
| title | e.g. « 4. Sécurité » |
| source tabs | Public manual tabs it summarises |
| text | Shorter French text, same meaning, no role-gated content |

## Update notice

| Field | Description |
|---|---|
| channel | `#mises-a-jour` only |
| text | French, for pilots (draft in the spec) |
| state | `draft` → `approved` (by the owner) → `posted` (after deployment) |
