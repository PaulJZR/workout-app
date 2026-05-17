# Workout App — Product Scope

## Vision

A mobile-first web app for generating and building HIIT workouts, backed by a
curated exercise catalogue in Firestore. Works in the browser today; wraps
with Capacitor for native iPhone distribution later. Designed for personal use
and a small group — user accounts are a future concern, not a current one.

---

## Guiding principles

- **Mobile-first throughout.** Every screen is designed for a phone browser.
  Max content width 480px. Touch targets minimum 44px. No hover-dependent UI.
- **Firestore is the single source of truth** for exercises and saved workouts.
- **No authentication yet.** All saved workouts go into one shared Firestore
  collection. User accounts are explicitly out of scope for all phases below.
- **Next.js stays.** No framework rebuild. Capacitor wrapping comes after the
  core product is stable.
- **The exercise catalogue and admin UI are not changing.** `/admin/exercises`
  is considered complete.

---

## Navigation

A persistent **top navigation bar** with three destinations:

| Tab | Icon | Description |
|-----|------|-------------|
| Generate | ⚡ | HIIT workout generator (current core feature) |
| Library | 📋 | Browse and open saved workouts |
| Build | 🔨 | Create a workout from scratch or from a generated one |

The nav bar is sticky at the top, below the app header. Active tab is
visually distinct. On mobile the labels sit below the icons. This replaces
the current mode toggle entirely.

---

## Screen inventory

### 1. Generate (current home screen, refined)

**Purpose:** Quickly generate a random HIIT workout based on parameters.

**Controls (unchanged from current):**
- Duration slider (10–90 min, step 5)
- Effort level 1–5
- Format picker (AMRAP, EMOM, Rounds, For Time, Windows)
- Conditional rounds / window sliders
- Equipment multi-select

**Changes from current:**
- Add a **Save workout** button to the output card. Tapping it saves the
  generated workout to Firestore and navigates to Library.
- The "Shuffle exercises" button stays, but relabelled **Regenerate** for
  clarity.
- Remove the mode toggle (replaced by top nav).

**Firestore write on save:**
```
/workouts/{docId}
  title: string          — from workout.title
  source: "generated"    — always this value for generated workouts
  format: string         — e.g. "amrap"
  effort: number
  durationMinutes: number
  equipment: string[]
  warmup: Move[]
  blocks: Block[]
  createdAt: timestamp
  updatedAt: timestamp
```

---

### 2. Library

**Purpose:** Browse all saved workouts. Open one to view or do it.

**Layout:**
- List of workout cards, reverse-chronological (newest first)
- Each card shows: title, format badge, duration, effort dots, date saved
- Tap a card → Workout Detail screen (see below)
- Empty state: "No saved workouts yet. Generate one or build your own."
- No search or filtering in this phase — the library will be small

**Workout Detail screen (child of Library):**
- Full workout display — same visual treatment as the Generate output
- **Delete** button (with confirmation) to remove from Firestore
- **Edit** button — opens the workout in Build mode for modification
  (pre-populates Build with this workout's exercises and settings)
- No sharing or exporting in this phase

---

### 3. Build

**Purpose:** Create a workout from scratch, or edit a saved one, then save it.

**Three sub-steps within the Build screen:**

#### Step A — Exercises
- Scrollable, filterable list of all exercises from Firestore
- Filters: pattern (All / Push / Pull / Hinge / Squat / Core / Carry /
  Locomotion) as a horizontal pill row; equipment as a multi-select pill row
- Each exercise row: name, pattern badge, + / ✓ toggle button
- Selected exercises shown in a sticky tray at the bottom:
  "{n} selected · Next →"
- Tray button disabled when 0 exercises selected

#### Step B — Structure
- Selected exercises shown as a numbered, removable list at the top
- Format picker (same 5 options as Generate)
- Conditional rounds / window sliders
- Effort 1–5
- Duration slider
- Workout name field (text input, required before saving)
  - Pre-filled with a sensible default: "{Format} — {date}"
- **Save workout** button at the bottom
  - Disabled until name field is non-empty
  - On success: saves to Firestore, navigates to Library, shows the new card

**Firestore write on save from Build:**
```
/workouts/{docId}
  title: string          — user-entered name
  source: "built"        — always this value for manually built workouts
  format: string
  effort: number
  durationMinutes: number
  equipment: string[]    — derived from selected exercises' required_equipment
  pinnedExercises: object[]  — the full exercise objects the user selected
  warmup: Move[]         — generator picks these (same as Generate mode)
  blocks: Block[]        — generator uses pinnedExercises for main moves
  createdAt: timestamp
  updatedAt: timestamp
```

Note: the generator is called server-side when saving a built workout, exactly
as it is for Generate mode. The `pinnedExercises` field drives the main block
selection (per the pinned-exercises spec). The saved document stores both the
pinned inputs and the generated output.

#### Edit flow (entering Build from Library → Detail → Edit):
- Build opens at Step B, pre-populated with the saved workout's settings
- The exercise list (Step A) is accessible via "← Change exercises" link
- Saving overwrites the existing document (same `docId`), updating `updatedAt`

---

## Firestore collections

| Collection | Purpose | Written by |
|------------|---------|------------|
| `exercises` | Exercise catalogue | Admin UI (existing) |
| `workouts` | Saved workouts | Generate save + Build save |

No other collections in this phase. No user subcollections.

---

## Firestore security rules

Current rules allow authenticated writes only. Since there is no auth:

- **For development and initial group use:** open rules (read/write for all)
  are acceptable. This is the current state.
- **Before any public access:** rules must be tightened. This is explicitly
  a future task, tracked as a known risk.

---

## What is explicitly out of scope

- User authentication / accounts
- Per-user workout libraries
- Workout history / session logging (marked "maybe later")
- Push notifications or reminders
- Social features (sharing, following, likes)
- In-workout timer mode (running the workout live with countdowns)
- Exercise video or image attachments
- Search within Library
- Capacitor / native build (after core product is stable)
- Any changes to `/admin/exercises`

---

## Build order (recommended phases)

### Phase 1 — Foundation
1. Wire `pinnedExercises` into the generator so Build mode actually uses
   selected exercises (see `SPEC-pinned-exercises.md`)
2. Add top nav bar, replacing the current mode toggle
3. Create the `/library` route with the workout list (read from Firestore)
4. Add Save button to Generate output → writes to Firestore `/workouts`

### Phase 2 — Build screen
5. Move Build mode into its own `/build` route
6. Implement Step A (exercise picker with filters)
7. Implement Step B (structure + name + save)
8. Implement Workout Detail screen under `/library/[id]`

### Phase 3 — Edit flow
9. Wire Library → Detail → Edit → back into Build pre-populated
10. Implement overwrite save (update existing doc)

### Phase 4 — Polish (before Capacitor)
11. Empty states, loading skeletons, error handling throughout
12. Tighten Firestore security rules
13. PWA manifest, icons, offline behaviour
14. Capacitor wrap for iPhone

---

## Open questions (to resolve before Phase 2)

1. **Workout name in Generate mode:** Should the user be prompted to name a
   generated workout before saving, or should it auto-save with the generated
   title? Auto-save is faster; prompted name gives better library organisation.

2. **Warmup in Build mode:** Currently the generator picks warmup exercises
   randomly from the eligible pool. Should a built workout's warmup also be
   random (current behaviour), or should the user be able to pick warmup
   exercises too in Step A?

3. **Duplicate saves:** If the user generates a workout, shuffles it, then
   saves — should each save create a new document, or replace the previous
   one from this session?
