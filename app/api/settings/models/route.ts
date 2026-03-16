import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveApiKey } from "@/lib/providers";

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
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google", description: "Latest and most capable" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google", description: "Most intelligent Gemini" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "google", description: "Fast and capable" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "google", description: "Advanced reasoning" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", provider: "google", description: "Balanced speed/quality" },
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
    provider: "google" | "anthropic" | "openai" | "groq";
    description: string;
    available: boolean;
    cap?: string[];
  }[] = [];

  // ── Gemini models ────────────────────────────────────────────────────────
  const geminiKey = await resolveApiKey(user.userId, "gemini");
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}&pageSize=50`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json() as { models: GeminiModel[] };
        const geminiModels = (data.models ?? [])
          .filter((m) =>
            m.supportedGenerationMethods?.includes("generateContent") &&
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
              cap: ["text", "vision"],
            };
          })
          .sort((a, b) => {
            const ver = (id: string) => parseFloat(id.replace(/^gemini-(\d+\.\d+).*$/, "$1")) || 0;
            const vDiff = ver(b.id) - ver(a.id);
            if (vDiff !== 0) return vDiff;
            const rank = (id: string) => id.includes("flash") ? 0 : id.includes("pro") ? 1 : 2;
            return rank(a.id) - rank(b.id);
          });
        models.push(...geminiModels);
      } else {
        models.push(...FALLBACK_GEMINI.map((m) => ({ ...m, available: true, cap: ["text", "vision"] })));
      }
    } catch {
      models.push(...FALLBACK_GEMINI.map((m) => ({ ...m, available: true, cap: ["text", "vision"] })));
    }
    // Add Imagen-3 for image generation when Gemini key is available
    models.push({
      id: "imagen-3.0-generate-002",
      name: "Imagen 3",
      provider: "google" as const,
      description: "Google's best image generation model",
      available: true,
      cap: ["image"],
    });
  } else {
    models.push(...FALLBACK_GEMINI.map((m) => ({ ...m, available: false, cap: ["text", "vision"] })));
  }

  // ── Anthropic / Claude models ────────────────────────────────────────────
  const anthropicKey = await resolveApiKey(user.userId, "anthropic");
  models.push(...CLAUDE_MODELS.map((m) => ({ ...m, available: !!anthropicKey, cap: ["text", "vision"] })));

  // ── OpenAI models ────────────────────────────────────────────────────────
  const openaiKey = await resolveApiKey(user.userId, "openai");
  if (openaiKey) {
    models.push(
      { id: "gpt-4o", name: "GPT-4o", provider: "openai", description: "Most capable multimodal model", available: true, cap: ["text", "vision"] },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", description: "Fast and affordable", available: true, cap: ["text", "vision"] },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "openai", description: "High intelligence, 128K context", available: true, cap: ["text"] },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "openai", description: "Fast, cost-effective", available: true, cap: ["text"] },
      { id: "dall-e-3", name: "DALL-E 3", provider: "openai", description: "High-quality image generation", available: true, cap: ["image"] },
      { id: "tts-1-hd", name: "TTS-1 HD", provider: "openai", description: "High quality text-to-speech", available: true, cap: ["audio"] },
      { id: "tts-1", name: "TTS-1", provider: "openai", description: "Standard text-to-speech", available: true, cap: ["audio"] }
    );
  }

  // ── Groq models ──────────────────────────────────────────────────────────
  const groqKey = await resolveApiKey(user.userId, "groq");
  if (groqKey) {
    models.push(
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", provider: "groq", description: "Meta's most capable 70B", available: true, cap: ["text"] },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", provider: "groq", description: "Ultra-fast 8B model", available: true, cap: ["text"] },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", provider: "groq", description: "32K context MoE model", available: true, cap: ["text"] },
      { id: "gemma2-9b-it", name: "Gemma 2 9B", provider: "groq", description: "Google's efficient 9B", available: true, cap: ["text"] },
      { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 70B", provider: "groq", description: "Reasoning model", available: true, cap: ["text"] }
    );
  }

  return NextResponse.json({
    models,
    configured: {
      google: !!geminiKey,
      anthropic: !!anthropicKey,
      openai: !!openaiKey,
      groq: !!groqKey,
      pinecone: !!process.env.PINECONE_API_KEY,
    },
  });
}
