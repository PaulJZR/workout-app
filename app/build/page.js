"use client";

export default function BuildPage() {
  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-white border-b border-warm-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-warm-900 tracking-tight">Build</h1>
            <p className="text-xs text-warm-400 mt-0.5">Create a custom workout</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-teal-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">W</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pb-24">
        <div className="flex flex-col items-center justify-center pt-20 text-center">
          <span className="text-4xl mb-4">🔨</span>
          <p className="text-warm-500 text-sm">Build mode coming soon.</p>
        </div>
      </main>
    </div>
  );
}
