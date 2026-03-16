/**
 * lib/providers.ts
 * Multi-provider AI model resolver.
 * Priority: user's stored credential → env fallback.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";
import { prisma } from "./prisma";
import { decrypt } from "./encryption";

export type AIProvider = "openai" | "gemini" | "groq" | "anthropic";

/** Detect which provider owns a given model ID */
export function getProviderFromModelId(modelId: string): AIProvider {
  if (modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3") || modelId.startsWith("dall-e") || modelId.startsWith("tts-")) return "openai";
  if (modelId.startsWith("claude-")) return "anthropic";
  if (modelId.startsWith("imagen")) return "gemini";
  if (
    modelId.startsWith("llama") ||
    modelId.startsWith("mixtral") ||
    modelId.startsWith("gemma") ||
    modelId.startsWith("deepseek") ||
    modelId.startsWith("qwen") ||
    modelId.startsWith("whisper-large")
  ) return "groq";
  return "gemini";
}

/** Resolve API key: user stored credential → env fallback */
export async function resolveApiKey(userId: string, provider: AIProvider): Promise<string | null> {
  // Try user's stored credential first
  try {
    const cred = await prisma.aICredential.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (cred?.apiKey) return decrypt(cred.apiKey);
  } catch {
    // DB unavailable
  }

  // Env fallback
  switch (provider) {
    case "gemini": return process.env.GEMINI_API_KEY ?? null;
    case "anthropic": return process.env.ANTHROPIC_API_KEY ?? null;
    case "openai": return process.env.OPENAI_API_KEY ?? null;
    case "groq": return process.env.GROQ_API_KEY ?? null;
  }
}

/** Resolve and return an AI SDK model instance for text/chat */
export async function resolveTextModel(userId: string, modelId: string) {
  const provider = getProviderFromModelId(modelId);
  const apiKey = await resolveApiKey(userId, provider);
  if (!apiKey) throw new Error(`No API key configured for provider: ${provider}. Add your key in Settings → AI Keys.`);

  switch (provider) {
    case "gemini": {
      const google = createGoogleGenerativeAI({ apiKey });
      const id = modelId.startsWith("models/") ? modelId.replace("models/", "") : modelId;
      return google(id);
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(modelId);
    }
    case "openai": {
      const openai = createOpenAI({ apiKey });
      return openai(modelId);
    }
    case "groq": {
      const groq = createGroq({ apiKey });
      return groq(modelId);
    }
  }
}

/** Generate image via OpenAI DALL-E or Google Imagen */
export async function generateImage(
  userId: string,
  prompt: string,
  options: { model?: string; size?: string; quality?: string } = {}
): Promise<{ url?: string; b64?: string; error?: string }> {
  const model = options.model ?? "dall-e-3";
  const provider = getProviderFromModelId(model);
  const apiKey = await resolveApiKey(userId, provider);
  if (!apiKey) return { error: `No API key for ${provider}. Add your key in Settings → AI Keys.` };

  // ── OpenAI DALL-E ──────────────────────────────────────────────────────
  if (provider === "openai") {
    const size = (options.size ?? "1024x1024") as "1024x1024" | "1792x1024" | "1024x1792";
    const quality = (options.quality ?? "standard") as "standard" | "hd";
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "dall-e-3", prompt, n: 1, size, quality, response_format: "b64_json" }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await res.json() as { data?: { b64_json: string }[]; error?: { message: string } };
    if (!res.ok) return { error: data.error?.message ?? "DALL-E image generation failed" };
    return { b64: data.data?.[0]?.b64_json };
  }

  // ── Google Imagen ──────────────────────────────────────────────────────
  if (provider === "gemini") {
    const imagenModel = model.startsWith("imagen") ? model : "imagen-3.0-generate-002";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${imagenModel}:predict?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1 },
        }),
        signal: AbortSignal.timeout(60000),
      }
    );
    const data = await res.json() as {
      predictions?: { bytesBase64Encoded?: string; mimeType?: string }[];
      error?: { message: string };
    };
    if (!res.ok) return { error: data.error?.message ?? "Imagen generation failed" };
    const b64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) return { error: "No image returned from Imagen" };
    return { b64 };
  }

  return { error: "Image generation not supported for this provider" };
}

/** Generate audio via OpenAI TTS */
export async function generateAudio(
  userId: string,
  text: string,
  options: { model?: string; voice?: string } = {}
): Promise<{ audioBase64?: string; error?: string }> {
  const model = options.model ?? "tts-1";
  const voice = (options.voice ?? "alloy") as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

  const apiKey = await resolveApiKey(userId, "openai");
  if (!apiKey) return { error: "No OpenAI API key. Add your key in Settings → AI Keys to use TTS." };

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: text.slice(0, 4096), voice }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message: string } };
    return { error: err.error?.message ?? "Audio generation failed" };
  }

  const arrayBuffer = await res.arrayBuffer();
  const audioBase64 = Buffer.from(arrayBuffer).toString("base64");
  return { audioBase64 };
}

/** Check which providers a user has keys for (includes env keys) */
export async function getUserProviders(userId: string): Promise<Record<AIProvider, boolean>> {
  const stored: AIProvider[] = [];
  try {
    const creds = await prisma.aICredential.findMany({
      where: { userId },
      select: { provider: true },
    });
    stored.push(...(creds.map((c) => c.provider) as AIProvider[]));
  } catch { /* ignore */ }

  return {
    openai: stored.includes("openai") || !!process.env.OPENAI_API_KEY,
    gemini: stored.includes("gemini") || !!process.env.GEMINI_API_KEY,
    groq: stored.includes("groq") || !!process.env.GROQ_API_KEY,
    anthropic: stored.includes("anthropic") || !!process.env.ANTHROPIC_API_KEY,
  };
}
