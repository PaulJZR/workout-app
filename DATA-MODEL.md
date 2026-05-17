# Exercise Catalogue — Data Model

Each exercise is stored as a Firestore document in the `exercises` collection (document id = the `id` field below) and mirrored in `data/exercises.csv` which the API route reads at startup.

> **Note on data sources.** `app/admin/exercises/page.js` writes to Firestore. `app/api/generate-workout/route.js` reads `data/exercises.csv`. These are currently two separate stores; keeping them in sync is a manual step (re-export the CSV after admin changes). A future phase should make the generator read directly from Firestore.

---

## Field reference

| Field | Type | Allowed values | Edited in admin UI | Read by generator | Notes |
|---|---|---|---|---|---|
| `id` | string | kebab/underscore slug, unique | auto-generated on create, read-only after | yes (document key) | |
| `name` | string | free text | yes | yes (display) | |
| `primary_pattern` | string | see Patterns | yes | yes — `primaryPattern()` | Must be one of the exercise's own `patterns` |
| `patterns` | string[] | see Patterns | yes (multi-select) | yes — pattern matching | Pipe-separated in CSV |
| `required_equipment` | string | see Equipment | yes (select) | yes — `hasEquipment()` | Empty string = bodyweight/no equipment |
| `optional_equipment` | string[] | see Equipment | yes (multi-select) | no | Reserved — not yet consulted by generator |
| `difficulty` | integer 1–5 | 1 Beginner … 5 Elite | yes | yes — `scoreExercise()` | Matched against user effort |
| `measure` | string | `reps`, `seconds` | yes (select) | yes — `formatPrescription()`, `estimateMoveSeconds()` | |
| `rep_unit` | string | see Rep units | yes (select) | yes — `formatPrescription()`, `scaleEmomRoundToBudget()`, `pickEmomPrescription()` | |
| `time_per_unit_seconds` | number | positive float | yes (number input) | yes — EMOM budgeting, `estimateMoveSeconds()`, `amrapPacingSuggestion()` | Seconds per rep; used to estimate round duration |
| `rep_low` | integer | ≥ 0 | yes | yes — `pickRepTarget()` | Lower bound of rep range |
| `rep_high` | integer | ≥ rep_low | yes | yes — `pickRepTarget()` | Upper bound of rep range |
| `unilateral` | boolean | true / false | yes (toggle) | no | Reserved — not yet consulted by generator |
| `transition_cost` | integer 1–3 | 1 easy … 3 awkward | yes (number input) | yes — `scoreExercise()`, `estimateRoundSeconds()` | Higher cost penalises the exercise in short sessions |
| `impact_level` | string | `low`, `medium`, `high` | yes (select) | no | Reserved |
| `skill_level` | string | `low`, `medium`, `high` | yes (select) | no | Reserved |
| `space_required` | string | `small`, `medium`, `large` | yes (select) | no | Reserved |
| `variation_of` | string | exercise `id`, or empty | yes (text + datalist) | yes — `variationRoot()`, collision prevention in `pickMainMoves()` | Set to parent exercise id; prevents selecting a parent and its variation in the same block |
| `notes` | string | free text | yes (textarea) | no | Coaching cues; display only |
| `active` | boolean | true / false | yes (toggle) | no — **gap** | Intended to exclude inactive exercises; generator currently does not filter on this field |

---

## Patterns

`push` · `pull` · `squat` · `hinge` · `core` · `conditioning` · `carry`

Carries are eligible only in AMRAP and for-time formats. EMOM, fixed rounds, and fixed window never request the `carry` pattern.

## Equipment

`bodyweight` · `kettlebell` · `pullup_bar` · `rings` · `parallettes` · `box` · `bench`

## Rep units

| Value | Displayed as (example) |
|---|---|
| `total` | `x12` |
| `each_side` | `x12 each side` |
| `alternating_total` | `x20 alt` |
| `steps_total` | `x40 steps` |
| `seconds_each_side` | `20s each side` |

---

## Orphan / reserved fields

The following fields are written by the admin UI but not yet read by the generator. They are documented as reserved for a future phase:

- `optional_equipment` — intended to allow the generator to suggest substitutions
- `unilateral` — could be used to enforce alternating-side prescription logic
- `impact_level` — could gate exercises for low-impact sessions
- `skill_level` — could filter exercises by user skill setting
- `space_required` — could filter exercises when the user has limited space
- `active` — **should be wired into the generator** so that deactivating an exercise in the admin actually removes it from generated workouts (current gap)
