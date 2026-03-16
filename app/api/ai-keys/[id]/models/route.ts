import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import type { AIProvider } from "@/app/api/ai-keys/route";

// Static model lists per provider
const OPENAI_CHAT: { id: string; name: string; description: string; cap: string[] }[] = [
  { id: "gpt-4o", name: "GPT-4o", description: "Most capable multimodal model", cap: ["text", "vision"] },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Fast and affordable", cap: ["text", "vision"] },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "High intelligence, 128K context", cap: ["text"] },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", description: "Fast, cost-effective", cap: ["text"] },
  { id: "o1-mini", name: "o1-mini", description: "Reasoning for complex problems", cap: ["text"] },
];

const OPENAI_IMAGE: { id: string; name: string; description: string; cap: string[] }[] = [
  { id: "dall-e-3", name: "DALL-E 3", description: "High-quality image generation", cap: ["image"] },
  { id: "dall-e-2", name: "DALL-E 2", description: "Faster image generation", cap: ["image"] },
];

const OPENAI_TTS: { id: string; name: string; description: string; cap: string[] }[] = [
  { id: "tts-1-hd", name: "TTS-1 HD", description: "High quality text-to-speech", cap: ["audio"] },
  { id: "tts-1", name: "TTS-1", description: "Standard text-to-speech", cap: ["audio"] },
];

const GROQ_MODELS: { id: string; name: string; description: string; cap: string[] }[] = [
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", description: "Meta's most capable 70B model", cap: ["text"] },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", description: "Ultra-fast 8B model", cap: ["text"] },
  { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", description: "32K context MoE model", cap: ["text"] },
  { id: "gemma2-9b-it", name: "Gemma 2 9B", description: "Google's efficient 9B model", cap: ["text"] },
  { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 70B", description: "Reasoning model with chain-of-thought", cap: ["text"] },
  { id: "qwen-qwq-32b", name: "Qwen QwQ 32B", description: "Advanced reasoning model", cap: ["text"] },
];

const ANTHROPIC_MODELS: { id: string; name: string; description: string; cap: string[] }[] = [
  { id: "claude-opus-4-5", name: "Claude Opus 4.5", description: "Most intelligent Claude model", cap: ["text", "vision"] },
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", description: "Balance of intelligence & speed", cap: ["text", "vision"] },
  { id: "claude-haiku-3-5", name: "Claude Haiku 3.5", description: "Fast and compact", cap: ["text", "vision"] },
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const cred = await prisma.aICredential.findFirst({
    where: { id, userId: user.userId },
  });
  if (!cred) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apiKey = decrypt(cred.apiKey);
  const provider = cred.provider as AIProvider;

  const models: { id: string; name: string; description: string; cap: string[]; available: boolean }[] = [];

  try {
    if (provider === "openai") {
      // Fetch actual models available to this key
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json() as { data: { id: string }[] };
        const availableIds = new Set(data.data.map((m) => m.id));
        models.push(
          ...[...OPENAI_CHAT, ...OPENAI_IMAGE, ...OPENAI_TTS].map((m) => ({
            ...m,
            available: availableIds.has(m.id),
          }))
        );
      } else {
        models.push(...[...OPENAI_CHAT, ...OPENAI_IMAGE, ...OPENAI_TTS].map((m) => ({ ...m, available: true })));
      }
    }

    if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const data = await res.json() as { models: { name: string; displayName: string; description: string; supportedGenerationMethods: string[] }[] };
        for (const m of (data.models ?? [])) {
          if (!m.name.includes("gemini")) continue;
          if (m.name.includes("embedding") || m.name.includes("aqa")) continue;
          const id = m.name.replace("models/", "");
          const isImage = m.name.includes("imagen");
          const cap = isImage ? ["image"] : ["text", "vision"];
          if (m.supportedGenerationMethods?.some((s) => ["generateContent", "generateImages"].includes(s))) {
            models.push({ id, name: m.displayName ?? id, description: m.description?.slice(0, 80) ?? "", cap, available: true });
          }
        }
      }
    }

    if (provider === "groq") {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json() as { data: { id: string; owned_by: string }[] };
        const availableIds = new Set(data.data.map((m) => m.id));
        // Mix static list with available check
        models.push(...GROQ_MODELS.map((m) => ({ ...m, available: availableIds.has(m.id) })));
        // Also add any new models from API not in our static list
        for (const m of data.data) {
          if (!GROQ_MODELS.find((x) => x.id === m.id)) {
            models.push({ id: m.id, name: m.id, description: `${m.owned_by} model`, cap: ["text"], available: true });
          }
        }
      } else {
        models.push(...GROQ_MODELS.map((m) => ({ ...m, available: true })));
      }
    }

    if (provider === "anthropic") {
      models.push(...ANTHROPIC_MODELS.map((m) => ({ ...m, available: true })));
    }
  } catch {
    // Fallback for network failures
    if (provider === "openai") models.push(...[...OPENAI_CHAT, ...OPENAI_IMAGE, ...OPENAI_TTS].map((m) => ({ ...m, available: true })));
    if (provider === "groq") models.push(...GROQ_MODELS.map((m) => ({ ...m, available: true })));
    if (provider === "anthropic") models.push(...ANTHROPIC_MODELS.map((m) => ({ ...m, available: true })));
  }

  return NextResponse.json({ provider, models });
}
