/**
 * POST /api/workflows/generate
 *
 * Takes a natural language description and uses AI to produce a complete
 * workflow graph (nodes + edges) plus a human-readable step plan.
 */
import { NextResponse } from "next/server";
import { generateText } from "ai";
import { getCurrentUser } from "@/lib/auth";
import { resolveTextModel } from "@/lib/providers";

const SYSTEM_PROMPT = `You are an expert workflow automation architect.
Given a plain-English description of an automation, you output a precise JSON object
representing that workflow in the AutoFlow system.

Node types:
  trigger  — The entry point. data must include: { label, triggerType: "manual"|"webhook"|"schedule", config: {} }
  llm      — AI text generation/classification. data must include: { label, model: "gemini-2.0-flash", prompt: "<template>" }
  http     — HTTP API request. data must include: { label, method: "GET"|"POST"|"PUT"|"DELETE", url: "<url>", headers: {}, body: {} }
  condition — If/else branch. data must include: { label, expression: "<condition>" }
             Edges from condition nodes must have sourceHandle: "true" or "false"
  action   — Integration action (email, Slack, Telegram, WhatsApp, Notion, etc.)
             data must include: { label, service: "<service>", config: {} }
  delay    — Wait for a duration. data must include: { label, duration: 60, unit: "seconds"|"minutes"|"hours" }
  transform — Data manipulation/formatting. data must include: { label, expression: "<jq or template>" }
  output   — Final output/response. data must include: { label, format: "text"|"json"|"email" }

Layout: Position nodes top-to-bottom. trigger starts at x:300, y:50. Each subsequent node adds y:120.
Branch nodes: true path x:150, false path x:450, then converge back at x:300.

Output ONLY valid JSON (no markdown code fences, no explanation) in this exact shape:
{
  "name": "<short descriptive workflow name>",
  "description": "<one-sentence summary>",
  "triggerType": "manual"|"webhook"|"schedule",
  "nodes": [ ...node objects... ],
  "edges": [ ...edge objects with id, source, target, and optional sourceHandle... ],
  "steps": [
    {
      "id": "<node id>",
      "icon": "<single emoji>",
      "type": "<node type>",
      "title": "<human-readable step title>",
      "description": "<what this step does in plain English>"
    }
  ]
}`;

interface GeneratedWorkflow {
  name: string;
  description: string;
  triggerType: string;
  nodes: unknown[];
  edges: unknown[];
  steps: { id: string; icon: string; type: string; title: string; description: string }[];
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { description?: string; model?: string };
  const description = body.description?.trim();
  if (!description) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let aiModel: any;
  try {
    aiModel = await resolveTextModel(user.userId, body.model ?? "gemini-2.0-flash");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI model unavailable" },
      { status: 503 }
    );
  }

  const { text } = await generateText({
    model: aiModel,
    system: SYSTEM_PROMPT,
    prompt: `Create a workflow for this automation: ${description}`,
    maxOutputTokens: 4096,
  });

  // Parse JSON — strip any accidental markdown fences
  let workflow: GeneratedWorkflow;
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    workflow = JSON.parse(cleaned) as GeneratedWorkflow;
  } catch {
    return NextResponse.json(
      { error: "AI returned invalid JSON. Please try rephrasing your description." },
      { status: 422 }
    );
  }

  // Basic validation
  if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
    return NextResponse.json(
      { error: "AI could not build a workflow from that description. Try being more specific." },
      { status: 422 }
    );
  }

  return NextResponse.json({ workflow });
}
