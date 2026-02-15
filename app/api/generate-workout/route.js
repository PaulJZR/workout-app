import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { generateWorkoutFromCsvText } from "../../../lib/workout/generateWorkout";

export async function POST(req) {
  try {
    let params = {};
    try {
      params = await req.json();
    } catch {
      params = {}; // empty body -> defaults
    }

    const csvPath = path.join(process.cwd(), "data", "exercises.csv");
    const csvText = fs.readFileSync(csvPath, "utf8");

    const workout = generateWorkoutFromCsvText(csvText, params);

    // Helpful debug; safe to keep while you're building
    console.log("WORKOUT FROM GENERATOR:", JSON.stringify(workout, null, 2));

    return NextResponse.json(workout);
  } catch (err) {
    console.error("generate-workout route error:", err);

    return NextResponse.json(
      {
        error: "generate-workout failed",
        message: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}