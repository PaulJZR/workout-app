"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

const FORMAT_LABELS = {
  amrap: "AMRAP",
  emom: "EMOM",
  fixed_rounds: "Rounds",
  for_time: "For Time",
  fixed_window: "Windows",
};

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-warm-100 animate-pulse">
      <div className="h-4 bg-warm-200 rounded w-2/3 mb-3" />
      <div className="flex gap-2 mb-3">
        <div className="h-5 bg-warm-200 rounded-full w-16" />
        <div className="h-5 bg-warm-200 rounded-full w-14" />
        <div className="h-5 bg-warm-200 rounded-full w-10" />
      </div>
      <div className="h-3 bg-warm-100 rounded w-1/3" />
    </div>
  );
}

export default function LibraryPage() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchWorkouts() {
      try {
        const q = query(collection(db, "workouts"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setWorkouts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    fetchWorkouts();
  }, []);

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-white border-b border-warm-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-warm-900 tracking-tight">Library</h1>
            <p className="text-xs text-warm-400 mt-0.5">Your saved workouts</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-teal-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">W</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-5 pb-24 space-y-4">
        {loading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {!loading && !error && workouts.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-20 text-center">
            <p className="text-warm-400 text-sm mb-4">
              No saved workouts yet. Generate one or build your own.
            </p>
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold shadow-md shadow-teal-200 hover:bg-teal-700 active:scale-[0.98] transition-all duration-200"
            >
              Generate a workout
            </Link>
          </div>
        )}

        {!loading && !error && workouts.map((w) => {
          const date = w.createdAt?.toDate?.()
            ? w.createdAt.toDate().toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "";
          return (
            <div
              key={w.id}
              onClick={() => console.log(w.id)}
              className="bg-white rounded-2xl p-5 shadow-sm border border-warm-100 cursor-pointer active:scale-[0.99] transition-transform duration-100"
            >
              <p className="text-sm font-bold text-warm-900 mb-2">{w.title}</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {w.format && (
                  <span className="text-xs bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full font-medium">
                    {FORMAT_LABELS[w.format] ?? w.format}
                  </span>
                )}
                {w.durationMinutes && (
                  <span className="text-xs bg-warm-100 text-warm-500 px-2.5 py-0.5 rounded-full">
                    {w.durationMinutes} min
                  </span>
                )}
                {w.effort && (
                  <span className="text-xs bg-warm-100 text-warm-500 px-2.5 py-0.5 rounded-full">
                    {w.effort}/5
                  </span>
                )}
              </div>
              {date && (
                <p className="text-xs text-warm-400">{date}</p>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
