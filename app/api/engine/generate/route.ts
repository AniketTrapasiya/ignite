/**
 * POST /api/engine/generate
 * Multi-modal output generation: image, audio
 * For video: described by LLM, published via platform
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateImage, generateAudio } from "@/lib/providers";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    type: "image" | "audio";
    prompt?: string;
    text?: string;
    model?: string;
    size?: string;
    quality?: string;
    voice?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.type === "image") {
    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: "prompt is required for image generation" }, { status: 400 });
    }
    const result = await generateImage(user.userId, body.prompt, {
      model: body.model ?? "dall-e-3",
      size: body.size,
      quality: body.quality,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
    return NextResponse.json({ b64: result.b64 });
  }

  if (body.type === "audio") {
    const text = body.text ?? body.prompt ?? "";
    if (!text.trim()) {
      return NextResponse.json({ error: "text or prompt is required for audio generation" }, { status: 400 });
    }
    const result = await generateAudio(user.userId, text, {
      model: body.model ?? "tts-1",
      voice: body.voice ?? "alloy",
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
    return NextResponse.json({ audioBase64: result.audioBase64 });
  }

  return NextResponse.json({ error: "type must be 'image' or 'audio'" }, { status: 400 });
}
