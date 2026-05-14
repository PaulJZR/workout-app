import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { generateWorkoutFromCsvText } from "../../../lib/workout/generateWorkout";

const csvText = fs.readFileSync(path.join(process.cwd(), "data", "exercises.csv"), "utf8");

export async function POST(req) {
  try {
    let params = {};
    try {
      params = await req.json();
    } catch {
      params = {};
    }

    const workout = generateWorkoutFromCsvText(csvText, params);
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
