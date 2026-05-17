# Spec: Wire `pinnedExerciseIds` into the workout generator

## Problem

Build mode sends `pinnedExerciseIds` (an array of Firestore document IDs) in
the API payload, but the generator ignores it. The main block exercises are
still picked randomly. This spec makes the generator use the pinned exercises
as the main block moves.

---

## What must NOT change

- `app/page.js` — untouched
- `app/admin/` — untouched
- Warmup picking logic — warmup is always randomly selected from eligible
  exercises regardless of pinned IDs. Do not change this.
- All format builders' timing, pacing, and structural logic — only the move
  selection changes.

---

## The problem in one sentence

Every format builder calls `pickMainMoves(eligible, ...)` to select exercises.
When `pinnedExerciseIds` is present and non-empty, that call should be replaced
by using the pinned exercises directly.

---

## Changes required

### 1. `app/api/generate-workout/route.js`

**Current situation:** The route reads from the CSV file on disk. But
`pinnedExerciseIds` are Firestore document IDs — they won't match anything
in the CSV. The CSV rows have no `id` field.

**Fix:** The route must accept pinned exercises as full exercise objects, not
just IDs. Change the UI (`page.js` is out of scope here, so note this as a
**contract change** the UI will need to match) OR handle it entirely in the
generator by passing the pinned objects through.

**Simplest approach that requires no UI change:** Accept `pinnedExercises` as
an array of full exercise objects in the payload alongside (or instead of)
`pinnedExerciseIds`. The UI already has the full exercise objects in
`allExercises` state — it just needs to send them. See the UI note at the
end of this spec.

For now the route passes `params` straight through to the generator, so no
route changes are needed beyond ensuring `pinnedExercises` is forwarded (it
already is, since params is passed wholesale).

---

### 2. `lib/workout/generateWorkout.js`

#### 2a. Add a `resolvePinnedMoves` helper

```js
function resolvePinnedMoves(pinnedExercises, effort, mode = "default") {
  if (!pinnedExercises || pinnedExercises.length === 0) return null;
  return pinnedExercises.map(ex => toMove(ex, effort, mode));
}
```

This converts the array of raw exercise objects into the `{ name, prescription }`
shape the output expects, using the existing `toMove` function. Returns `null`
when no pinned exercises are provided (so callers can fall back to random pick).

#### 2b. Update each format builder

In every format builder (`buildAMRAP`, `buildEMOM`, `buildForTime`,
`buildFixedRounds`, `buildFixedWindow`), replace the `pickMainMoves(...)` call
for the main block with a pinned-first pattern:

```js
// Before (example from buildAMRAP):
const rawMoves = pickMainMoves(eligible, params.effort, ["push","pull","hinge","core","carry"], params.durationMinutes);

// After:
const rawMoves = resolvePinnedMoves(params.pinnedExercises, params.effort)
  ?? pickMainMoves(eligible, params.effort, ["push","pull","hinge","core","carry"], params.durationMinutes);
```

Apply this same pattern to all five builders. The pinned path completely
replaces random picking for the main block — there is no merging or
supplementing with random exercises in this phase.

#### 2c. EMOM special case

`buildEMOM` uses `scaleEmomRoundToBudget` on the raw moves before converting
to prescriptions. The pinned path must also go through this scaling so EMOM
timing still works:

```js
// In buildEMOM, after resolving rawMoves:
const emomRound = rawMoves
  ? scaleEmomRoundToBudget(rawMoves, params.effort, targetSeconds)
  : scaleEmomRoundToBudget(
      pickMainMoves(eligible, params.effort, ["push","pull","hinge"], params.durationMinutes),
      params.effort,
      targetSeconds
    );
```

Note: `resolvePinnedMoves` for EMOM should pass `mode = "emom"` so `toMove`
uses `pickEmomPrescription`. But since EMOM scaling via
`scaleEmomRoundToBudget` operates on raw exercise objects (not `{ name,
prescription }` pairs), the pinned path needs the raw objects, not the
converted moves.

**Correct EMOM approach:** Do not call `resolvePinnedMoves` for EMOM. Instead:

```js
const rawMovesForEmom = (params.pinnedExercises?.length > 0)
  ? params.pinnedExercises
  : pickMainMoves(eligible, params.effort, ["push","pull","hinge"], params.durationMinutes);

const { totalSeconds: naturalSeconds, unknowns } = estimateRoundSeconds(rawMovesForEmom, params.effort);
// ... existing targetSeconds calculation unchanged ...
const emomRound = scaleEmomRoundToBudget(rawMovesForEmom, params.effort, targetSeconds);
```

For all other formats, `resolvePinnedMoves` works correctly because they use
`toMoves(rawMoves, effort)` which also calls `toMove` on raw objects.

---

### 3. `app/page.js` — UI contract change (one line)

`submitBuildWorkout` currently sends:
```js
pinnedExerciseIds: [...selectedIds],
```

Change this to send the full exercise objects instead:
```js
pinnedExercises: selectedExercises,
```

`selectedExercises` is already computed at line 214:
```js
const selectedExercises = allExercises.filter((ex) => selectedIds.has(ex.id));
```

This is the only change needed in `page.js`.

---

## Equipment handling in Build mode (fix a pre-existing bug)

`submitBuildWorkout` currently sends `equipmentAvailable: equipment` — that is
the Generate mode equipment state, not the Build mode equipment filter. Since
Build mode exercises are already chosen by the user, the equipment filter
used for eligibility in the generator is irrelevant for the main block (the
pinned exercises are used directly). However, the warmup is still picked
randomly from `eligible`, which is filtered by `equipmentAvailable`.

Fix: send the equipment implied by the selected exercises, derived from their
`required_equipment` fields:

```js
// In submitBuildWorkout, derive equipment from selected exercises:
const selectedEquipment = [
  "bodyweight",
  ...selectedExercises
    .map(ex => ex.required_equipment)
    .filter(Boolean)
];
const equipmentAvailable = [...new Set(selectedEquipment)];
```

Then send `equipmentAvailable` in the payload instead of `equipment`. This
ensures the warmup pool is coherent with the exercises the user actually chose.

---

## Acceptance criteria

1. In Build mode, picking 4 exercises and hitting "Build workout" produces a
   workout whose main block contains exactly those 4 exercises (names match).
2. The warmup still contains random exercises — it is not affected by pinning.
3. Generate mode is completely unaffected: when `pinnedExercises` is absent or
   empty, the generator behaves identically to before.
4. All 5 formats work correctly with pinned exercises:
   - AMRAP: pinned moves appear in the block, pacing suggestion still renders
   - EMOM: pinned moves are EMOM-scaled correctly
   - Rounds / For time: pinned moves appear, round timing unchanged
   - Fixed windows: pinned moves appear, window timing unchanged
5. "Shuffle exercises" in Build output re-runs with the same pinned exercises
   (since `submitBuildWorkout` is called again with the same `selectedIds`).

---

## Out of scope

- Supplementing pinned exercises with random ones when fewer than N are pinned
- Reordering or grouping pinned exercises by pattern
- Any UI changes beyond the one-line fix to `submitBuildWorkout`
- Any Firestore security rule changes
- Admin UI changes
