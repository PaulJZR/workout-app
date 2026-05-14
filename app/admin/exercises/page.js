"use client";

import { useState, useEffect } from "react";
import { db } from "../../../lib/firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  orderBy,
  query,
} from "firebase/firestore";

// ── Constants ────────────────────────────────────────────────────────────────

const PATTERNS = ["push", "pull", "squat", "hinge", "core", "conditioning", "carry"];
const EQUIPMENT = ["bodyweight", "kettlebell", "pullup_bar", "rings", "parallettes", "box", "bench"];
const MEASURES = ["reps", "seconds"];
const REP_UNITS = ["total", "each_side", "alternating_total", "steps_total", "seconds_each_side"];
const IMPACT_LEVELS = ["low", "medium", "high"];
const SKILL_LEVELS = ["low", "medium", "high"];
const SPACE_REQUIRED = ["small", "medium", "large"];

const EMPTY_EXERCISE = {
  id: "",
  name: "",
  primary_pattern: "push",
  patterns: ["push"],
  required_equipment: "bodyweight",
  optional_equipment: [],
  difficulty: 3,
  measure: "reps",
  rep_unit: "total",
  time_per_unit_seconds: 2.5,
  rep_low: 8,
  rep_high: 12,
  unilateral: false,
  transition_cost: 2,
  impact_level: "low",
  skill_level: "low",
  space_required: "small",
  variation_of: "",
  notes: "",
  active: true,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function difficultyLabel(d) {
  return ["", "Beginner", "Easy", "Moderate", "Hard", "Elite"][d] ?? d;
}

function patternColor(p) {
  const colors = {
    push: "bg-blue-100 text-blue-700",
    pull: "bg-purple-100 text-purple-700",
    squat: "bg-orange-100 text-orange-700",
    hinge: "bg-yellow-100 text-yellow-700",
    core: "bg-green-100 text-green-700",
    conditioning: "bg-red-100 text-red-700",
    carry: "bg-pink-100 text-pink-700",
  };
  return colors[p] ?? "bg-gray-100 text-gray-700";
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Badge({ label, color }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {label}
    </span>
  );
}

function MultiSelect({ label, options, selected, onChange }) {
  function toggle(val) {
    onChange(
      selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]
    );
  }
  return (
    <div>
      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-all ${
              selected.includes(opt)
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white text-stone-500 border-stone-200 hover:border-teal-400"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white";

// ── Exercise Form ────────────────────────────────────────────────────────────

function ExerciseForm({ initial, allExercises, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isNew = !initial.id || initial.id === "";

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleNameChange(e) {
    const name = e.target.value;
    set("name", name);
    if (isNew) set("id", generateId(name));
  }

  async function handleSave() {
    setError(null);
    if (!form.id) return setError("ID is required");
    if (!form.name) return setError("Name is required");
    if (form.patterns.length === 0) return setError("At least one pattern is required");
    if (form.rep_low > form.rep_high) return setError("Rep low must be ≤ rep high");

    setSaving(true);
    try {
      await setDoc(doc(db, "exercises", form.id), form);
      onSave(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl px-6 pt-6 pb-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-stone-900">
            {isNew ? "New exercise" : `Edit: ${initial.name}`}
          </h2>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Name + ID */}
          <Field label="Exercise name">
            <input
              className={inputClass}
              value={form.name}
              onChange={handleNameChange}
              placeholder="e.g. Kettlebell swing"
            />
          </Field>

          <Field label="ID (auto-generated, must be unique)">
            <input
              className={inputClass}
              value={form.id}
              onChange={(e) => set("id", e.target.value.toLowerCase().replace(/\s/g, "_"))}
              placeholder="e.g. kb_swing"
              disabled={!isNew}
            />
          </Field>

          {/* Patterns */}
          <MultiSelect
            label="Patterns"
            options={PATTERNS}
            selected={form.patterns}
            onChange={(val) => {
              set("patterns", val);
              if (!val.includes(form.primary_pattern)) {
                set("primary_pattern", val[0] ?? "push");
              }
            }}
          />

          <Field label="Primary pattern">
            <select
              className={inputClass}
              value={form.primary_pattern}
              onChange={(e) => set("primary_pattern", e.target.value)}
            >
              {form.patterns.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>

          {/* Equipment */}
          <Field label="Required equipment">
            <select
              className={inputClass}
              value={form.required_equipment}
              onChange={(e) => set("required_equipment", e.target.value)}
            >
              {EQUIPMENT.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </Field>

          <MultiSelect
            label="Optional equipment"
            options={EQUIPMENT}
            selected={form.optional_equipment}
            onChange={(val) => set("optional_equipment", val)}
          />

          {/* Difficulty */}
          <Field label={`Difficulty — ${difficultyLabel(form.difficulty)}`}>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set("difficulty", d)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                    form.difficulty === d
                      ? "bg-teal-600 text-white"
                      : "bg-stone-100 text-stone-400 hover:bg-stone-200"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>

          {/* Measure + Rep unit */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Measure">
              <select
                className={inputClass}
                value={form.measure}
                onChange={(e) => set("measure", e.target.value)}
              >
                {MEASURES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Rep unit">
              <select
                className={inputClass}
                value={form.rep_unit}
                onChange={(e) => set("rep_unit", e.target.value)}
              >
                {REP_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Rep range */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Rep low">
              <input
                className={inputClass}
                type="number"
                value={form.rep_low}
                onChange={(e) => set("rep_low", Number(e.target.value))}
              />
            </Field>
            <Field label="Rep high">
              <input
                className={inputClass}
                type="number"
                value={form.rep_high}
                onChange={(e) => set("rep_high", Number(e.target.value))}
              />
            </Field>
            <Field label="Sec/unit">
              <input
                className={inputClass}
                type="number"
                step="0.5"
                value={form.time_per_unit_seconds}
                onChange={(e) => set("time_per_unit_seconds", Number(e.target.value))}
              />
            </Field>
          </div>

          {/* Misc */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Impact level">
              <select
                className={inputClass}
                value={form.impact_level}
                onChange={(e) => set("impact_level", e.target.value)}
              >
                {IMPACT_LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Skill level">
              <select
                className={inputClass}
                value={form.skill_level}
                onChange={(e) => set("skill_level", e.target.value)}
              >
                {SKILL_LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Space required">
              <select
                className={inputClass}
                value={form.space_required}
                onChange={(e) => set("space_required", e.target.value)}
              >
                {SPACE_REQUIRED.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Transition cost (1–3)">
              <input
                className={inputClass}
                type="number"
                min={1}
                max={3}
                value={form.transition_cost}
                onChange={(e) => set("transition_cost", Number(e.target.value))}
              />
            </Field>
          </div>

          {/* Toggles */}
          <div className="flex gap-6">
            {[
              { key: "unilateral", label: "Unilateral" },
              { key: "active", label: "Active" },
            ].map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => set(key, !form[key])}
              >
                <div
                  className={`w-10 h-6 rounded-full transition-all ${
                    form[key] ? "bg-teal-600" : "bg-stone-200"
                  } relative`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                      form[key] ? "left-5" : "left-1"
                    }`}
                  />
                </div>
                <span className="text-sm text-stone-700">{label}</span>
              </label>
            ))}
          </div>

          {/* Variation of */}
          <Field label="Variation of (exercise id)">
            <input
              className={inputClass}
              value={form.variation_of}
              onChange={(e) => set("variation_of", e.target.value)}
              placeholder="e.g. pushup"
              list="exercise-ids"
            />
            <datalist id="exercise-ids">
              {allExercises.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </datalist>
          </Field>

          {/* Notes */}
          <Field label="Notes">
            <textarea
              className={`${inputClass} h-20 resize-none`}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Any coaching notes..."
            />
          </Field>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white rounded-b-3xl px-6 py-4 border-t border-stone-100 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold text-stone-500 bg-stone-100 hover:bg-stone-200 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-all"
          >
            {saving ? "Saving..." : "Save exercise"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AdminExercisesPage() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterPattern, setFilterPattern] = useState("all");
  const [filterEquipment, setFilterEquipment] = useState("all");
  const [editingExercise, setEditingExercise] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  async function loadExercises() {
    setLoading(true);
    setLoadError(null);
    try {
      const q = query(collection(db, "exercises"), orderBy("name"));
      const snap = await getDocs(q);
      setExercises(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExercises();
  }, []);

  function handleSaved(exercise) {
    setExercises((prev) => {
      const idx = prev.findIndex((e) => e.id === exercise.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = exercise;
        return next;
      }
      return [...prev, exercise].sort((a, b) => a.name.localeCompare(b.name));
    });
    setEditingExercise(null);
    setIsAdding(false);
  }

  async function handleDelete(id) {
    try {
      await deleteDoc(doc(db, "exercises", id));
      setExercises((prev) => prev.filter((e) => e.id !== id));
      setDeleteConfirm(null);
      setDeleteError(null);
    } catch (err) {
      setDeleteError(err.message);
    }
  }

  const filtered = exercises.filter((ex) => {
    const matchSearch =
      search === "" ||
      ex.name.toLowerCase().includes(search.toLowerCase()) ||
      ex.id.toLowerCase().includes(search.toLowerCase());
    const matchPattern =
      filterPattern === "all" ||
      (Array.isArray(ex.patterns)
        ? ex.patterns.includes(filterPattern)
        : ex.primary_pattern === filterPattern);
    const matchEquipment =
      filterEquipment === "all" || ex.required_equipment === filterEquipment;
    return matchSearch && matchPattern && matchEquipment;
  });

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Exercise Catalogue</h1>
            <p className="text-xs text-stone-400 mt-0.5">
              {exercises.length} exercises · {exercises.filter((e) => e.active).length} active
            </p>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-all shadow-sm shadow-teal-200"
          >
            <span className="text-lg leading-none">+</span> Add
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 space-y-4">
        {/* Search + filters */}
        <div className="space-y-3">
          <input
            className="w-full px-4 py-3 rounded-2xl border border-stone-200 bg-white text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {["all", ...PATTERNS].map((p) => (
              <button
                key={p}
                onClick={() => setFilterPattern(p)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  filterPattern === p
                    ? "bg-stone-800 text-white"
                    : "bg-white text-stone-500 border border-stone-200 hover:border-stone-400"
                }`}
              >
                {p === "all" ? "All patterns" : p}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {["all", ...EQUIPMENT].map((e) => (
              <button
                key={e}
                onClick={() => setFilterEquipment(e)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  filterEquipment === e
                    ? "bg-stone-800 text-white"
                    : "bg-white text-stone-500 border border-stone-200 hover:border-stone-400"
                }`}
              >
                {e === "all" ? "All equipment" : e}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        {search || filterPattern !== "all" || filterEquipment !== "all" ? (
          <p className="text-xs text-stone-400">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </p>
        ) : null}

        {/* Exercise list */}
        {loading ? (
          <div className="text-center py-20 text-stone-400 text-sm">Loading...</div>
        ) : loadError ? (
          <div className="text-center py-20 text-sm text-red-500">{loadError}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-stone-400 text-sm">No exercises found</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((ex) => (
              <div
                key={ex.id}
                className={`bg-white rounded-2xl p-4 border transition-all ${
                  ex.active ? "border-stone-100" : "border-stone-200 opacity-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-stone-900 text-sm">{ex.name}</span>
                      {!ex.active && (
                        <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                          inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">{ex.id}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge
                        label={ex.primary_pattern}
                        color={patternColor(ex.primary_pattern)}
                      />
                      <Badge
                        label={ex.required_equipment}
                        color="bg-stone-100 text-stone-600"
                      />
                      <Badge
                        label={`D${ex.difficulty}`}
                        color="bg-amber-50 text-amber-700"
                      />
                      <Badge
                        label={`${ex.rep_low}–${ex.rep_high} ${ex.measure === "seconds" ? "s" : "reps"}`}
                        color="bg-teal-50 text-teal-700"
                      />
                      {ex.unilateral && (
                        <Badge label="unilateral" color="bg-indigo-50 text-indigo-600" />
                      )}
                    </div>
                    {ex.notes && (
                      <p className="text-xs text-stone-400 mt-1.5 italic">{ex.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setEditingExercise(ex)}
                      className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 text-sm transition-all"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => { setDeleteError(null); setDeleteConfirm(ex.id); }}
                      className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 text-sm transition-all"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add / Edit modal */}
      {(isAdding || editingExercise) && (
        <ExerciseForm
          initial={editingExercise ?? EMPTY_EXERCISE}
          allExercises={exercises}
          onSave={handleSaved}
          onCancel={() => {
            setIsAdding(false);
            setEditingExercise(null);
          }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-stone-900 mb-2">Delete exercise?</h3>
            <p className="text-sm text-stone-500 mb-5">
              This will permanently delete{" "}
              <span className="font-semibold text-stone-700">
                {exercises.find((e) => e.id === deleteConfirm)?.name}
              </span>{" "}
              from Firestore. This cannot be undone.
            </p>
            {deleteError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2 mb-4">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteConfirm(null); setDeleteError(null); }}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold bg-stone-100 text-stone-600 hover:bg-stone-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
