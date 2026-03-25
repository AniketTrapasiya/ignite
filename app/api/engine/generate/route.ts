/**
 * POST /api/engine/generate
 * Multi-modal output generation: image, audio, video
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateImage, generateAudio, generateVideo } from "@/lib/providers";
import { publishMediaResult } from "@/lib/publish";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    type: "image" | "audio" | "video";
    prompt?: string;
    text?: string;
    model?: string;
    size?: string;
    quality?: string;
    voice?: string;
    aspectRatio?: string;
    publishTo?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const publishTo = body.publishTo || [];
  const prompt = body.prompt?.trim() || body.text?.trim() || "";

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
    
    if (publishTo.length > 0 && result.b64) {
      publishMediaResult(user.userId, { 
        type: "image", 
        data: result.b64, 
        prompt: body.prompt 
      }, publishTo).catch(console.error);
    }

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

    if (publishTo.length > 0 && result.audioBase64) {
      publishMediaResult(user.userId, { 
        type: "audio", 
        data: result.audioBase64, 
        prompt: text 
      }, publishTo).catch(console.error);
    }

    return NextResponse.json({ audioBase64: result.audioBase64 });
  }

  if (body.type === "video") {
    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: "prompt is required for video generation" }, { status: 400 });
    }
    const result = await generateVideo(user.userId, body.prompt, {
      aspectRatio: body.aspectRatio ?? "16:9",
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
    
    if (publishTo.length > 0) {
      const videoData = result.videoBase64 || result.videoUrl;
      if (videoData) {
        publishMediaResult(user.userId, { 
          type: "video", 
          data: videoData, 
          url: result.videoUrl, 
          prompt: body.prompt 
        }, publishTo).catch(console.error);
      }
    }

    return NextResponse.json({
      videoUrl: result.videoUrl ?? null,
      videoBase64: result.videoBase64 ?? null,
    });
  }

  return NextResponse.json({ error: "type must be 'image', 'audio', or 'video'" }, { status: 400 });
}
