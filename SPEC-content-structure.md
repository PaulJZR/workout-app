# Spec: Content & Data Model Correctness (Phase 1)

## Goal

Get the exercise content model and the workout structure correct **before**
any authentication work is added. The admin UI schema, the Firestore
documents, and what `generateWorkout.js` actually reads must all agree.
Auth is explicitly out of scope for this phase.

## Stack & Context

- **Framework:** Next.js 16 (App Router), React 19, Tailwind CSS
- **Data:** Firebase Firestore (collection of exercise documents)
- **Repo:** `PaulJZR/workout-app` (GitHub)
- **Deploy:** Vercel — `workout-app-tau-pink.vercel.app`
- **Dev command:** `npm run dev` (already pinned to `--turbopack`)
- **Editor:** Cursor on macOS

### Key files

| File | Role |
|---|---|
| `lib/firebase.js` | Firebase init (do not change) |
| `app/admin/exercises/page.js` | Admin CRUD UI for the catalogue |
| `lib/workout/generateWorkout.js` | Reads catalogue from Firestore, builds workouts |
| `app/api/generate-workout/route.js` | API route wrapping the generator |
| `scripts/migrateExercises.mjs` | One-time CSV→Firestore migration (reference only) |

### Constraints

- Single-user app for now; no auth, no login. Do not add either.
- Do not change Firestore security rules in this phase.
- Do not change `lib/firebase.js` or environment variable handling.
- The catalogue currently holds ~49 exercise documents already in Firestore.
- Preserve the existing admin UI visual style (stone/rounded Tailwind look).
- Each change should be independently testable via `npm run dev`.

## Current State

The catalogue was migrated from a CSV to Firestore. The admin UI reads and
writes locally. The generator reads from Firestore and supports five formats:
AMRAP, EMOM, for time, fixed rounds, and fixed window. Several content/data
issues remain where the schema, the stored data, and the generator disagree.

## Required Work

The following are content and structure problems, ordered. Each item should
be a self-contained change with a clear before/after the user can verify in
the running app.

### 1. `carry` pattern is never selected

No format builder includes `"carry"` in its pattern list, so carry exercises
(farmer's carry, suitcase carry, single-arm carry, etc.) can never appear in
a generated workout — they are valid documents in Firestore that no code path
ever requests.

**Decision (fixed — implement exactly this):** Carries are eligible **only**
in the conditioning formats — `buildAMRAP` and `buildForTime` — where the
working unit is already time/distance rather than a strict rep target. Add
`"carry"` to the eligible pattern list for those two builders only.

**Do NOT** add `"carry"` to `buildEMOM`, `buildFixedRounds`, or
`buildFixedWindow`. EMOM and fixed-rep formats assume a per-move rep target;
a carry has no natural rep count and would render as nonsense like
"farmer's carry ×12".

Carries must appear at a plausible rate when AMRAP/for-time is selected —
present often enough to add variety, but not crowding out push/pull/hinge/
squat work in those blocks.

**Acceptance:** Repeatedly generating AMRAP and for-time workouts produces
carries at a sensible frequency with a distance- or time-based prescription
(never a bare `×N`). Repeatedly generating EMOM, fixed-rounds, and
fixed-window workouts never produces a carry.

### 2. `rep_unit` must be reflected in the prescription

Values exist in the data (`total`, `each_side`, `alternating_total`,
`steps_total`, `seconds_each_side`) but the displayed prescription must
clearly distinguish them. "x10 each side" and "x20 total" are different
workouts and the user must see which one is meant. Confirm the
`formatPrescription` logic covers every `rep_unit` value present in the
catalogue and that the admin UI exposes/edits the same set of values.

**Acceptance:** For each `rep_unit` value present in Firestore, a generated
workout shows an unambiguous, human-readable prescription. No exercise ever
displays a bare `×N` when its `rep_unit` implies sides/steps/alternation.

### 3. `time_per_unit_seconds` must drive EMOM budgeting

This field exists for EMOM time-budgeting but the EMOM builder uses a
hardcoded `TARGET_WORK_SECONDS` table instead. Wire `time_per_unit_seconds`
(with a sane fallback when missing) into the per-round time estimate so EMOM
rounds are budgeted from the data, not a constant.

**Acceptance:** Changing an exercise's `time_per_unit_seconds` in the admin
UI measurably changes the estimated EMOM round time for workouts containing
that exercise.

### 4. `variation_of` should prevent parent/variation collisions

`variation_of` is stored but unused. Within a single workout block, never
select both an exercise and another exercise that is a `variation_of` it (or
two variations of the same parent). This keeps a single workout from feeling
repetitive.

**Acceptance:** Across repeated generations, no single block contains an
exercise and its parent/sibling variation together.

### 5. Remove the cooldown entirely

The cooldown is currently hardcoded text ("stretch what feels tight")
appended to every generated workout. Remove it completely: delete the
cooldown block from the generator's output structure in
`generateWorkout.js`, and remove any UI that renders a cooldown section
where a workout is displayed. There is no replacement — workouts simply end
after the main block. Ensure no dangling references, empty sections, or
broken layout remain where the cooldown used to render.

**Acceptance:** Generated workouts contain no cooldown text or section in
the API response or the rendered UI, and nothing in the layout breaks where
it was removed.

### 6. Schema/UI/generator consistency pass

After 1–5, do a single consistency sweep. No schema additions are expected
in this phase — every field the generator reads must already be editable in
the admin UI, and every field the admin UI writes must be either used by the
generator or explicitly documented as reserved. Note any orphan fields
rather than silently leaving them.

**Acceptance:** A short written list (in the PR description or a
`DATA-MODEL.md`) mapping each catalogue field to: where it's edited, where
it's read, and its allowed values.

## Out of Scope (do NOT do in this phase)

- Authentication / login of any kind
- Firestore security rule changes
- PWA / Capacitor / App Store work
- Active workout timer mode, history/session tracking
- Visual redesign of the admin UI

## Working Method

- Make changes incrementally; after each numbered item, confirm it builds and
  the dev server runs before moving on.
- Prefer small, reviewable commits — one per numbered item where practical.
- When in doubt about a field's intended meaning, document the assumption in
  the PR/commit rather than guessing silently.
- Do not run destructive Firestore operations. Backfills, if any, should be
  described as a script to review, not executed automatically.
- If the working directory looks wrong or a stray `package.json` appears
  outside the project root, stop and flag it (a known prior failure mode).
