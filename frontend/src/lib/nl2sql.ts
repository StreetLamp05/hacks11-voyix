import { apiUrl } from "./api";

export type NL2SQLResult = {
  question: string;
  sql: string;
  results: Record<string, unknown>[];
  row_count: number;
};

export type NL2SQLError = {
  question: string;
  sql: string;
  error: string;
};

export type NL2SQLResponse = NL2SQLResult | NL2SQLError;

export function isError(r: NL2SQLResponse): r is NL2SQLError {
  return "error" in r;
}

export async function askQuestion(question: string): Promise<NL2SQLResponse> {
  const res = await fetch(`${apiUrl}/api/nl2sql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  return res.json();
}
