import OpenAI from "openai";

/**
 * Server-side OpenAI client.
 *
 * Lazily instantiated so importing this module (e.g. at build time) does not
 * throw when OPENAI_API_KEY is absent. Server-only — never import from client
 * components.
 */
let cached: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (cached) return cached;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY (see .env.example).");
  }

  cached = new OpenAI({ apiKey });
  return cached;
}
