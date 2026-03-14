import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

interface GeminiModel {
  name: string;
  displayName: string;
  description: string;
  supportedGenerationMethods: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}

// Hardcoded fallback models if API fetch fails
const FALLBACK_GEMINI: { id: string; name: string; provider: "google"; description: string }[] = [
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "google", description: "Fast and capable" },
  { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", provider: "google", description: "Lightweight and fast" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "google", description: "Advanced reasoning" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", provider: "google", description: "Balanced speed/quality" },
  { id: "gemini-1.5-flash-8b", name: "Gemini 1.5 Flash 8B", provider: "google", description: "Smallest and fastest" },
];

const CLAUDE_MODELS: { id: string; name: string; provider: "anthropic"; description: string }[] = [
  { id: "claude-opus-4-5", name: "Claude Opus 4.5", provider: "anthropic", description: "Most intelligent" },
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "anthropic", description: "Balance of intelligence & speed" },
  { id: "claude-haiku-3-5", name: "Claude Haiku 3.5", provider: "anthropic", description: "Fast and compact" },
];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const models: {
    id: string;
    name: string;
    provider: "google" | "anthropic";
    description: string;
    available: boolean;
  }[] = [];

  // ── Gemini models ────────────────────────────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}&pageSize=50`,
        { next: { revalidate: 300 } }
      );
      if (res.ok) {
        const data = await res.json() as { models: GeminiModel[] };
        const geminiModels = (data.models ?? [])
          .filter((m) =>
            m.supportedGenerationMethods?.includes("generateContent") &&
            // Only include text generation models (not embedding, etc.)
            m.name.includes("gemini") &&
            !m.name.includes("embedding") &&
            !m.name.includes("aqa")
          )
          .map((m) => {
            const id = m.name.replace("models/", "");
            return {
              id,
              name: m.displayName ?? id,
              provider: "google" as const,
              description: m.description?.slice(0, 80) ?? "",
              available: true,
            };
          })
          // Sort: flash first, then pro, then others
          .sort((a, b) => {
            if (a.id.includes("flash") && !b.id.includes("flash")) return -1;
            if (!a.id.includes("flash") && b.id.includes("flash")) return 1;
            return a.id.localeCompare(b.id);
          });
        models.push(...geminiModels);
      } else {
        // API fetch failed — use fallbacks
        models.push(...FALLBACK_GEMINI.map((m) => ({ ...m, available: true })));
      }
    } catch {
      models.push(...FALLBACK_GEMINI.map((m) => ({ ...m, available: true })));
    }
  } else {
    // No key — show as unavailable
    models.push(...FALLBACK_GEMINI.map((m) => ({ ...m, available: false })));
  }

  // ── Anthropic / Claude models ────────────────────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  models.push(
    ...CLAUDE_MODELS.map((m) => ({ ...m, available: !!anthropicKey }))
  );

  return NextResponse.json({
    models,
    configured: {
      google: !!geminiKey,
      anthropic: !!anthropicKey,
      openai: !!process.env.OPENAI_API_KEY,
      pinecone: !!process.env.PINECONE_API_KEY,
    },
  });
}
