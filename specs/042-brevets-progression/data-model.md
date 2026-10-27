# Data Model: Pilot Certifications (Brevets) & Progression Tracking

## 1. Certification Codes

```js
export const BREVET_CODES = ['BI', 'BP', 'BPC', 'TREUIL'];
export const PROGRESSION_CHAIN = ['BI', 'BP', 'BPC'];
```

- `BI`: Brevet Initial (FFVL N3)
- `BP`: Brevet de Pilote (FFVL N4)
- `BPC`: Brevet de Pilote Confirmé (FFVL N5)
- `TREUIL`: Qualification Treuil (independent qualification)

## 2. `USER_PREFS.brevets` Schema (`parapente_user_prefs`)

Stored under the `brevets` key inside the JSON object at `StorageService.KEYS.USER_PREFS`:

```json
{
  "brevets": {
    "BI": {
      "theory": {
        "passed": true,
        "date": "2026-10-15",
        "score": 28,
        "total": 30,
        "percentage": 93,
        "school": "Cumulus Parapente",
        "examiner": "Jean Dupont",
        "notes": ""
      },
      "practical": {
        "validated": true,
        "date": "2026-10-26",
        "school": "Cumulus Parapente",
        "instructor": "Jean Dupont",
        "notes": "Stage autonomie validé"
      },
      "updatedAt": "2026-10-26T18:30:00.000Z"
    }
  }
}
```

### Normalization Rules (`normalizeBrevetEntry`)

- `theory.passed`: `Boolean(raw?.theory?.passed)`
- `theory.date`: `'YYYY-MM-DD'` or `''`
- `theory.score`: finite non-negative number or `null`
- `theory.total`: finite positive number (`> 0`) or `null`
- `theory.percentage`:
  - If `score !== null && total !== null && total > 0`: `Math.min(100, Math.max(0, Math.round((score / total) * 100)))`
  - Else if `raw?.theory?.percentage` is a finite number: `Math.min(100, Math.max(0, Math.round(Number(raw.theory.percentage))))`
  - Else: `null`
- `practical.validated`: `Boolean(raw?.practical?.validated)`
- `practical.date`: `'YYYY-MM-DD'` or `''`

## 3. Session Entry Extension (`parapente_logbook`)

Each session object in `parapente_logbook` gains an optional string property:

- `brevetPrepare`: `'' | 'BI' | 'BP' | 'BPC' | 'TREUIL'`
- Only populated when the session is a school session (`Boolean(ecole?.trim())`). Cleared to `''` if `ecole` is empty.

## 4. Progression Rules

- **`getPracticalPilotLevel(brevets)`**:
  - Checks `['BPC', 'BP', 'BI']` in descending order; returns the first code where `brevets[code]?.practical?.validated === true`.
  - Returns `null` if none is validated (allowing callers like `SitesView` to fall back to `GlobalState.get('level')`).
- **`isTheoryValidated(code, brevets)`**:
  - Returns `Boolean(brevets[code]?.theory?.passed || brevets[code]?.practical?.validated)`.
- **`getTargetTheoryLevel(brevets)`**:
  - Walks `['BI', 'BP', 'BPC']` in ascending order; returns the first code where `!isTheoryValidated(code, brevets)`.
  - If all three are validated, returns `'BPC'`.
- **`getTargetSchoolBrevet(brevets, sessionDateStr)`**:
  - Extracts `'YYYY-MM-DD'` from `sessionDateStr`.
  - Walks `['BI', 'BP', 'BPC']`:
    - If `!entry.practical.validated`, returns that code.
    - If `entry.practical.validated && entry.practical.date && dateOnly <= entry.practical.date`, returns that code (session took place on or before the validation date of that brevet).
  - Returns `'BPC'` if all are validated before `dateOnly`.
