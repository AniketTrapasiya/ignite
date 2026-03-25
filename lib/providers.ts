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

/**
 * Generate video using FREE AI services.
 *
 * Tier 1 — Hugging Face Inference API (free tier, needs HF_TOKEN or user key):
 *   Model: cerspense/zeroscope_v2_576w  (best free video model)
 *   Fallback: damo-vilab/text-to-video-ms-1.7b (ModelScope)
 *
 * Tier 2 — Pollinations.ai video endpoint (completely free, no key needed)
 */
export async function generateVideo(
  userId: string,
  prompt: string,
  options: { aspectRatio?: string; duration?: number } = {}
): Promise<{ videoUrl?: string; videoBase64?: string; error?: string }> {

  // ── Native Gemini Video Generation (Veo API) ──
  if (process.env.GEMINI_API_KEY) {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const modelId = "veo-2.0-generate-001";
      const startUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predictLongRunning?key=${apiKey}`;

      // Use manual abort controller for compatibility with older Node.js versions
      const startController = new AbortController();
      const startTimeout = setTimeout(() => startController.abort(), 30000);

      let startRes: Response;
      try {
        startRes = await fetch(startUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: options.aspectRatio ?? "16:9",
              durationSeconds: Math.min(Math.max(options.duration ?? 5, 5), 8),
            },
          }),
          signal: startController.signal,
        });
      } finally {
        clearTimeout(startTimeout);
      }

      const startText = await startRes.text();
      let startData: { name?: string; error?: { message?: string; code?: number } };
      try {
        startData = JSON.parse(startText);
      } catch {
        return { error: `Gemini Veo API returned unexpected response: ${startText.slice(0, 200)}` };
      }

      if (!startRes.ok) {
        const errMsg = startData.error?.message ?? `HTTP ${startRes.status}`;
        if (errMsg.includes("not found") || errMsg.includes("NOT_FOUND")) {
          return { error: "Your Gemini key doesn't have Veo access yet. Go to https://aistudio.google.com to unlock Veo Video Generation." };
        }
        return { error: `Gemini Veo error: ${errMsg}` };
      }

      const operationName = startData.name;
      if (!operationName) {
        return { error: `Gemini Veo started but returned no operation ID. Response: ${startText.slice(0, 300)}` };
      }

      const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`;
      
      // Poll for up to 3 minutes (36 × 5s)
      for (let attempt = 0; attempt < 36; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        
        const pollController = new AbortController();
        const pollTimeout = setTimeout(() => pollController.abort(), 15000);
        let pollRes: Response;
        try {
          pollRes = await fetch(pollUrl, { signal: pollController.signal });
        } finally {
          clearTimeout(pollTimeout);
        }

        const pollData = await pollRes.json() as {
          done?: boolean;
          error?: { message?: string };
          response?: {
            video?: { bytesBase64?: string; uri?: string };
            videos?: { bytesBase64?: string; uri?: string }[];
            predictions?: { bytesBase64Encoded?: string; mimeType?: string }[];
            generateVideoResponse?: {
              generatedSamples?: Array<{
                video?: { bytesBase64?: string; uri?: string };
              }>;
            };
          };
        };

        if (pollData.done) {
          if (pollData.error) {
            return { error: pollData.error.message ?? "Gemini video generation process failed." };
          }
          
          // Handle different possible response shapes from Veo
          const videoB64 = 
            pollData.response?.video?.bytesBase64 ?? 
            pollData.response?.videos?.[0]?.bytesBase64 ??
            pollData.response?.predictions?.[0]?.bytesBase64Encoded ??
            pollData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.bytesBase64;
            
          if (videoB64) return { videoBase64: videoB64 };
          
          const videoUri = 
            pollData.response?.video?.uri ?? 
            pollData.response?.videos?.[0]?.uri ??
            pollData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
            
          if (videoUri) {
            // If it's a relative path or missing 'key=', append it
            let finalUri = videoUri;
            if (finalUri.includes("download?alt=media") && !finalUri.includes("key=")) {
              finalUri += (finalUri.includes("?") ? "&" : "?") + `key=${apiKey}`;
            }
            return { videoUrl: finalUri };
          }

          return { error: `Veo completed but no video data found. Raw: ${JSON.stringify(pollData.response).slice(0, 300)}` };
        }
      }
      
      return { error: "Gemini video generation timed out after 3 minutes." };
      
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: `Gemini video generation error: ${msg}` };
    }
  }

  return { error: "No GEMINI_API_KEY found in .env. Add it to enable video generation." };
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
