"use client";

import { useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const ALL_EQUIPMENT = [
  { id: "bodyweight", label: "Bodyweight", icon: "🏋️" },
  { id: "kettlebell", label: "Kettlebell", icon: "🔔" },
  { id: "pullup_bar", label: "Pull-up bar", icon: "💪" },
  { id: "rings", label: "Rings", icon: "⭕" },
  { id: "parallettes", label: "Parallettes", icon: "🤸" },
  { id: "box", label: "Box", icon: "📦" },
  { id: "bench", label: "Bench", icon: "🪑" },
];

const FORMATS = [
  { id: "amrap", label: "AMRAP", desc: "As many rounds as possible" },
  { id: "emom", label: "EMOM", desc: "Every minute on the minute" },
  { id: "fixed_rounds", label: "Rounds", desc: "Fixed rounds with rest" },
  { id: "for_time", label: "For time", desc: "Complete as fast as possible" },
  { id: "fixed_window", label: "Windows", desc: "Timed work windows" },
];

const EFFORT_LABELS = ["", "Easy", "Moderate", "Challenging", "Hard", "All out"];

const PATTERNS = [
  { id: "all", label: "All" },
  { id: "push", label: "Push" },
  { id: "pull", label: "Pull" },
  { id: "hinge", label: "Hinge" },
  { id: "squat", label: "Squat" },
  { id: "core", label: "Core" },
  { id: "carry", label: "Carry" },
  { id: "locomotion", label: "Locomotion" },
];

function WorkoutOutput({ workout, effort, onShuffle, loading }) {
  return (
    <div className="mt-8 space-y-4">
      <div className="bg-teal-600 text-white rounded-2xl p-5 shadow-lg shadow-teal-200">
        <h2 className="text-lg font-bold">{workout.title}</h2>
        <div className="flex gap-3 mt-2 text-sm text-teal-100">
          <span className="bg-teal-700/50 px-2.5 py-0.5 rounded-full">
            {workout.timing.total} min total
          </span>
          <span className="bg-teal-700/50 px-2.5 py-0.5 rounded-full">
            Effort {effort}/5
          </span>
        </div>
        <div className="flex gap-4 mt-3 text-xs text-teal-200">
          <span>Warm-up {workout.timing.warmup}m</span>
          <span>Main {workout.timing.main}m</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-warm-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm">
            🔥
          </div>
          <h3 className="text-sm font-bold text-warm-700">Warm-up</h3>
          <span className="text-xs text-warm-400 ml-auto">
            ~{workout.timing.warmup} min
          </span>
        </div>
        <div className="space-y-2">
          {workout.warmup.map((ex) => (
            <div
              key={ex.name}
              className="flex items-center justify-between py-2 border-b border-warm-100 last:border-0"
            >
              <span className="text-sm text-warm-700">{ex.name}</span>
              <span className="text-sm font-semibold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full">
                {ex.prescription}
              </span>
            </div>
          ))}
        </div>
      </div>

      {workout.blocks.map((b, i) => (
        <div
          key={b.type + i}
          className="bg-white rounded-2xl p-5 shadow-sm border border-warm-100"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-sm">
              ⚡
            </div>
            <h3 className="text-sm font-bold text-warm-700">Main</h3>
          </div>

          <div className="mt-2 mb-3">
            <p className="text-base font-bold text-warm-800">
              {b.type === "amrap" && `AMRAP — ${b.minutes} min`}
              {b.type === "emom" && `EMOM — ${b.minutes} min`}
              {b.type === "rounds" &&
                `${b.rounds} rounds — ~${b.workPerRoundMin} min each`}
              {b.type === "for_time" && `For time — ${b.rounds} rounds`}
              {b.type === "fixed_window" &&
                `${b.windows} × ${b.windowMinutes} min windows`}
            </p>

            {b.pacing && (
              <p className="text-xs text-teal-600 mt-1 bg-teal-50 inline-block px-2.5 py-1 rounded-lg">
                {b.pacing}
              </p>
            )}

            {b.note && (
              <p className="text-xs text-warm-500 mt-1">{b.note}</p>
            )}

            {(b.type === "rounds" || b.type === "for_time") && b.rounds > 1 && (
              <p className="text-xs text-warm-400 mt-1">
                Rest ~{b.restBetweenRoundsMin} min between rounds
              </p>
            )}

            {b.type === "fixed_window" && b.spareMinutes > 0 && (
              <p className="text-xs text-warm-400 mt-1">
                +{b.spareMinutes} min spare for setup/transition
              </p>
            )}
          </div>

          <div className="space-y-0">
            {(b.moves ?? []).map((ex, j) => (
              <div
                key={ex.name}
                className="flex items-center justify-between py-3 border-b border-warm-100 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-warm-100 text-warm-500 text-xs flex items-center justify-center font-semibold">
                    {j + 1}
                  </span>
                  <span className="text-sm text-warm-700 font-medium">
                    {ex.name}
                  </span>
                </div>
                <span className="text-sm font-bold text-teal-600 bg-teal-50 px-3 py-1 rounded-full">
                  {ex.prescription}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={onShuffle}
        disabled={loading}
        className="w-full py-3 rounded-2xl text-sm font-semibold text-teal-600 bg-teal-50 border-2 border-teal-200 hover:bg-teal-100 active:scale-[0.98] transition-all duration-200"
      >
        {loading ? "Regenerating..." : "Shuffle exercises"}
      </button>
    </div>
  );
}

export default function Home() {
  // Generate mode state
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [effort, setEffort] = useState(3);
  const [format, setFormat] = useState("amrap");
  const [rounds, setRounds] = useState(4);
  const [windowMinutes, setWindowMinutes] = useState(3);
  const [windowRounds, setWindowRounds] = useState(4);
  const [equipment, setEquipment] = useState(["bodyweight", "kettlebell", "pullup_bar"]);
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Mode toggle
  const [mode, setMode] = useState("generate");

  // Build mode — exercise catalogue
  const [allExercises, setAllExercises] = useState([]);
  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [exercisesError, setExercisesError] = useState(false);

  // Build mode — picker state
  const [buildStep, setBuildStep] = useState("pick");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [patternFilter, setPatternFilter] = useState("all");
  const [equipmentFilter, setEquipmentFilter] = useState([]);

  // Build mode — config state
  const [buildFormat, setBuildFormat] = useState("amrap");
  const [buildRounds, setBuildRounds] = useState(4);
  const [buildWindowMinutes, setBuildWindowMinutes] = useState(3);
  const [buildWindowRounds, setBuildWindowRounds] = useState(4);
  const [buildEffort, setBuildEffort] = useState(3);
  const [buildDuration, setBuildDuration] = useState(30);

  // Build mode — output state
  const [buildWorkout, setBuildWorkout] = useState(null);
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildError, setBuildError] = useState(null);

  const showRounds = format === "fixed_rounds" || format === "for_time";
  const showWindows = format === "fixed_window";
  const buildShowRounds = buildFormat === "fixed_rounds" || buildFormat === "for_time";
  const buildShowWindows = buildFormat === "fixed_window";

  const filteredExercises = allExercises.filter((ex) => {
    if (patternFilter !== "all" && ex.primary_pattern !== patternFilter) return false;
    if (equipmentFilter.length > 0 && !equipmentFilter.includes(ex.required_equipment))
      return false;
    return true;
  });

  const selectedExercises = allExercises.filter((ex) => selectedIds.has(ex.id));

  async function loadExercises() {
    if (allExercises.length > 0) return;
    setExercisesLoading(true);
    setExercisesError(false);
    try {
      const snap = await getDocs(collection(db, "exercises"));
      setAllExercises(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      setExercisesError(true);
    } finally {
      setExercisesLoading(false);
    }
  }

  function handleModeSwitch(newMode) {
    setMode(newMode);
    if (newMode === "build" && allExercises.length === 0 && !exercisesLoading) {
      loadExercises();
    }
  }

  function toggleEquipment(id) {
    setEquipment((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  }

  function toggleEquipmentFilter(id) {
    setEquipmentFilter((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function removeSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      if (next.size === 0) setBuildStep("pick");
      return next;
    });
  }

  async function generateWorkout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationMinutes,
          effort,
          format,
          rounds: showRounds ? rounds : undefined,
          windowMinutes: showWindows ? windowMinutes : undefined,
          windowRounds: showWindows ? windowRounds : undefined,
          equipmentAvailable: equipment,
          warmupMinutes: null,
          respectExplicitMainMinutes: false,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || `HTTP ${res.status}`);
      setWorkout(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setWorkout(null);
    } finally {
      setLoading(false);
    }
  }

  async function submitBuildWorkout() {
    setBuildLoading(true);
    setBuildError(null);
    try {
      const res = await fetch("/api/generate-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationMinutes: buildDuration,
          effort: buildEffort,
          format: buildFormat,
          rounds: buildShowRounds ? buildRounds : undefined,
          windowMinutes: buildShowWindows ? buildWindowMinutes : undefined,
          windowRounds: buildShowWindows ? buildWindowRounds : undefined,
          equipmentAvailable: equipment,
          warmupMinutes: null,
          respectExplicitMainMinutes: false,
          pinnedExerciseIds: [...selectedIds],
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || `HTTP ${res.status}`);
      setBuildWorkout(data);
      setBuildStep("output");
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : String(err));
    } finally {
      setBuildLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <header className="bg-white border-b border-warm-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-warm-900 tracking-tight">
              Workout
            </h1>
            <p className="text-xs text-warm-400 mt-0.5">Generate your session</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-teal-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">W</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pb-10">
        {/* Mode toggle */}
        <div className="mt-4 flex gap-1 p-1 bg-warm-100 rounded-xl">
          {[
            { id: "generate", label: "Generate" },
            { id: "build", label: "Build" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => handleModeSwitch(m.id)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mode === m.id
                  ? "bg-teal-600 text-white shadow"
                  : "text-warm-500 hover:text-warm-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* ── Generate mode ── */}
        {mode === "generate" && (
          <>
            {/* Duration */}
            <section className="mt-6">
              <div className="flex items-baseline justify-between mb-3">
                <label className="text-sm font-semibold text-warm-700">
                  Duration
                </label>
                <span className="text-2xl font-bold text-teal-700">
                  {durationMinutes}
                  <span className="text-sm font-normal text-warm-400 ml-1">min</span>
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={90}
                step={5}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-warm-400 mt-1">
                <span>10 min</span>
                <span>90 min</span>
              </div>
            </section>

            {/* Effort */}
            <section className="mt-8">
              <div className="flex items-baseline justify-between mb-3">
                <label className="text-sm font-semibold text-warm-700">
                  Effort
                </label>
                <span className="text-sm font-medium text-teal-700">
                  {EFFORT_LABELS[effort]}
                </span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => setEffort(level)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      effort === level
                        ? "bg-teal-600 text-white shadow-md shadow-teal-200"
                        : "bg-white text-warm-500 border border-warm-200 hover:border-teal-300"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </section>

            {/* Format */}
            <section className="mt-8">
              <label className="text-sm font-semibold text-warm-700 block mb-3">
                Format
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      format === f.id
                        ? "bg-teal-600 text-white shadow-md shadow-teal-200"
                        : "bg-white text-warm-500 border border-warm-200 hover:border-teal-300"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-warm-400 mt-2">
                {FORMATS.find((f) => f.id === format)?.desc}
              </p>
            </section>

            {/* Conditional: Rounds */}
            {showRounds && (
              <section className="mt-6">
                <div className="flex items-baseline justify-between mb-3">
                  <label className="text-sm font-semibold text-warm-700">
                    Rounds
                  </label>
                  <span className="text-2xl font-bold text-teal-700">{rounds}</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={10}
                  step={1}
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-warm-400 mt-1">
                  <span>2</span>
                  <span>10</span>
                </div>
              </section>
            )}

            {/* Conditional: Windows */}
            {showWindows && (
              <div className="mt-6 grid grid-cols-2 gap-4">
                <section>
                  <div className="flex items-baseline justify-between mb-2">
                    <label className="text-sm font-semibold text-warm-700">
                      Window
                    </label>
                    <span className="text-lg font-bold text-teal-700">
                      {windowMinutes}
                      <span className="text-xs font-normal text-warm-400 ml-0.5">
                        min
                      </span>
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={windowMinutes}
                    onChange={(e) => setWindowMinutes(Number(e.target.value))}
                    className="w-full"
                  />
                </section>
                <section>
                  <div className="flex items-baseline justify-between mb-2">
                    <label className="text-sm font-semibold text-warm-700">
                      Repeats
                    </label>
                    <span className="text-lg font-bold text-teal-700">
                      {windowRounds}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    step={1}
                    value={windowRounds}
                    onChange={(e) => setWindowRounds(Number(e.target.value))}
                    className="w-full"
                  />
                </section>
              </div>
            )}

            {/* Equipment */}
            <section className="mt-8">
              <label className="text-sm font-semibold text-warm-700 block mb-3">
                Equipment
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_EQUIPMENT.map((eq) => {
                  const selected = equipment.includes(eq.id);
                  return (
                    <button
                      key={eq.id}
                      onClick={() => toggleEquipment(eq.id)}
                      className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        selected
                          ? "bg-teal-50 text-teal-700 border-2 border-teal-500"
                          : "bg-white text-warm-400 border-2 border-warm-200 hover:border-warm-300"
                      }`}
                    >
                      <span className="mr-1.5">{eq.icon}</span>
                      {eq.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Generate button */}
            <button
              onClick={generateWorkout}
              disabled={loading || equipment.length === 0}
              className={`mt-8 w-full py-4 rounded-2xl text-base font-bold transition-all duration-200 ${
                loading || equipment.length === 0
                  ? "bg-warm-200 text-warm-400 cursor-not-allowed"
                  : "bg-teal-600 text-white shadow-lg shadow-teal-200 hover:bg-teal-700 active:scale-[0.98]"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Generating...
                </span>
              ) : (
                "Generate workout"
              )}
            </button>

            {error && (
              <div className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {workout && (
              <WorkoutOutput
                workout={workout}
                effort={effort}
                onShuffle={generateWorkout}
                loading={loading}
              />
            )}
          </>
        )}

        {/* ── Build mode ── */}
        {mode === "build" && (
          <>
            {/* Step: pick */}
            {buildStep === "pick" && (
              <>
                {/* Pattern filter row */}
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {PATTERNS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPatternFilter(p.id)}
                      className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                        patternFilter === p.id
                          ? "bg-teal-600 text-white"
                          : "bg-white text-warm-500 border border-warm-200 hover:border-teal-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Equipment filter row */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {ALL_EQUIPMENT.map((eq) => {
                    const active = equipmentFilter.includes(eq.id);
                    return (
                      <button
                        key={eq.id}
                        onClick={() => toggleEquipmentFilter(eq.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                          active
                            ? "bg-teal-50 text-teal-700 border-2 border-teal-500"
                            : "bg-white text-warm-400 border-2 border-warm-200 hover:border-warm-300"
                        }`}
                      >
                        <span className="mr-1">{eq.icon}</span>
                        {eq.label}
                      </button>
                    );
                  })}
                </div>

                {/* Exercise list */}
                <div className="mt-4">
                  {exercisesLoading && (
                    <div className="space-y-2">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="h-12 rounded-xl bg-warm-200 animate-pulse"
                        />
                      ))}
                    </div>
                  )}

                  {exercisesError && (
                    <div className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-200">
                      <p className="text-sm text-red-600">
                        Could not load exercises. Try again.
                      </p>
                    </div>
                  )}

                  {!exercisesLoading && !exercisesError && (
                    <div className="space-y-1 pb-24">
                      {filteredExercises.map((ex) => {
                        const isSelected = selectedIds.has(ex.id);
                        return (
                          <div
                            key={ex.id}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-150 ${
                              isSelected
                                ? "bg-teal-50 border-teal-200 border-l-4 border-l-teal-500"
                                : "bg-white border-warm-100"
                            }`}
                          >
                            <span className="text-sm font-medium text-warm-700">
                              {ex.name}
                            </span>
                            <button
                              onClick={() => toggleSelected(ex.id)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-150 ${
                                isSelected
                                  ? "bg-teal-600 text-white"
                                  : "bg-warm-100 text-warm-500 hover:bg-warm-200"
                              }`}
                            >
                              {isSelected ? "✓" : "+"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Sticky selection tray */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-warm-200 px-5 py-4 z-20">
                  <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-warm-600">
                      {selectedIds.size} exercise
                      {selectedIds.size !== 1 ? "s" : ""} selected
                    </span>
                    <button
                      disabled={selectedIds.size === 0}
                      onClick={() => {
                        setBuildStep("configure");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                        selectedIds.size === 0
                          ? "bg-warm-200 text-warm-400 cursor-not-allowed"
                          : "bg-teal-600 text-white shadow-md shadow-teal-200 hover:bg-teal-700"
                      }`}
                    >
                      Build workout →
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Step: configure */}
            {buildStep === "configure" && (
              <>
                {/* Selected exercises list */}
                <div className="mt-4">
                  <label className="text-sm font-semibold text-warm-700 block mb-2">
                    Selected exercises
                  </label>
                  <div className="space-y-1">
                    {selectedExercises.map((ex, i) => (
                      <div
                        key={ex.id}
                        className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl border border-warm-100"
                      >
                        <span className="w-5 h-5 rounded-full bg-warm-100 text-warm-500 text-xs flex items-center justify-center font-semibold shrink-0">
                          {i + 1}
                        </span>
                        <span className="flex-1 text-sm font-medium text-warm-700">
                          {ex.name}
                        </span>
                        <button
                          onClick={() => removeSelected(ex.id)}
                          className="text-warm-400 hover:text-red-400 text-sm font-bold px-1 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Format */}
                <section className="mt-6">
                  <label className="text-sm font-semibold text-warm-700 block mb-3">
                    Format
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {FORMATS.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setBuildFormat(f.id)}
                        className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                          buildFormat === f.id
                            ? "bg-teal-600 text-white shadow-md shadow-teal-200"
                            : "bg-white text-warm-500 border border-warm-200 hover:border-teal-300"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-warm-400 mt-2">
                    {FORMATS.find((f) => f.id === buildFormat)?.desc}
                  </p>
                </section>

                {/* Conditional: Rounds */}
                {buildShowRounds && (
                  <section className="mt-6">
                    <div className="flex items-baseline justify-between mb-3">
                      <label className="text-sm font-semibold text-warm-700">
                        Rounds
                      </label>
                      <span className="text-2xl font-bold text-teal-700">
                        {buildRounds}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={10}
                      step={1}
                      value={buildRounds}
                      onChange={(e) => setBuildRounds(Number(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-warm-400 mt-1">
                      <span>2</span>
                      <span>10</span>
                    </div>
                  </section>
                )}

                {/* Conditional: Windows */}
                {buildShowWindows && (
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <section>
                      <div className="flex items-baseline justify-between mb-2">
                        <label className="text-sm font-semibold text-warm-700">
                          Window
                        </label>
                        <span className="text-lg font-bold text-teal-700">
                          {buildWindowMinutes}
                          <span className="text-xs font-normal text-warm-400 ml-0.5">
                            min
                          </span>
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={buildWindowMinutes}
                        onChange={(e) =>
                          setBuildWindowMinutes(Number(e.target.value))
                        }
                        className="w-full"
                      />
                    </section>
                    <section>
                      <div className="flex items-baseline justify-between mb-2">
                        <label className="text-sm font-semibold text-warm-700">
                          Repeats
                        </label>
                        <span className="text-lg font-bold text-teal-700">
                          {buildWindowRounds}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={10}
                        step={1}
                        value={buildWindowRounds}
                        onChange={(e) =>
                          setBuildWindowRounds(Number(e.target.value))
                        }
                        className="w-full"
                      />
                    </section>
                  </div>
                )}

                {/* Effort */}
                <section className="mt-6">
                  <div className="flex items-baseline justify-between mb-3">
                    <label className="text-sm font-semibold text-warm-700">
                      Effort
                    </label>
                    <span className="text-sm font-medium text-teal-700">
                      {EFFORT_LABELS[buildEffort]}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        onClick={() => setBuildEffort(level)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                          buildEffort === level
                            ? "bg-teal-600 text-white shadow-md shadow-teal-200"
                            : "bg-white text-warm-500 border border-warm-200 hover:border-teal-300"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Duration */}
                <section className="mt-6">
                  <div className="flex items-baseline justify-between mb-3">
                    <label className="text-sm font-semibold text-warm-700">
                      Duration
                    </label>
                    <span className="text-2xl font-bold text-teal-700">
                      {buildDuration}
                      <span className="text-sm font-normal text-warm-400 ml-1">
                        min
                      </span>
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    step={5}
                    value={buildDuration}
                    onChange={(e) => setBuildDuration(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-warm-400 mt-1">
                    <span>10 min</span>
                    <span>90 min</span>
                  </div>
                </section>

                <button
                  onClick={() => setBuildStep("pick")}
                  className="mt-5 text-sm text-warm-400 hover:text-warm-600 transition-colors"
                >
                  ← Back to exercises
                </button>

                {/* Build workout button */}
                <button
                  onClick={submitBuildWorkout}
                  disabled={buildLoading}
                  className={`mt-4 w-full py-4 rounded-2xl text-base font-bold transition-all duration-200 ${
                    buildLoading
                      ? "bg-warm-200 text-warm-400 cursor-not-allowed"
                      : "bg-teal-600 text-white shadow-lg shadow-teal-200 hover:bg-teal-700 active:scale-[0.98]"
                  }`}
                >
                  {buildLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Building...
                    </span>
                  ) : (
                    "Build workout"
                  )}
                </button>

                {buildError && (
                  <div className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-200">
                    <p className="text-sm text-red-600">{buildError}</p>
                  </div>
                )}
              </>
            )}

            {/* Step: output */}
            {buildStep === "output" && buildWorkout && (
              <>
                <WorkoutOutput
                  workout={buildWorkout}
                  effort={buildEffort}
                  onShuffle={submitBuildWorkout}
                  loading={buildLoading}
                />
                <button
                  onClick={() => {
                    setBuildStep("configure");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="mt-4 w-full py-3 rounded-2xl text-sm font-semibold text-warm-500 bg-warm-100 hover:bg-warm-200 active:scale-[0.98] transition-all duration-200"
                >
                  ← Back to configuration
                </button>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
