# Spec: Generate & Build modes — `app/page.js`

## Goal

Add a **Build mode** to the main page alongside the existing **Generate mode**,
controlled by a single toggle at the top of the screen. The two modes share the
same page; no routing changes are needed.

---

## What must NOT change

- `app/api/generate-workout/route.js` — untouched
- `lib/workout/generateWorkout.js` — untouched
- `lib/firebase.js` — untouched
- `app/admin/` — untouched
- Tailwind config, global CSS, and all other files outside `app/page.js`
- The existing Generate mode UI must remain identical in behaviour and
  appearance to what it is today

---

## Mode toggle

Add a pill-style toggle directly below the header, above all other content:

```
[ Generate ]  [ Build ]
```

- Default: **Generate**
- Implemented as two buttons in a segmented control (similar in style to the
  existing format/effort selectors — active state `bg-teal-600 text-white`,
  inactive `bg-white text-warm-500 border border-warm-200`)
- Switching mode replaces everything below the toggle; the header itself
  stays fixed

---

## Generate mode (existing)

No changes. The current controls (Duration, Effort, Format, Equipment,
Generate button) and output (title card, warm-up, blocks, Shuffle button)
remain exactly as they are today.

---

## Build mode

Build mode lets the user manually assemble a workout by picking exercises
from the Firestore catalogue and setting all parameters themselves.

### Step 1 — Pick exercises

Show a scrollable, filterable list of exercises drawn from Firestore
(same collection the generator reads from: `exercises`).

**Filters — show as a horizontal scrolling pill row:**
- Pattern: All · Push · Pull · Hinge · Squat · Core · Carry · Locomotion
- Equipment: mirrors the existing `ALL_EQUIPMENT` list (multi-select, same
  toggle-pill style as the current equipment selector)

**Exercise list items** — each row shows:
- Exercise name (left, `text-sm font-medium text-warm-700`)
- A `+` / `✓` button on the right — tapping adds/removes from the selection
- Selected items get a teal left border or teal-50 background to indicate
  selection without hiding them from the list

**Loading state:** while Firestore fetch is in progress, show 4–5 skeleton
rows (a rounded grey rectangle, same height as a row, pulsing with
`animate-pulse`).

**Firestore read:** use the existing `getDocs(collection(db, "exercises"))`
pattern from `lib/firebase.js`. Apply `where` clauses client-side rather
than adding new Firestore queries (keeps security rules unchanged).

**Selected exercises tray** — a sticky bar at the bottom of the picker
showing `{n} exercises selected` and a `Build workout →` button. Disabled
when 0 exercises selected.

---

### Step 2 — Configure

After tapping `Build workout →`, the picker collapses and a configuration
panel appears (same screen, scroll up to the top). This mirrors the Generate
config panel in visual style but all fields are mandatory and manually set:

| Field | Control | Details |
|---|---|---|
| Format | Pill selector | Same 5 options as Generate mode |
| Rounds / Window | Slider (conditional) | Appears exactly as in Generate mode |
| Effort | 1–5 buttons | Same as Generate mode |
| Duration | Slider | Same range (10–90 min, step 5) |

Show the selected exercises as a compact numbered list above the
configuration controls so the user can confirm their picks. Each item has
a small `✕` to remove it (returning them to the picker step if the list
empties). Do not make this list reorderable in this phase.

A `Build workout` button at the bottom (same style as `Generate workout`
button) submits to the API.

---

### Step 3 — Output

Call `POST /api/generate-workout` with the same payload shape as Generate
mode, but add one new field:

```json
{
  "pinnedExerciseIds": ["<firestoreDocId>", "..."]
}
```

The API route currently ignores unknown fields, so this is safe to send
now. The actual pinning logic is **out of scope for this task** — the
generator will still pick exercises freely. The field is included so the
API contract is established for a future wiring-up task.

The output is rendered using the **exact same workout output components**
as Generate mode (title card, warm-up block, main blocks, Shuffle button).
Do not create a separate output renderer.

---

## State shape (guidance, not prescriptive)

```js
// Top-level
const [mode, setMode] = useState("generate"); // "generate" | "build"

// Build mode
const [buildStep, setBuildStep] = useState("pick"); // "pick" | "configure" | "output"
const [allExercises, setAllExercises] = useState([]); // loaded from Firestore
const [exercisesLoading, setExercisesLoading] = useState(false);
const [selectedIds, setSelectedIds] = useState(new Set());
const [patternFilter, setPatternFilter] = useState("all");
const [equipmentFilter, setEquipmentFilter] = useState([]); // [] = no filter
```

Load `allExercises` from Firestore once, on first switch to Build mode
(lazy — don't fetch on initial page load). Cache the result in state so
switching back to Generate and then to Build again doesn't re-fetch.

---

## Error handling

- If the Firestore fetch fails, show the same red error box style used
  by the generate error today:
  ```jsx
  <div className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-200">
    <p className="text-sm text-red-600">Could not load exercises. Try again.</p>
  </div>
  ```
- If the API call from Build mode fails, show the same error box below
  the Build button.

---

## What is explicitly out of scope

- Reordering selected exercises (drag-and-drop)
- The `pinnedExerciseIds` field being honoured by the generator
- Any changes to Firestore security rules
- Any changes to the admin UI
- Authentication
- PWA / App Store work
