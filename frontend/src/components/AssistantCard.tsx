"use client";

import { useState } from "react";

export default function AssistantCard() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const analyze = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 800);
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="rounded-full bg-indigo-50 p-3 text-indigo-600">✨</div>
        <div>
          <h3 className="text-xl font-semibold">AI Analytics Assistant</h3>
          <p className="text-gray-500">Ask questions about your ingredient usage, inventory levels, or get predictions</p>
        </div>
      </div>

      <div className="mt-4">
        <input
          className="w-full border rounded-lg p-4 text-gray-700 placeholder-gray-400"
          placeholder="e.g., 'What ingredients are running low?' or 'Predict tomato usage for next week'"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="mt-4 flex items-center gap-4">
          <button onClick={analyze} className="btn-gradient">
            {loading ? "Analyzing…" : "Analyze"}
          </button>
          <div className="text-sm text-gray-500">Tip: try "What will we run out of next week?"</div>
        </div>
      </div>
    </div>
  );
}
