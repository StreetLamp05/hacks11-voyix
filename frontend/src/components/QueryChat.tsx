"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { askQuestion, isError, NL2SQLResponse } from "@/lib/nl2sql";
import ResultsTable from "./ResultsTable";

type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; data: NL2SQLResponse };

export default function QueryChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setLoading(true);

    try {
      const data = await askQuestion(q);
      setMessages((prev) => [...prev, { role: "assistant", data }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          data: { question: q, sql: "", error: "Failed to reach backend" },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="flex h-full items-center justify-center text-gray-500">
            <p>
              Ask a question about your inventory, e.g.{" "}
              <span className="italic">&quot;Which ingredients are running low?&quot;</span>
            </p>
          </div>
        )}

        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[70%] rounded-lg bg-blue-600 px-4 py-2 text-white">
                {msg.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-full space-y-2 rounded-lg bg-gray-800 px-4 py-3 text-gray-100">
                {isError(msg.data) ? (
                  <>
                    <p className="text-red-400">Error: {msg.data.error}</p>
                    {msg.data.sql && (
                      <details open>
                        <summary className="cursor-pointer text-xs text-gray-400">
                          Generated SQL
                        </summary>
                        <pre className="mt-1 overflow-x-auto rounded bg-gray-900 p-2 text-xs">
                          {msg.data.sql}
                        </pre>
                      </details>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-400">
                      {msg.data.row_count} row{msg.data.row_count !== 1 && "s"}
                    </p>
                    <details>
                      <summary className="cursor-pointer text-xs text-gray-400">
                        Generated SQL
                      </summary>
                      <pre className="mt-1 overflow-x-auto rounded bg-gray-900 p-2 text-xs">
                        {msg.data.sql}
                      </pre>
                    </details>
                    <ResultsTable rows={msg.data.results} />
                  </>
                )}
              </div>
            </div>
          )
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="animate-pulse rounded-lg bg-gray-800 px-4 py-3 text-gray-400">
              Generating query...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-gray-700 p-4"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your inventory..."
          className="flex-1 rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
