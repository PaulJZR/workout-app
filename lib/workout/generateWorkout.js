import Papa from "papaparse";

// --- Helpers ---
function parseIntSafe(v, fallback = 0) {
  const n = Number.parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}


function splitPipe(v) {
  const s = String(v ?? "").trim();
  if (!s) return [];
  return s.split("|").map(x => x.trim()).filter(Boolean);
}

function hasEquipment(ex, equipmentSet) {
  const req = String(ex.required_equipment ?? "").trim();
  return req === "" || equipmentSet.has(req);
}

function primaryPattern(ex) {
  const p = String(ex.primary_pattern ?? "").trim();
  if (p) return p;
  const tags = splitPipe(ex.patterns);
  return tags[0] ?? "";
}

function pickRepTarget(ex, effort) {
  const low = parseIntSafe(ex.rep_low, 0);
  const high = parseIntSafe(ex.rep_high, low);
  const t = Math.max(0, Math.min(1, (effort - 1) / 4));
  return Math.round(low + (high - low) * t);
}

function formatPrescription(ex, effort) {
  const target = pickRepTarget(ex, effort);
  const measure = String(ex.measure).trim();
  const repUnit = String(ex.rep_unit ?? "total").trim();

  if (measure === "seconds") {
    if (repUnit === "seconds_each_side") return `${target}s each side`;
    return `${target}s`;
  }

  switch (repUnit) {
    case "each_side":        return `x${target} each side`;
    case "alternating_total": return `x${target} alt`;
    case "steps_total":      return `x${target} steps`;
    default:                 return `x${target}`;
  }
}

function toMove(ex, effort, mode = "default") {
  return {
    name: ex.name,
    prescription:
      mode === "emom"
        ? pickEmomPrescription(ex, effort)
        : formatPrescription(ex, effort),
  };
}

function toMoves(list, effort, mode) {
  return list.map(ex => toMove(ex, effort, mode));
}

function resolvePinnedMoves(pinnedExercises, effort, mode = "default") {
  if (!pinnedExercises || pinnedExercises.length === 0) return null;
  return pinnedExercises.map(ex => toMove(ex, effort, mode));
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

function scoreExercise(ex, effort, recentlyUsedPatterns, durationMinutes) {
  const diff = parseIntSafe(ex.difficulty, 3);
  const pattern = primaryPattern(ex);

  const diffPenalty = Math.abs(diff - effort);
  const repeatPenalty = recentlyUsedPatterns.has(pattern) ? 2 : 0;

  const transition = parseIntSafe(ex.transition_cost, 2);
  const transitionPenalty = durationMinutes <= 20 ? Math.max(0, transition - 2) : 0;

  const base = 10;
  return Math.max(1, base - diffPenalty * 2 - repeatPenalty * 3 - transitionPenalty * 1.5);
}

function variationRoot(ex) {
  const v = String(ex.variation_of ?? "").trim();
  return v || ex.id;
}

function pickByPattern(exercises, patternWanted, effort, usedPatterns, durationMinutes, excludedVarGroups = new Set()) {
  const pool = exercises.filter(ex => {
    if (!splitPipe(ex.patterns).includes(patternWanted) && primaryPattern(ex) !== patternWanted) return false;
    return !excludedVarGroups.has(variationRoot(ex)) && !excludedVarGroups.has(ex.id);
  });
  if (pool.length === 0) return null;
  return weightedChoice(pool, ex => scoreExercise(ex, effort, usedPatterns, durationMinutes));
}

function pickWarmup(eligible, effort, durationMinutes) {
  const used = new Set();
  const a = pickByPattern(eligible, "hinge", Math.max(1, effort - 1), used, durationMinutes) ?? randChoice(eligible);
  used.add(primaryPattern(a));
  const b = pickByPattern(eligible, "squat", Math.max(1, effort - 1), used, durationMinutes) ?? randChoice(eligible);
  return [a, b].filter(Boolean);
}

function pickMainMoves(eligible, effort, patterns, durationMinutes) {
  const used = new Set();
  const varGroups = new Set();
  const moves = [];
  for (const p of patterns) {
    const ex = pickByPattern(eligible, p, effort, used, durationMinutes, varGroups);
    if (ex) {
      moves.push(ex);
      used.add(primaryPattern(ex));
      varGroups.add(ex.id);
      varGroups.add(variationRoot(ex));
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

// effort 1..5 => rest share for formats that need explicit rest budgeting
function restShareForEffort(effort) {
  const t = clamp((effort - 1) / 4, 0, 1);
  return 0.30 - t * 0.18;
}

function planSessionTiming(params) {
  const total = params.durationMinutes;

  const warmup = params.warmupMinutes ?? defaultWarmupMinutes(total);
  const mainFromTotal = Math.max(0, total - warmup);

  let main = mainFromTotal;

  if (params.respectExplicitMainMinutes) {
    if (params.format === "amrap") main = clamp(params.amrapMinutes ?? mainFromTotal, 1, mainFromTotal);
    if (params.format === "emom") main = clamp(params.emomMinutes ?? mainFromTotal, 1, mainFromTotal);
    if (params.format === "fixed_window") {
      const windows = params.windowRounds ?? 1;
      const windowMin = params.windowMinutes ?? Math.floor(mainFromTotal / windows);
      main = clamp(windows * windowMin, 1, mainFromTotal);
    }
  }

  return { total, warmup, main };
}

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
  const totalRestMin = Math.round(mainMinutes * restShare * 2) / 2;
  const totalWorkMin = Math.max(0, mainMinutes - totalRestMin);

  const workPerRoundMin = Math.round((totalWorkMin / r) * 2) / 2;
  const restBetweenRoundsMin = Math.round((totalRestMin / (r - 1)) * 2) / 2;

  const actualWork = workPerRoundMin * r;
  const actualRest = restBetweenRoundsMin * (r - 1);
  const drift = (actualWork + actualRest) - mainMinutes;

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

function estimateMoveSeconds(ex, effort) {
  const measure = String(ex.measure).trim();
  const units = pickRepTarget(ex, effort);

  if (measure === "seconds") return units;

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

function scaleEmomRoundToBudget(rawMoves, effort, targetSeconds) {
  let moves = rawMoves.map(ex => ({
    ex,
    units: pickRepTarget(ex, effort),
  }));

  moves = moves.map(m => {
    if (isSecondsMove(m.ex)) {
      const cap = Math.min(m.units, Math.floor(targetSeconds * 0.5));
      return { ...m, units: Math.max(10, cap) };
    }
    return m;
  });

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
    total += ms.length * 2;
    return total;
  };

  let total = estimateTotalSeconds(moves);

  function emomRepLabel(ex, reps) {
    const repUnit = String(ex.rep_unit ?? "total").trim();
    switch (repUnit) {
      case "each_side":        return `x${reps} each side`;
      case "alternating_total": return `x${reps} alt`;
      case "steps_total":      return `x${reps} steps`;
      default:                 return `x${reps}`;
    }
  }

  if (total == null || total <= 0) {
    return moves.map(m => ({
      name: m.ex.name,
      prescription: isSecondsMove(m.ex)
        ? (String(m.ex.rep_unit ?? "").trim() === "seconds_each_side"
            ? `${Math.min(30, m.units)}s each side`
            : `${Math.min(30, m.units)}s`)
        : emomRepLabel(m.ex, m.units),
    }));
  }

  const ratio = Math.min(1, targetSeconds / total);

  const scaled = moves.map(m => {
    if (isSecondsMove(m.ex)) {
      return { ...m, units: Math.max(10, Math.floor(m.units * ratio)) };
    }
    return { ...m, units: Math.max(1, Math.floor(m.units * ratio)) };
  });

  return scaled.map(m => {
    if (isSecondsMove(m.ex)) {
      const s = clamp(m.units, 10, Math.min(40, targetSeconds));
      const repUnit = String(m.ex.rep_unit ?? "").trim();
      return {
        name: m.ex.name,
        prescription: repUnit === "seconds_each_side" ? `${s}s each side` : `${s}s`,
      };
    }

    const low = parseIntSafe(m.ex.rep_low, 1);
    const high = parseIntSafe(m.ex.rep_high, m.units);
    let reps = clamp(m.units, low, high);

    const nm = String(m.ex.name ?? "").toLowerCase();
    if (nm.includes("swing")) reps = Math.max(5, Math.round(reps / 5) * 5);
    if (nm.includes("press-up") || nm.includes("push-up") || nm.includes("push up"))
      reps = Math.max(2, Math.round(reps / 2) * 2);

    reps = Math.max(1, reps);
    return { name: m.ex.name, prescription: emomRepLabel(m.ex, reps) };
  });
}

function pickEmomPrescription(ex, effort) {
  const measure = String(ex.measure).trim();
  const repUnit = String(ex.rep_unit ?? "total").trim();
  const WORK_SECONDS = 45;

  if (measure === "seconds") {
    const target = pickRepTarget(ex, effort);
    const capped = Math.min(WORK_SECONDS, target);
    if (repUnit === "seconds_each_side") return `${capped}s each side`;
    return `${capped}s`;
  }

  const tpu = parseFloatOrNull(ex.time_per_unit_seconds);
  if (tpu == null || tpu <= 0) {
    return formatPrescription(ex, effort);
  }

  const rawReps = Math.floor(WORK_SECONDS / tpu);
  const low = parseIntSafe(ex.rep_low, 1);
  const high = parseIntSafe(ex.rep_high, rawReps);
  const reps = clamp(rawReps, low, high);

  switch (repUnit) {
    case "each_side":        return `x${reps} each side`;
    case "alternating_total": return `x${reps} alt`;
    case "steps_total":      return `x${reps} steps`;
    default:                 return `x${reps}`;
  }
}

function estimateRoundSeconds(moves, effort) {
  let total = 0;
  let unknowns = 0;

  for (const ex of moves) {
    const s = estimateMoveSeconds(ex, effort);
    if (s == null) unknowns++;
    else total += s;
  }

  const transitionPerMove = moves.reduce((acc, ex) => {
    const tc = parseIntSafe(ex.transition_cost, 2);
    return acc + clamp(tc, 0, 10);
  }, 0);

  total += transitionPerMove;

  return { totalSeconds: total, unknowns };
}

function amrapPacingSuggestion(amrapMinutes, moves, effort) {
  const { totalSeconds, unknowns } = estimateRoundSeconds(moves, effort);

  const allowUnknowns = moves.length >= 4 ? 1 : 0;
  if (unknowns > allowUnknowns) return null;
  if (totalSeconds <= 0) return null;

  const mainSeconds = amrapMinutes * 60;
  const estRounds = mainSeconds / totalSeconds;

  const low = Math.max(1, Math.floor(estRounds));
  const high = Math.max(low, Math.ceil(estRounds));

  const mm = Math.floor(totalSeconds / 60);
  const ss = Math.round(totalSeconds % 60);
  const mmss = `${mm}:${String(ss).padStart(2, "0")}`;

  const roundsStr = low === high ? `~${low}` : `~${low}–${high}`;

  return `Target pacing: ${roundsStr} rounds (≈${mmss} per round)`;
}

// --- Format Builders ---

function buildAMRAP(eligible, params, timing) {
  const rawExercises = (params.pinnedExercises?.length > 0 ? params.pinnedExercises : null)
    ?? pickMainMoves(eligible, params.effort, ["push", "pull", "hinge", "core", "carry"], params.durationMinutes);
  const pacing = amrapPacingSuggestion(timing.main, rawExercises, params.effort);

  return {
    title: `AMRAP ${timing.main} min`,
    timing,
    warmup: toMoves(pickWarmup(eligible, params.effort, params.durationMinutes), Math.max(1, params.effort - 1)),
    blocks: [
      {
        type: "amrap",
        minutes: timing.main,
        pacing,
        moves: resolvePinnedMoves(params.pinnedExercises, params.effort) ?? toMoves(rawExercises, params.effort),
      }
    ]
  };
}

function buildEMOM(eligible, params, timing) {
  const rawMovesForEmom = (params.pinnedExercises?.length > 0)
    ? params.pinnedExercises
    : pickMainMoves(eligible, params.effort, ["push", "pull", "hinge"], params.durationMinutes);

  // Compute natural round time from time_per_unit_seconds; fall back to effort table when data is missing.
  const FALLBACK_BY_EFFORT = { 1: 35, 2: 38, 3: 40, 4: 43, 5: 45 };
  const fallback = FALLBACK_BY_EFFORT[params.effort] ?? 40;
  const { totalSeconds: naturalSeconds, unknowns } = estimateRoundSeconds(rawMovesForEmom, params.effort);
  const targetSeconds = (unknowns === 0 && naturalSeconds > 0)
    ? clamp(Math.round(naturalSeconds), 20, 55)
    : fallback;

  const emomRound = scaleEmomRoundToBudget(rawMovesForEmom, params.effort, targetSeconds);

  return {
    title: `EMOM ${timing.main} min`,
    timing,
    warmup: toMoves(pickWarmup(eligible, params.effort, params.durationMinutes), Math.max(1, params.effort - 1)),
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
    warmup: toMoves(pickWarmup(eligible, params.effort, params.durationMinutes), Math.max(1, params.effort - 1)),
    blocks: [
      {
        type: "for_time",
        rounds: roundPlan.rounds,
        workPerRoundMin: roundPlan.workPerRoundMin,
        restBetweenRoundsMin: roundPlan.restBetweenRoundsMin,
        totalWorkMin: roundPlan.totalWorkMin,
        totalRestMin: roundPlan.totalRestMin,
        moves: resolvePinnedMoves(params.pinnedExercises, params.effort)
          ?? toMoves(pickMainMoves(eligible, params.effort, ["push", "pull", "hinge", "squat", "carry"], params.durationMinutes), params.effort),
      }
    ]
  };
}

function buildFixedRounds(eligible, params, timing) {
  const roundPlan = planRoundWorkRest(timing.main, params.rounds, params.effort);

  return {
    title: `Fixed rounds — ${roundPlan.rounds} rounds`,
    timing,
    warmup: toMoves(pickWarmup(eligible, params.effort, params.durationMinutes), Math.max(1, params.effort - 1)),
    blocks: [
      {
        type: "rounds",
        rounds: roundPlan.rounds,
        workPerRoundMin: roundPlan.workPerRoundMin,
        restBetweenRoundsMin: roundPlan.restBetweenRoundsMin,
        totalWorkMin: roundPlan.totalWorkMin,
        totalRestMin: roundPlan.totalRestMin,
        moves: resolvePinnedMoves(params.pinnedExercises, params.effort)
          ?? toMoves(pickMainMoves(eligible, params.effort, ["push", "pull", "squat", "core"], params.durationMinutes), params.effort),
      }
    ]
  };
}

function buildFixedWindow(eligible, params, timing) {
  const windows = clamp(params.windowRounds ?? 4, 1, 20);
  const windowMinutes = Math.max(1, Math.floor(timing.main / windows));
  const actualMain = windows * windowMinutes;
  const spare = timing.main - actualMain;

  return {
    title: `${windows} × ${windowMinutes} min windows`,
    timing,
    warmup: toMoves(pickWarmup(eligible, params.effort, params.durationMinutes), Math.max(1, params.effort - 1)),
    blocks: [
      {
        type: "fixed_window",
        windows,
        windowMinutes,
        spareMinutes: spare,
        moves: resolvePinnedMoves(params.pinnedExercises, params.effort)
          ?? toMoves(pickMainMoves(eligible, params.effort, ["push", "pull", "core"], params.durationMinutes), params.effort),
      }
    ]
  };
}

export function generateWorkoutFromCsvText(csvText, uiParams) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    delimiter: ",",
  });

  if (parsed.errors?.length) {
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
