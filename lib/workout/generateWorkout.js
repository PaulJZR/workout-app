import Papa from "papaparse";

/**
 * Tiny workout generator for Paul's CSV schema.
 * - Assumes: measure is "reps" or "seconds"
 * - Assumes: patterns is pipe-separated (e.g. "hinge|conditioning")
 * - Assumes: required_equipment is single token (e.g. "bodyweight", "kettlebell", "rings")
 */


// --- Config you tweak when testing ---
const params = {
  durationMinutes: 30,
  effort: 3,
  equipmentAvailable: new Set(["bodyweight", "kettlebell", "pullup_bar"]),

  // 👇 CHANGE THIS LINE TO SWITCH FORMAT
  format: "amrap", // "emom" | "amrap" | "fixed_rounds" | "for_time" | "fixed_window"

  // used by some formats
  rounds: 4,
  amrapMinutes: 12,
  emomMinutes: 12,
  windowMinutes: 3,
  windowRounds: 4,

  // optional overrides (leave null for auto)
  warmupMinutes: null,   // e.g. 5
  cooldownMinutes: null, // e.g. 3

  // if true, main duration is taken from amrapMinutes/emomMinutes/etc.
  // if false (recommended), main is derived from durationMinutes and the format-specific minutes are ignored/overridden.
  respectExplicitMainMinutes: false,


};

// --- Helpers ---
function parseIntSafe(v, fallback = 0) {
  const n = Number.parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseFloatSafe(v, fallback = 0) {
  const n = Number.parseFloat(String(v ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function splitPipe(v) {
  const s = String(v ?? "").trim();
  if (!s) return [];
  return s.split("|").map(x => x.trim()).filter(Boolean);
}

function hasEquipment(ex, equipmentSet) {
  // required must be available; optional ignored for eligibility
  const req = String(ex.required_equipment ?? "").trim();
  return req === "" || equipmentSet.has(req);
}

function primaryPattern(ex) {
  // Use explicit primary_pattern if present, else first in patterns, else ""
  const p = String(ex.primary_pattern ?? "").trim();
  if (p) return p;
  const tags = splitPipe(ex.patterns);
  return tags[0] ?? "";
}

function pickRepTarget(ex, effort) {
  const low = parseIntSafe(ex.rep_low, 0);
  const high = parseIntSafe(ex.rep_high, low);
  // map effort 1..5 -> 0..1
  const t = Math.max(0, Math.min(1, (effort - 1) / 4));
  return Math.round(low + (high - low) * t);
}

function formatSet(ex, effort) {
  const target = pickRepTarget(ex, effort);
  const measure = String(ex.measure).trim();

  if (measure === "seconds") return `${target}s`;
  return `x${target}`;
}

// Convert an exercise into something the UI can display (name + reps/seconds)
function toMove(ex, effort, mode = "default") {
  return {
    name: ex.name,
    prescription:
      mode === "emom"
        ? pickEmomPrescription(ex, effort)
        : formatSet(ex, effort),
  };
}

function toMoves(list, effort, mode) {
  return list.map(ex => toMove(ex, effort, mode));
}

function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedChoice(items, weightFn) {
  const weights = items.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return randChoice(items);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function scoreExercise(ex, effort, recentlyUsedPatterns) {
  const diff = parseIntSafe(ex.difficulty, 3);
  const pattern = primaryPattern(ex);

  // closeness to effort: best when diff == effort
  const diffPenalty = Math.abs(diff - effort);

  // avoid repeating pattern
  const repeatPenalty = recentlyUsedPatterns.has(pattern) ? 2 : 0;

  // slight preference for simpler transitions when duration is short-ish
  const transition = parseIntSafe(ex.transition_cost, 2); // if blank, assume 2
  const transitionPenalty = params.durationMinutes <= 20 ? Math.max(0, transition - 2) : 0;

  // Higher score = more likely
  const base = 10;
  return Math.max(1, base - diffPenalty * 2 - repeatPenalty * 3 - transitionPenalty * 1.5);
}

function pickByPattern(exercises, patternWanted, effort, usedPatterns) {
  const pool = exercises.filter(ex => splitPipe(ex.patterns).includes(patternWanted) || primaryPattern(ex) === patternWanted);
  if (pool.length === 0) return null;
  return weightedChoice(pool, ex => scoreExercise(ex, effort, usedPatterns));
}

function pickWarmup(eligible, effort) {
  const used = new Set();
  const a = pickByPattern(eligible, "hinge", Math.max(1, effort - 1), used) ?? randChoice(eligible);
  used.add(primaryPattern(a));
  const b = pickByPattern(eligible, "squat", Math.max(1, effort - 1), used) ?? randChoice(eligible);
  return [a, b].filter(Boolean);
}

function pickMainMoves(eligible, effort, patterns) {
  const used = new Set();
  const moves = [];
  for (const p of patterns) {
    const ex = pickByPattern(eligible, p, effort, used);
    if (ex) {
      moves.push(ex);
      used.add(primaryPattern(ex));
    }
  }
  return moves;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function defaultWarmupMinutes(total) {
  if (total <= 15) return 3;
  if (total <= 25) return 4;
  return 5;
}

function defaultCooldownMinutes(total) {
  if (total <= 15) return 0;
  if (total <= 25) return 2;
  return 3;
}

// effort 1..5 => rest share for formats that need explicit rest budgeting
// lower effort => more rest, higher effort => less rest
function restShareForEffort(effort) {
  // 1 -> 0.30, 3 -> 0.20, 5 -> 0.12 (roughly)
  const t = clamp((effort - 1) / 4, 0, 1);
  return 0.30 - t * 0.18;
}

/**
 * Plan the session timing so durationMinutes is the anchor.
 * Returns: { total, warmup, main, cooldown }
 */
function planSessionTiming(params) {
  const total = params.durationMinutes;

  const warmup = params.warmupMinutes ?? defaultWarmupMinutes(total);
  const cooldown = params.cooldownMinutes ?? defaultCooldownMinutes(total);

  const fixedOverhead = warmup + cooldown;
  const mainFromTotal = Math.max(0, total - fixedOverhead);

  // If user explicitly wants "AMRAP 12" inside a 30-min workout, you can either:
  // - respect explicit (main=12, remaining becomes "free time"), OR
  // - override explicit so main always fills the session.
  // The second is what you described as the desired behaviour.
  let main = mainFromTotal;

  if (params.respectExplicitMainMinutes) {
    if (params.format === "amrap") main = clamp(params.amrapMinutes ?? mainFromTotal, 1, mainFromTotal);
    if (params.format === "emom") main = clamp(params.emomMinutes ?? mainFromTotal, 1, mainFromTotal);
    if (params.format === "fixed_window") {
      const windows = params.windowRounds ?? 1;
      const windowMin = params.windowMinutes ?? Math.floor(mainFromTotal / windows);
      main = clamp(windows * windowMin, 1, mainFromTotal);
    }
    // fixed_rounds / for_time don’t have a single “minutes” field here; they’ll consume mainFromTotal.
  }

  return { total, warmup, main, cooldown };
}

/**
 * For formats that benefit from explicit rest budgeting (fixed_rounds / for_time),
 * split main into work + rest based on effort, then distribute rest between rounds.
 */
function planRoundWorkRest(mainMinutes, rounds, effort) {
  const r = clamp(rounds ?? 1, 1, 20);
  if (r === 1) {
    return {
      rounds: 1,
      workPerRoundMin: mainMinutes,
      restBetweenRoundsMin: 0,
      totalWorkMin: mainMinutes,
      totalRestMin: 0,
    };
  }

  const restShare = restShareForEffort(effort);
  const totalRestMin = Math.round(mainMinutes * restShare * 2) / 2; // nearest 0.5
  const totalWorkMin = Math.max(0, mainMinutes - totalRestMin);

  const workPerRoundMin = Math.round((totalWorkMin / r) * 2) / 2; // nearest 0.5
  const restBetweenRoundsMin = Math.round((totalRestMin / (r - 1)) * 2) / 2;

  // re-balance to avoid rounding drift
  const actualWork = workPerRoundMin * r;
  const actualRest = restBetweenRoundsMin * (r - 1);
  const drift = (actualWork + actualRest) - mainMinutes;

  // If we drifted by 0.5-1 min due to rounding, shave from work first.
  const correctedWorkPerRound = Math.max(0.5, workPerRoundMin - Math.round(drift * 2) / 2 / r);

  return {
    rounds: r,
    workPerRoundMin: correctedWorkPerRound,
    restBetweenRoundsMin,
    totalWorkMin: correctedWorkPerRound * r,
    totalRestMin: restBetweenRoundsMin * (r - 1),
  };
}

function parseFloatOrNull(v) {
  const n = Number.parseFloat(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Estimate seconds for a single move at the selected effort.
 * - measure "seconds": uses the target seconds directly
 * - measure "reps": uses reps * time_per_unit_seconds if present
 * Returns: number | null (if cannot estimate)
 */
function estimateMoveSeconds(ex, effort) {
  const measure = String(ex.measure).trim();
  const units = pickRepTarget(ex, effort);

  if (measure === "seconds") {
    return units; // already seconds
  }

  if (measure === "reps") {
    const tpu = parseFloatOrNull(ex.time_per_unit_seconds);
    if (tpu == null) return null;
    return units * tpu;
  }

  return null;
}

function isSecondsMove(ex) {
  return String(ex.measure).trim() === "seconds";
}

/**
 * Scale a mini-circuit so total work fits inside a target time budget (e.g. ~40s).
 * Used by EMOM to ensure exercises fit within each minute.
 */
function scaleEmomRoundToBudget(rawMoves, effort, targetSeconds) {
  // Start from effort-based units (reps or seconds)
  let moves = rawMoves.map(ex => ({
    ex,
    units: pickRepTarget(ex, effort),
  }));

  // Cap time-based holds so they don't dominate the whole minute
  moves = moves.map(m => {
    if (isSecondsMove(m.ex)) {
      const cap = Math.min(m.units, Math.floor(targetSeconds * 0.5));
      return { ...m, units: Math.max(10, cap) };
    }
    return m;
  });

  // Estimate how long the whole mini-circuit takes
  const estimateTotalSeconds = (ms) => {
    let total = 0;
    for (const m of ms) {
      if (isSecondsMove(m.ex)) {
        total += m.units;
      } else {
        const tpu = parseFloatOrNull(m.ex.time_per_unit_seconds);
        if (tpu == null || tpu <= 0) return null;
        total += m.units * tpu;
      }
    }
    total += ms.length * 2; // small transition allowance
    return total;
  };

  let total = estimateTotalSeconds(moves);

  // If we can't estimate, fall back to simple prescriptions
  if (total == null || total <= 0) {
    return moves.map(m => ({
      name: m.ex.name,
      prescription: isSecondsMove(m.ex) ? `${Math.min(30, m.units)}s` : `x${m.units}`,
    }));
  }

  // Scale down if too long
  const ratio = Math.min(1, targetSeconds / total);

  const scaled = moves.map(m => {
    if (isSecondsMove(m.ex)) {
      return { ...m, units: Math.max(10, Math.floor(m.units * ratio)) };
    }
    return { ...m, units: Math.max(1, Math.floor(m.units * ratio)) };
  });

  // Clamp reps to CSV bounds and apply sensible rounding
  return scaled.map(m => {
    if (isSecondsMove(m.ex)) {
      const s = clamp(m.units, 10, Math.min(40, targetSeconds));
      return { name: m.ex.name, prescription: `${s}s` };
    }

    const low = parseIntSafe(m.ex.rep_low, 1);
    const high = parseIntSafe(m.ex.rep_high, m.units);
    let reps = clamp(m.units, low, high);

    const nm = String(m.ex.name ?? "").toLowerCase();
    if (nm.includes("swing")) reps = Math.max(5, Math.round(reps / 5) * 5);
    if (nm.includes("press-up") || nm.includes("push-up") || nm.includes("push up"))
      reps = Math.max(2, Math.round(reps / 2) * 2);

    reps = Math.max(1, reps);
    return { name: m.ex.name, prescription: `x${reps}` };
  });
}

/**
 * EMOM needs reps that fit inside ~45 seconds of work.
 * Uses time_per_unit_seconds when available; otherwise falls back to formatSet.
 */
function pickEmomPrescription(ex, effort) {
  const measure = String(ex.measure).trim();
  const WORK_SECONDS = 45;

  if (measure === "seconds") {
    const target = pickRepTarget(ex, effort);
    return `${Math.min(WORK_SECONDS, target)}s`;
  }

  const tpu = parseFloatOrNull(ex.time_per_unit_seconds);
  if (tpu == null || tpu <= 0) {
    return formatSet(ex, effort);
  }

  const rawReps = Math.floor(WORK_SECONDS / tpu);
  const low = parseIntSafe(ex.rep_low, 1);
  const high = parseIntSafe(ex.rep_high, rawReps);
  const reps = clamp(rawReps, low, high);

  return `x${reps}`;
}

/**
 * Estimate a full AMRAP round (one pass through the moves list).
 * Adds a small transition/setup cost per move.
 */
function estimateRoundSeconds(moves, effort) {
  let total = 0;
  let unknowns = 0;

  for (const ex of moves) {
    const s = estimateMoveSeconds(ex, effort);
    if (s == null) unknowns++;
    else total += s;
  }

  // conservative transition allowance (seconds per move)
  const transitionPerMove = moves.reduce((acc, ex) => {
    const tc = parseIntSafe(ex.transition_cost, 2);
    return acc + clamp(tc, 0, 10);
  }, 0);

  total += transitionPerMove;

  return { totalSeconds: total, unknowns };
}

/**
 * Turn an estimated round duration into a friendly pacing suggestion.
 * Only returns a string if estimate quality is good enough.
 */
function amrapPacingSuggestion(amrapMinutes, moves, effort) {
  const { totalSeconds, unknowns } = estimateRoundSeconds(moves, effort);

  // If we can't estimate at least most moves, don't pretend.
  // Allow 0 unknowns always; allow 1 unknown if there are 4+ moves.
  const allowUnknowns = moves.length >= 4 ? 1 : 0;
  if (unknowns > allowUnknowns) return null;
  if (totalSeconds <= 0) return null;

  const mainSeconds = amrapMinutes * 60;
  const estRounds = mainSeconds / totalSeconds;

  // show a range rather than false precision
  const low = Math.max(1, Math.floor(estRounds));
  const high = Math.max(low, Math.ceil(estRounds));

  // format mm:ss for round time
  const mm = Math.floor(totalSeconds / 60);
  const ss = Math.round(totalSeconds % 60);
  const mmss = `${mm}:${String(ss).padStart(2, "0")}`;

  // if low==high, still show a "≈N rounds" phrasing
  const roundsStr = low === high ? `~${low}` : `~${low}–${high}`;

  return `Target pacing: ${roundsStr} rounds (≈${mmss} per round)`;
}

// --- Format Builders ---

function buildAMRAP(eligible, params, timing) {
  const rawMoves = pickMainMoves(eligible, params.effort, ["push", "pull", "hinge", "core"]);
  const pacing = amrapPacingSuggestion(timing.main, rawMoves, params.effort);

  return {
    title: `AMRAP ${timing.main} min`,
    timing,
    warmup: toMoves(pickWarmup(eligible, params.effort), Math.max(1, params.effort - 1)),
    blocks: [
      {
        type: "amrap",
        minutes: timing.main,
        pacing,
        moves: toMoves(rawMoves, params.effort),
      }
    ]
  };
}

function buildEMOM(eligible, params, timing) {
  // pick a small mini-circuit to repeat every minute
  const rawMoves = pickMainMoves(eligible, params.effort, ["push", "pull", "hinge"]);

  // target work time per minute
  const TARGET_WORK_SECONDS_BY_EFFORT = { 1: 35, 2: 38, 3: 40, 4: 43, 5: 45 };
  const targetSeconds = TARGET_WORK_SECONDS_BY_EFFORT[params.effort] ?? 40;

  const emomRound = scaleEmomRoundToBudget(rawMoves, params.effort, targetSeconds);

  return {
    title: `EMOM ${timing.main} min`,
    timing,
    warmup: toMoves(pickWarmup(eligible, params.effort), Math.max(1, params.effort - 1)),
    blocks: [
      {
        type: "emom",
        minutes: timing.main,
        note: `Repeat this round every minute. Aim to finish in ~${targetSeconds}s; rest the remainder.`,
        moves: emomRound,
      }
    ]
  };
}

function buildForTime(eligible, params, timing) {
  const roundPlan = planRoundWorkRest(timing.main, params.rounds, params.effort);

  return {
    title: `For time — ${roundPlan.rounds} rounds`,
    timing,
    warmup: toMoves(pickWarmup(eligible, params.effort), Math.max(1, params.effort - 1)),
    blocks: [
      {
        type: "for_time",
        rounds: roundPlan.rounds,
        workPerRoundMin: roundPlan.workPerRoundMin,
        restBetweenRoundsMin: roundPlan.restBetweenRoundsMin,
        totalWorkMin: roundPlan.totalWorkMin,
        totalRestMin: roundPlan.totalRestMin,
        moves: toMoves(
          pickMainMoves(eligible, params.effort, ["push", "pull", "hinge", "squat"]),
          params.effort
        ),
      }
    ]
  };
}

function buildFixedRounds(eligible, params, timing) {
  const roundPlan = planRoundWorkRest(timing.main, params.rounds, params.effort);

  return {
    title: `Fixed rounds — ${roundPlan.rounds} rounds`,
    timing,
    warmup: toMoves(pickWarmup(eligible, params.effort), Math.max(1, params.effort - 1)),
    blocks: [
      {
        type: "rounds",
        rounds: roundPlan.rounds,
        workPerRoundMin: roundPlan.workPerRoundMin,
        restBetweenRoundsMin: roundPlan.restBetweenRoundsMin,
        totalWorkMin: roundPlan.totalWorkMin,
        totalRestMin: roundPlan.totalRestMin,
        moves: toMoves(
          pickMainMoves(eligible, params.effort, ["push", "pull", "squat", "core"]),
          params.effort
        ),
      }
    ]
  };
}

function buildFixedWindow(eligible, params, timing) {
  const windows = clamp(params.windowRounds ?? 4, 1, 20);
  const windowMinutes = Math.max(1, Math.floor(timing.main / windows));
  const actualMain = windows * windowMinutes;

  // If rounding leaves 1-2 mins spare, you can treat it as “extra rest/setup”.
  const spare = timing.main - actualMain;

  return {
    title: `${windows} × ${windowMinutes} min windows`,
    timing,
    warmup: toMoves(pickWarmup(eligible, params.effort), Math.max(1, params.effort - 1)),
    blocks: [
      {
        type: "fixed_window",
        windows,
        windowMinutes,
        spareMinutes: spare,
        moves: toMoves(
          pickMainMoves(eligible, params.effort, ["push", "pull", "core"]),
          params.effort
        ),
      }
    ]
  };
}

function printWorkout(workout, params) {
  const t = workout.timing;

  console.log("");
  console.log(`Workout (${t.total} min) — effort ${params.effort}/5`);
  console.log(`Format: ${workout.title}`);
  console.log(`Equipment: ${[...params.equipmentAvailable].join(", ")}`);
  console.log(`Timing: warm-up ${t.warmup} + main ${t.main} + cool-down ${t.cooldown} = ${t.total} min`);
  console.log("");

  if (t.warmup > 0) {
    console.log(`Warm-up (~${t.warmup} min):`);
    for (const ex of workout.warmup) {
      console.log(`- ${ex.name}: ${formatSet(ex, Math.max(1, params.effort - 1))}`);
    }
    console.log("");
  }

  for (const block of workout.blocks) {
    if (block.type === "rounds") {
      console.log(`Main: ${block.rounds} rounds (target work ~${block.workPerRoundMin} min/round)`);
      if (block.rounds > 1) console.log(`Rest: ~${block.restBetweenRoundsMin} min between rounds (total rest ~${block.totalRestMin} min)`);
      for (const ex of block.moves) console.log(`- ${ex.name}: ${formatSet(ex, params.effort)}`);
      console.log("");
    }

if (block.type === "amrap") {
  console.log(`Main: AMRAP ${block.minutes} min (quality rounds)`);
  if (block.pacing) console.log(block.pacing);
  console.log(`Pacing note: aim for consistent rounds; rest is “as needed” inside the ${block.minutes} minutes.`);
  for (const ex of block.moves) console.log(`- ${ex.name}: ${formatSet(ex, params.effort)}`);
  console.log("");
}

    if (block.type === "emom") {
      console.log(`Main: EMOM ${block.minutes} min`);
      if (block.note) console.log(block.note);
      for (const ex of block.moves) {
        console.log(`- ${ex.name}: ${ex.prescription}`);
      }
      console.log("");
    }

    if (block.type === "for_time") {
      console.log(`Main: For time — ${block.rounds} rounds (move fast, stay clean)`);
      if (block.rounds > 1) console.log(`Built-in rest suggestion: ~${block.restBetweenRoundsMin} min between rounds (dynamic by effort)`);
      for (const ex of block.moves) console.log(`- ${ex.name}: ${formatSet(ex, params.effort)}`);
      console.log("");
    }

    if (block.type === "fixed_window") {
      console.log(`Main: ${block.windows} × ${block.windowMinutes} min windows`);
      console.log("Complete the listed work inside each window; rest the remainder.");
      if (block.spareMinutes > 0) console.log(`Spare time: ${block.spareMinutes} min (setup / transition / extra rest)`);
      for (const ex of block.moves) console.log(`- ${ex.name}: ${formatSet(ex, params.effort)}`);
      console.log("");
    }
  }

  if (t.cooldown > 0) {
    console.log(`Cool-down (~${t.cooldown} min):`);
    console.log("- Easy breathing + stretch what’s tight (hips/hamstrings/shoulders).");
    console.log("");
  }
}

// ✅ Exported function for the Next.js UI to call
export function generateWorkoutFromCsvText(csvText, uiParams) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    delimiter: ",",
  });

  if (parsed.errors?.length) {
    // For UI use: return the errors rather than console.warn
    return { error: "CSV parse warnings", details: parsed.errors };
  }

  const all = parsed.data.map(row => ({
    ...row,
    patterns: String(row.patterns ?? "").trim(),
    required_equipment: String(row.required_equipment ?? "").trim(),
    optional_equipment: String(row.optional_equipment ?? "").trim(),
    measure: String(row.measure ?? "").trim(),
    time_per_unit_seconds: String(row.time_per_unit_seconds ?? "").trim(),
  }));

  // UI sends equipment as an array, but your logic expects a Set
  const equipmentSet = new Set(uiParams.equipmentAvailable ?? []);
  const eligible = all.filter(ex => hasEquipment(ex, equipmentSet));

  if (eligible.length < 6) {
    return { error: "Not enough eligible exercises after equipment filtering.", eligibleCount: eligible.length };
  }

  const timing = planSessionTiming(uiParams);

  switch (uiParams.format) {
    case "emom":
      return buildEMOM(eligible, uiParams, timing);
    case "amrap":
      return buildAMRAP(eligible, uiParams, timing);
    case "for_time":
      return buildForTime(eligible, uiParams, timing);
    case "fixed_window":
      return buildFixedWindow(eligible, uiParams, timing);
    case "fixed_rounds":
    default:
      return buildFixedRounds(eligible, uiParams, timing);
  }
}

