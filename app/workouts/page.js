"use client";

import { useState } from "react";
import { WORKOUTS } from "./data";

const SECTION_ICONS = { warmup: "🔥", main: "⚡" };
const SECTION_BADGE = {
  warmup: "bg-amber-100",
  main: "bg-teal-100",
};
const LETTER_BG = {
  amber: "bg-amber-500",
  teal: "bg-teal-600",
  blue: "bg-blue-500",
  warm: "bg-warm-500",
};

export default function WorkoutsPage() {
  const [openId, setOpenId] = useState(null);

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-white border-b border-warm-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-warm-900 tracking-tight">Workouts</h1>
            <p className="text-xs text-warm-400 mt-0.5">4 training templates</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center">
            <span className="text-white text-sm font-bold">W</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-5 pb-24 space-y-4">
        {WORKOUTS.map((workout) => {
          const isOpen = openId === workout.id;
          return (
            <div
              key={workout.id}
              className="bg-white rounded-2xl shadow-sm border border-warm-100 overflow-hidden"
            >
              {/* Collapsed header / tap target */}
              <button
                onClick={() => setOpenId(isOpen ? null : workout.id)}
                className="w-full text-left p-5 flex items-center gap-4"
              >
                <div
                  className={`w-11 h-11 rounded-2xl ${LETTER_BG[workout.color]} flex items-center justify-center shrink-0`}
                >
                  <span className="text-xl font-bold text-white">{workout.letter}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-warm-800">{workout.name}</p>
                  <p className="text-xs text-warm-400 mt-0.5 leading-snug">{workout.description}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs text-warm-500 bg-warm-100 px-2 py-0.5 rounded-full">
                      25 min
                    </span>
                    <span className="text-xs text-warm-500 bg-warm-100 px-2 py-0.5 rounded-full">
                      3 rounds
                    </span>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-warm-400 shrink-0 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded sections */}
              {isOpen && (
                <div className="border-t border-warm-100 divide-y divide-warm-100">
                  {workout.sections.map((section) => (
                    <div key={section.type} className="px-5 py-4">
                      {/* Section header */}
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className={`w-7 h-7 rounded-full ${SECTION_BADGE[section.type]} flex items-center justify-center text-sm`}
                        >
                          {SECTION_ICONS[section.type]}
                        </div>
                        <h3 className="text-sm font-bold text-warm-700">{section.label}</h3>
                        <span className="text-xs text-warm-400 ml-auto">
                          ~{section.durationMinutes} min
                        </span>
                      </div>

                      {/* Main circuit note */}
                      {section.type === "main" && (
                        <p className="text-xs text-teal-600 bg-teal-50 inline-block px-2.5 py-1 rounded-lg mb-3">
                          {section.rounds} rounds · {section.restNote}
                        </p>
                      )}

                      {/* Exercise rows */}
                      <div>
                        {section.exercises.map((ex, i) => (
                          <div
                            key={ex.name}
                            className="flex items-center justify-between py-2.5 border-b border-warm-100 last:border-0"
                          >
                            {section.type === "main" ? (
                              <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-warm-100 text-warm-500 text-xs flex items-center justify-center font-semibold shrink-0">
                                  {i + 1}
                                </span>
                                <span className="text-sm text-warm-700 font-medium">{ex.name}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-warm-700">{ex.name}</span>
                            )}
                            <span className="text-sm font-semibold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full ml-3 shrink-0">
                              {ex.prescription}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
