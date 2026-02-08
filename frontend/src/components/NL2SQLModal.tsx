"use client";

// Web Speech API types (not in all TS lib configs)
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

import { useCallback, useEffect, useRef, useState } from "react";
import { askQuestion, isError, NL2SQLResponse } from "@/lib/nl2sql";
import {
  askClaude,
  buildOptimizerPrompt,
  addQwenContext,
  buildExplainPrompt,
  fetchSimplePredictions,
  classifyIntent,
  executeAction,
  DEFAULT_PROMPT_TEMPLATE,
} from "@/lib/claude";
import type { ActionIntent } from "@/lib/claude";
import ResultsTable from "./ResultsTable";

type Stage = "idle" | "classifying" | "optimizing" | "qwen" | "explaining" | "acting" | "done" | "error";

type Exchange = {
  question: string;
  optimizedQuestion?: string;
  stage: Stage;
  nl2sqlResponse?: NL2SQLResponse;
  claudeResponse?: string;
  error?: string;
};

const LS_KEY_PROMPT = "nl2sql-claude-prompt";

export default function NL2SQLModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_PROMPT_TEMPLATE);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Voice-to-text via Web Speech API
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    let finalTranscript = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      setInput(finalTranscript + interim);
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      if (finalTranscript) {
        setInput(finalTranscript);
      }
    };

    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, []);

  // Clean up recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  // Auto-resize textarea when input changes (e.g. from speech recognition)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  // Load prompt template from localStorage
  useEffect(() => {
    setPromptTemplate(
      localStorage.getItem(LS_KEY_PROMPT) ?? DEFAULT_PROMPT_TEMPLATE
    );
  }, []);

  // Save prompt template
  useEffect(() => {
    localStorage.setItem(LS_KEY_PROMPT, promptTemplate);
  }, [promptTemplate]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [exchanges]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const busy = exchanges.some(
    (e) => e.stage === "classifying" || e.stage === "optimizing" || e.stage === "qwen" || e.stage === "explaining" || e.stage === "acting"
  );

  async function handleSend() {
    if (listening) stopListening();
    const q = input.trim();
    if (!q || busy) return;
    setInput("");

    const idx = exchanges.length;
    const newExchange: Exchange = { question: q, stage: "classifying" };
    setExchanges((prev) => [...prev, newExchange]);

    try {
      // Stage 1: Classify intent — query or action?
      const intent = await classifyIntent(q);

      if (intent.type === "action") {
        // --- ACTION PATH: execute via REST API ---
        setExchanges((prev) =>
          prev.map((e, i) =>
            i === idx ? { ...e, stage: "acting" } : e
          )
        );

        const result = await executeAction(intent as ActionIntent);
        setExchanges((prev) =>
          prev.map((e, i) =>
            i === idx ? { ...e, claudeResponse: result, stage: "done" } : e
          )
        );
      } else {
        // --- QUERY PATH: existing NL2SQL pipeline ---
        // Stage 2: Claude optimizes the question for Qwen
        setExchanges((prev) =>
          prev.map((e, i) =>
            i === idx ? { ...e, stage: "optimizing" } : e
          )
        );
        const optimizerPrompt = buildOptimizerPrompt(q);
        const optimized = (await askClaude(optimizerPrompt)).trim();
        setExchanges((prev) =>
          prev.map((e, i) =>
            i === idx ? { ...e, optimizedQuestion: optimized, stage: "qwen" } : e
          )
        );

        // Stage 3: NL2SQL via Qwen + fetch simple predictions in parallel
        const [nl2sqlRes, simplePreds] = await Promise.all([
          askQuestion(addQwenContext(optimized)),
          fetchSimplePredictions(),
        ]);
        setExchanges((prev) =>
          prev.map((e, i) =>
            i === idx ? { ...e, nl2sqlResponse: nl2sqlRes } : e
          )
        );

        // Stage 4: Claude explains results (if no SQL error)
        if (!isError(nl2sqlRes)) {
          setExchanges((prev) =>
            prev.map((e, i) =>
              i === idx ? { ...e, stage: "explaining" } : e
            )
          );
          const explainPrompt = buildExplainPrompt(
            promptTemplate,
            q,
            nl2sqlRes.results,
            simplePreds
          );
          const claudeText = await askClaude(explainPrompt);
          setExchanges((prev) =>
            prev.map((e, i) =>
              i === idx
                ? { ...e, claudeResponse: claudeText, stage: "done" }
                : e
            )
          );
        } else {
          setExchanges((prev) =>
            prev.map((e, i) => (i === idx ? { ...e, stage: "done" } : e))
          );
        }
      }
    } catch (err) {
      setExchanges((prev) =>
        prev.map((e, i) =>
          i === idx
            ? { ...e, stage: "error", error: String(err) }
            : e
        )
      );
    }
  }

  if (!open) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <span style={{ fontWeight: 700, fontSize: "1rem" }}>
            Inventory Assistant
          </span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setShowSettings((s) => !s)}
              style={styles.headerBtn}
              title="Settings"
            >
              {"\u2699"}
            </button>
            <button onClick={onClose} style={styles.headerBtn} title="Close">
              {"\u2715"}
            </button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div style={styles.settings}>
            <label style={styles.label}>
              Explanation Prompt Template
              <textarea
                value={promptTemplate}
                onChange={(e) => setPromptTemplate(e.target.value)}
                rows={5}
                style={{ ...styles.input, resize: "vertical", fontFamily: "monospace", fontSize: "0.75rem" }}
              />
            </label>
            <button
              onClick={() => setPromptTemplate(DEFAULT_PROMPT_TEMPLATE)}
              style={{
                ...styles.sendBtn,
                fontSize: "0.75rem",
                padding: "0.25rem 0.5rem",
                alignSelf: "flex-start",
              }}
            >
              Reset to default
            </button>
          </div>
        )}

        {/* Messages */}
        <div style={styles.messages}>
          {exchanges.length === 0 && (
            <div style={styles.welcome}>
              <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                Welcome!
              </p>
              <p style={{ fontSize: "0.85rem", color: "var(--chart-text)" }}>
                Ask a question about your inventory and I&apos;ll query the
                database for you.
              </p>
            </div>
          )}

          {exchanges.map((ex, i) => (
            <div key={i} style={{ marginBottom: "1rem" }}>
              {/* User bubble */}
              <div style={styles.userBubble}>{ex.question}</div>

              {/* Stage indicator */}
              {(ex.stage === "classifying" || ex.stage === "optimizing" || ex.stage === "qwen" || ex.stage === "explaining" || ex.stage === "acting") && (
                <div style={styles.stageIndicator}>
                  <span style={styles.spinner} />
                  <span style={{ fontSize: "0.8rem", color: "var(--chart-text)" }}>
                    {ex.stage === "classifying"
                      ? "Understanding your request..."
                      : ex.stage === "acting"
                        ? "Executing action..."
                        : ex.stage === "optimizing"
                          ? "Optimizing question with Claude..."
                          : ex.stage === "qwen"
                            ? "Converting to SQL via Qwen-2.5-code..."
                            : "Interpreting results with Claude..."}
                  </span>
                </div>
              )}

              {/* Error */}
              {ex.stage === "error" && (
                <div style={styles.errorBox}>
                  {ex.error ?? "Something went wrong."}
                </div>
              )}

              {/* Claude explanation response */}
              {ex.claudeResponse && (
                <div style={styles.assistantBubble}>
                  {ex.claudeResponse}
                </div>
              )}

              {/* SQL error from NL2SQL */}
              {ex.nl2sqlResponse && isError(ex.nl2sqlResponse) && ex.stage === "done" && (
                <div style={styles.errorBox}>
                  SQL error: {ex.nl2sqlResponse.error}
                </div>
              )}

              {/* Raw data accordion */}
              {(ex.nl2sqlResponse || ex.optimizedQuestion) && ex.stage === "done" && (
                <details style={{ marginTop: "0.5rem" }}>
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      color: "var(--chart-text)",
                    }}
                  >
                    View raw data
                  </summary>
                  <div style={{ marginTop: "0.5rem" }}>
                    {ex.optimizedQuestion && (
                      <div style={{ marginBottom: "0.5rem", fontSize: "0.8rem" }}>
                        <span style={{ fontWeight: 600, color: "var(--chart-text)" }}>
                          Optimized question:{" "}
                        </span>
                        <span style={{ fontStyle: "italic" }}>{ex.optimizedQuestion}</span>
                      </div>
                    )}
                    {ex.nl2sqlResponse && (
                      <>
                        <pre style={styles.sqlBlock}>
                          {ex.nl2sqlResponse.sql}
                        </pre>
                        {!isError(ex.nl2sqlResponse) && (
                          <div style={{ marginTop: "0.5rem" }}>
                            <ResultsTable rows={ex.nl2sqlResponse.results} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </details>
              )}
            </div>
          ))}
          <div ref={messagesEnd} />
        </div>

        {/* Input bar */}
        <div style={styles.inputBar}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={listening ? "Listening..." : "Ask about your inventory..."}
            disabled={busy}
            rows={1}
            style={{ ...styles.input, flex: 1, resize: "none", overflow: "hidden" }}
          />
          <button
            onClick={listening ? stopListening : startListening}
            disabled={busy}
            title={listening ? "Stop listening" : "Voice input"}
            style={{
              ...styles.micBtn,
              background: listening ? "var(--color-danger)" : "transparent",
              color: listening ? "#fff" : "var(--foreground)",
            }}
          >
            {listening ? "\u25A0" : "\uD83C\uDF99"}
          </button>
          <button
            onClick={handleSend}
            disabled={busy || !input.trim()}
            style={{
              ...styles.sendBtn,
              opacity: busy || !input.trim() ? 0.5 : 1,
            }}
          >
            Send
          </button>
        </div>
      </div>

      {/* Spinner keyframes injected via style tag */}
      <style>{`
        @keyframes nl2sql-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/* ── Inline styles ─────────────────────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    bottom: "5.5rem",
    right: "1.5rem",
    zIndex: 1000,
  },
  modal: {
    width: 400,
    height: 600,
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    background: "var(--card-bg)",
    border: "var(--card-border)",
    borderRadius: "var(--card-radius)",
    boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.75rem 1rem",
    borderBottom: "var(--card-border)",
    background: "var(--card-bg)",
  },
  headerBtn: {
    background: "none",
    border: "none",
    color: "var(--foreground)",
    fontSize: "1.1rem",
    cursor: "pointer",
    padding: "0.2rem",
    lineHeight: 1,
  },
  settings: {
    padding: "0.75rem 1rem",
    borderBottom: "var(--card-border)",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "1rem",
  },
  welcome: {
    textAlign: "center",
    padding: "2rem 1rem",
  },
  userBubble: {
    background: "var(--btn-bg)",
    color: "#fff",
    padding: "0.5rem 0.75rem",
    borderRadius: "12px 12px 4px 12px",
    marginLeft: "auto",
    maxWidth: "85%",
    width: "fit-content",
    fontSize: "0.85rem",
    wordBreak: "break-word",
  },
  stageIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginTop: "0.5rem",
    padding: "0.4rem 0.6rem",
  },
  spinner: {
    display: "inline-block",
    width: 14,
    height: 14,
    border: "2px solid var(--chart-grid)",
    borderTopColor: "var(--btn-bg)",
    borderRadius: "50%",
    animation: "nl2sql-spin 0.8s linear infinite",
  },
  assistantBubble: {
    background: "var(--card-bg)",
    border: "var(--card-border)",
    padding: "0.6rem 0.75rem",
    borderRadius: "12px 12px 12px 4px",
    marginTop: "0.5rem",
    maxWidth: "90%",
    fontSize: "0.85rem",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  errorBox: {
    marginTop: "0.5rem",
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    background: "#fef2f2",
    color: "var(--color-danger)",
    fontSize: "0.8rem",
    border: "1px solid var(--color-danger)",
  },
  sqlBlock: {
    background: "#111",
    color: "#a5f3fc",
    padding: "0.5rem",
    borderRadius: 6,
    fontSize: "0.75rem",
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  inputBar: {
    display: "flex",
    gap: "0.5rem",
    padding: "0.75rem 1rem",
    borderTop: "var(--card-border)",
  },
  input: {
    padding: "0.4rem 0.6rem",
    borderRadius: 6,
    border: "1px solid var(--chart-grid)",
    background: "var(--background)",
    color: "var(--foreground)",
    fontSize: "0.85rem",
    outline: "none",
  },
  micBtn: {
    border: "1px solid var(--chart-grid)",
    borderRadius: "50%",
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.9rem",
    cursor: "pointer",
    flexShrink: 0,
    transition: "background 0.15s, color 0.15s",
  },
  sendBtn: {
    background: "var(--btn-bg)",
    color: "var(--btn-color)",
    border: "none",
    borderRadius: "var(--btn-radius)",
    padding: "0.4rem 0.75rem",
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
  },
};
