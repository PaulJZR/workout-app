# Claude Code — Phase 1 instructions

You are working on a Next.js 16 / React 19 / Tailwind CSS app called
`workout-app`. The exercise catalogue lives in Firebase Firestore. Read
`SCOPE.md` for full product context before starting.

Complete the four tasks below **in order**. After each task, confirm the dev
server starts (`npm run dev`) and the changed behaviour works before moving
to the next. Do not batch tasks together.

---

## Task 1 — Wire `pinnedExercises` into the generator

### Files to change
- `lib/workout/generateWorkout.js`
- `app/api/generate-workout/route.js` (probably no changes needed — verify)
- `app/page.js` (one line only)

### What to do

**In `lib/workout/generateWorkout.js`:**

Add this helper function near the other helpers at the top of the file:

```js
function resolvePinnedMoves(pinnedExercises, effort) {
  if (!pinnedExercises || pinnedExercises.length === 0) return null;
  return pinnedExercises.map(ex => toMove(ex, effort, "default"));
}
```

Then update each of the five format builder functions. In every builder,
the main block currently calls `pickMainMoves(eligible, ...)`. Replace that
call with a pinned-first pattern:

```js
// Example — buildAMRAP:
const rawMoves =
  resolvePinnedMoves(params.pinnedExercises, params.effort) ??
  pickMainMoves(eligible, params.effort, ["push","pull","hinge","core","carry"], params.durationMinutes);
```

Apply the same pattern to `buildForTime`, `buildFixedRounds`, and
`buildFixedWindow`, using whatever pattern array each already has.

**EMOM is different — do not use `resolvePinnedMoves` for it.** EMOM needs
the raw exercise objects (not converted moves) to pass through
`scaleEmomRoundToBudget`. In `buildEMOM`, replace the `pickMainMoves` call
with:

```js
const rawMoves =
  (params.pinnedExercises?.length > 0)
    ? params.pinnedExercises
    : pickMainMoves(eligible, params.effort, ["push","pull","hinge"], params.durationMinutes);
```

Everything else in `buildEMOM` (the `estimateRoundSeconds` call,
`targetSeconds` calculation, `scaleEmomRoundToBudget` call) stays exactly
as it is — `rawMoves` just now comes from the pinned list when provided.

**In `app/page.js`:**

In `submitBuildWorkout`, find this line:
```js
pinnedExerciseIds: [...selectedIds],
```
Replace it with:
```js
pinnedExercises: selectedExercises,
```

`selectedExercises` is already computed earlier in the file as
`allExercises.filter((ex) => selectedIds.has(ex.id))` — do not recompute it,
just reference it.

Also in `submitBuildWorkout`, find the line:
```js
equipmentAvailable: equipment,
```
Replace it with:
```js
equipmentAvailable: [...new Set([
  "bodyweight",
  ...selectedExercises.map(ex => ex.required_equipment).filter(Boolean)
])],
```

### Acceptance check
- In Build mode, pick 3–4 exercises, hit Build workout. The output main block
  must contain exactly those exercises by name.
- Switch to Generate mode and generate a workout. It must be unaffected —
  random as before.
- Try all 5 formats in Build mode and confirm the output renders without
  errors.

---

## Task 2 — Add top navigation bar

### Files to change
- `app/layout.js` (or wherever the root layout lives)
- `app/page.js` — remove the mode toggle
- New file: `app/components/NavBar.js` (or `NavBar.jsx`)

### What to do

Create a `NavBar` component. It renders a sticky bar directly below the
existing app header (do not replace the header). Three navigation items:

| Label | Icon (use an SVG or emoji, keep it simple) | Route |
|-------|--------------------------------------------|-------|
| Generate | ⚡ | `/` |
| Library | 📋 | `/library` |
| Build | 🔨 | `/build` |

Style rules:
- Match the existing app's colour scheme: teal-600 for active, warm-400 for
  inactive, white background, border-b border-warm-200
- Each item is a Next.js `<Link>` — use `usePathname()` to determine active
  tab
- Full width, items spread equally with `flex` / `justify-around`
- Icon above label, both centered
- Minimum touch target height 48px

Add `NavBar` to the root layout so it appears on every page.

In `app/page.js`, remove the mode toggle (`<div className="mt-4 flex gap-1...">`)
entirely. The Generate screen is now just the generator — Build lives on its
own route.

Also update the header subtitle from `"Generate your session"` to
`"Your workout app"` or similar neutral text, since the header is now shared
across all tabs.

### Acceptance check
- Nav bar appears on the home page
- Tapping Generate stays on `/`, Library goes to `/library` (404 is fine for
  now), Build goes to `/build` (404 is fine for now)
- Active tab is visually highlighted correctly as you navigate

---

## Task 3 — Create the Library route

### Files to create
- `app/library/page.js`

### What to do

This page reads all documents from the Firestore `workouts` collection and
displays them as a list of cards.

**Data shape to expect** (this is what Task 4 will write):
```js
{
  id: string,           // Firestore doc ID
  title: string,
  source: "generated" | "built",
  format: string,
  effort: number,
  durationMinutes: number,
  createdAt: Timestamp,
}
```

**Page behaviour:**
- On mount, fetch all docs from `/workouts` ordered by `createdAt` descending
- Loading state: show 3 skeleton card placeholders (grey rounded rectangles,
  `animate-pulse`)
- Empty state: a centred message — "No saved workouts yet. Generate one or
  build your own." with a teal Generate button linking to `/`
- Error state: same red error box style used elsewhere in the app

**Each card shows:**
- Title (bold, warm-900)
- A small badge for format (e.g. "AMRAP") — teal-50 background, teal-700
  text, rounded-full, text-xs
- Duration: "{n} min"
- Effort: "{n}/5"
- Date: formatted as "12 May 2026" using `toLocaleDateString`
- The whole card is tappable (will navigate to detail — use a placeholder
  `onClick` that `console.log`s the id for now)

**Style:** match existing card style — `bg-white rounded-2xl p-5 shadow-sm
border border-warm-100`

### Acceptance check
- `/library` loads without errors
- Empty state shows when no workouts are saved
- After Task 4 saves a workout, it appears in the list

---

## Task 4 — Save button on Generate output

### Files to change
- `app/page.js`

### What to do

Add a **Save workout** button to the `WorkoutOutput` component.

**Props change:** `WorkoutOutput` needs two new props:
- `onSave: async () => void`
- `saveState: "idle" | "saving" | "saved" | "error"`

**Button placement:** between the workout blocks and the Regenerate button.

**Button appearance by state:**

| State | Text | Style |
|-------|------|-------|
| idle | "Save workout" | White bg, teal border, teal text |
| saving | "Saving…" | Disabled, muted |
| saved | "Saved ✓" | Teal-50 bg, teal text, disabled |
| error | "Save failed — tap to retry" | Red-50 bg, red text |

**In the `Home` component**, add state:
```js
const [saveState, setSaveState] = useState("idle");
```

Reset `saveState` to `"idle"` whenever a new workout is generated (i.e. at
the start of `generateWorkout`).

Add a `saveWorkout` async function:

```js
async function saveWorkout() {
  if (!workout) return;
  setSaveState("saving");
  try {
    const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
    await addDoc(collection(db, "workouts"), {
      title: workout.title,
      source: "generated",
      format,
      effort,
      durationMinutes,
      equipment,
      warmup: workout.warmup,
      blocks: workout.blocks,
      timing: workout.timing,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setSaveState("saved");
  } catch (err) {
    console.error("Save failed:", err);
    setSaveState("error");
  }
}
```

Pass `onSave={saveWorkout}` and `saveState={saveState}` to `WorkoutOutput`.

### Acceptance check
- Generate a workout. "Save workout" button appears in the output.
- Tap it. Button shows "Saving…" then "Saved ✓".
- Navigate to `/library`. The workout appears as a card.
- Generate again (or shuffle). Save state resets to idle.
- Tap Save twice — second tap does nothing (button is disabled when saved).

---

## General rules

- Run `npm run dev` and check for errors after each task before moving on.
- Do not modify any files in `app/admin/`.
- Do not change Firestore security rules.
- Do not install new npm packages — everything needed is already in the
  project (Firebase, Next.js, Tailwind, React).
- If you find a stray `package.json` or `package-lock.json` outside the
  project root, stop and flag it — do not proceed.
- Keep all existing Tailwind classes intact — do not refactor styling.
