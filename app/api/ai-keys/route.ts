import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

export type AIProvider = "openai" | "gemini" | "groq" | "anthropic";

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  groq: "Groq",
  anthropic: "Anthropic",
};

// GET — list user's AI credentials (keys masked)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const creds = await prisma.aICredential.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, provider: true, label: true, createdAt: true },
  });

  return NextResponse.json({ credentials: creds });
}

// POST — add or replace AI credential for a provider
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { provider: string; apiKey: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { provider, apiKey, label = "" } = body;

  const validProviders: AIProvider[] = ["openai", "gemini", "groq", "anthropic"];
  if (!validProviders.includes(provider as AIProvider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }
  if (!apiKey?.trim()) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  // Validate key works before saving (lightweight check)
  const validationError = await validateProviderKey(provider as AIProvider, apiKey.trim());
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 422 });
  }

  const encryptedKey = encrypt(apiKey.trim());

  // Upsert — one key per provider per user
  const cred = await prisma.aICredential.upsert({
    where: { userId_provider: { userId: user.userId, provider } },
    create: { userId: user.userId, provider, apiKey: encryptedKey, label },
    update: { apiKey: encryptedKey, label },
    select: { id: true, provider: true, label: true, createdAt: true },
  });

  return NextResponse.json({ credential: cred });
}

// ── Key validation ────────────────────────────────────────────────────────────

async function validateProviderKey(provider: AIProvider, apiKey: string): Promise<string | null> {
  try {
    if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=1`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.status === 400 || res.status === 403) return "Invalid Gemini API key";
      return null;
    }

    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models?limit=1", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 401) return "Invalid OpenAI API key";
      return null;
    }

    if (provider === "groq") {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 401) return "Invalid Groq API key";
      return null;
    }

    if (provider === "anthropic") {
      // Anthropic: do a minimal ping (no free models endpoint; just trust for now)
      if (!apiKey.startsWith("sk-ant-")) return "Invalid Anthropic API key (must start with sk-ant-)";
      return null;
    }

    return null;
  } catch {
    // Network error — accept the key optimistically
    return null;
  }
}

// ── Get decrypted key (internal use) ─────────────────────────────────────────
export async function getDecryptedKey(userId: string, provider: AIProvider): Promise<string | null> {
  try {
    const cred = await prisma.aICredential.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!cred) return null;
    return decrypt(cred.apiKey);
  } catch {
    return null;
  }
}
