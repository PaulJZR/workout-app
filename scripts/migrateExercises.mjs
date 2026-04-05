// scripts/migrateExercises.mjs
// Run once with: node scripts/migrateExercises.mjs
//
// Reads your existing exercises.csv and uploads each row to Firestore.
// Safe to re-run — it uses the exercise id as the document id (upsert).

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import Papa from "papaparse";
import * as dotenv from "dotenv";

// Load .env.local
dotenv.config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function parseIntSafe(v, fallback = 0) {
  const n = parseInt(String(v ?? "").trim(), 10);
  return isFinite(n) ? n : fallback;
}

function parseFloatSafe(v, fallback = 0) {
  const n = parseFloat(String(v ?? "").trim());
  return isFinite(n) ? n : fallback;
}

function splitPipe(v) {
  const s = String(v ?? "").trim();
  if (!s) return [];
  return s.split("|").map((x) => x.trim()).filter(Boolean);
}

async function migrate() {
  const csvPath = join(__dirname, "../data/exercises.csv");
  const csvText = readFileSync(csvPath, "utf8");

  const { data, errors } = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    delimiter: ",",
  });

  if (errors.length) {
    console.warn("CSV parse warnings:", errors);
  }

  // Filter out blank rows (rows where id is empty)
  const rows = data.filter((row) => row.id && row.id.trim());

  console.log(`Migrating ${rows.length} exercises to Firestore...`);

  let success = 0;
  let failed = 0;

  for (const row of rows) {
    const id = row.id.trim();

    // Coerce types so Firestore gets proper numbers, arrays etc.
    const exercise = {
      id,
      name: String(row.name ?? "").trim(),
      primary_pattern: String(row.primary_pattern ?? "").trim(),
      patterns: splitPipe(row.patterns),           // store as array
      required_equipment: String(row.required_equipment ?? "").trim(),
      optional_equipment: splitPipe(row.optional_equipment), // store as array
      difficulty: parseIntSafe(row.difficulty, 3),
      measure: String(row.measure ?? "reps").trim(),
      rep_unit: String(row.rep_unit ?? "total").trim(),
      time_per_unit_seconds: parseFloatSafe(row.time_per_unit_seconds, 2.5),
      rep_low: parseIntSafe(row.rep_low, 8),
      rep_high: parseIntSafe(row.rep_high, 12),
      unilateral: String(row.unilateral ?? "no").trim() === "yes",
      transition_cost: parseIntSafe(row.transition_cost, 2),
      impact_level: String(row.impact_level ?? "low").trim(),
      skill_level: String(row.skill_level ?? "low").trim(),
      space_required: String(row.space_required ?? "small").trim(),
      variation_of: String(row.variation_of ?? "").trim(),
      notes: String(row.notes ?? "").trim(),
      active: true, // allows you to soft-disable exercises in the admin UI
    };

    try {
      await setDoc(doc(db, "exercises", id), exercise);
      console.log(`  ✓ ${id}`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${id}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${success} succeeded, ${failed} failed.`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
