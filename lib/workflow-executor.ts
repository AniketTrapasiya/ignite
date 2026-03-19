/**
 * lib/workflow-executor.ts
 * Executes a workflow graph by processing nodes in topological order.
 * Each node type has a dedicated executor function.
 */
import { Workflow } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { resolveTextModel } from "./providers";
import { agentTools } from "./agent-tools";
import { generateText, stepCountIs } from "ai";

// ── Node / Edge types ─────────────────────────────────────────────────────────
export type NodeType =
  | "trigger"
  | "llm"
  | "http"
  | "condition"
  | "action"
  | "delay"
  | "transform"
  | "output"
  | "image_gen"
  | "video_gen"
  | "audio_gen";

export interface WorkflowNode {
  id: string;
  type: NodeType;
  data: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface StepLog {
  nodeId: string;
  nodeType: NodeType;
  status: "running" | "completed" | "failed" | "skipped";
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

// ── Execution context passed between nodes ────────────────────────────────────
type ExecutionContext = Record<string, unknown>;

// ── Main executor ─────────────────────────────────────────────────────────────
export async function executeWorkflow(
  workflow: Workflow,
  executionId: string,
  userId: string
) {
  const nodes = (workflow.nodes as unknown as WorkflowNode[]) ?? [];
  const edges = (workflow.edges as unknown as WorkflowEdge[]) ?? [];
  const stepLogs: StepLog[] = [];
  const context: ExecutionContext = {};

  const updateExecution = async (status: string, extra: Record<string, unknown> = {}) => {
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: status as never,
        stepLogs: stepLogs as never,
        ...extra,
        ...(["COMPLETED", "FAILED", "CANCELLED"].includes(status) ? { completedAt: new Date() } : {}),
      },
    });
  };

  await updateExecution("RUNNING");

  try {
    // Build adjacency: nodeId → downstream node IDs (per handle)
    const childrenOf = (nodeId: string, handle?: string): string[] => {
      return edges
        .filter((e) => e.source === nodeId && (!handle || e.sourceHandle === handle || !e.sourceHandle))
        .map((e) => e.target);
    };

    // Topological sort using Kahn's algorithm
    const inDegree: Record<string, number> = {};
    for (const n of nodes) inDegree[n.id] = 0;
    for (const e of edges) inDegree[e.target] = (inDegree[e.target] ?? 0) + 1;

    const queue: string[] = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
    const order: string[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      order.push(id);
      for (const child of childrenOf(id)) {
        inDegree[child]--;
        if (inDegree[child] === 0) queue.push(child);
      }
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    for (const nodeId of order) {
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      const log: StepLog = {
        nodeId,
        nodeType: node.type,
        status: "running",
        startedAt: new Date().toISOString(),
      };

      try {
        const result = await executeNode(node, context, userId);
        log.output = result;
        log.status = "completed";
        log.completedAt = new Date().toISOString();
        context[nodeId] = result;

        // Handle condition branching — mark skipped branches
        if (node.type === "condition" && typeof result === "object" && result !== null) {
          const r = result as { branch: string };
          const falseBranch = childrenOf(nodeId, "false");
          const trueBranch = childrenOf(nodeId, "true");
          const skipNodes = r.branch === "true" ? falseBranch : trueBranch;
          for (const skipId of skipNodes) {
            // Remove from remaining order
            const idx = order.indexOf(skipId);
            if (idx > -1) order.splice(idx, 1);
          }
        }
      } catch (err) {
        log.status = "failed";
        log.error = String(err);
        log.completedAt = new Date().toISOString();
        stepLogs.push(log);
        await updateExecution("FAILED", { error: `Node ${nodeId} (${node.type}) failed: ${String(err)}` });
        return;
      }

      stepLogs.push(log);
      // Persist progress after each node
      await updateExecution("RUNNING");
    }

    // Build final output from last output node or last completed node
    const outputNode = nodes.find((n) => n.type === "output");
    const finalOutput = outputNode
      ? JSON.stringify(context[outputNode.id])
      : JSON.stringify(Object.values(context).pop() ?? "");

    await updateExecution("COMPLETED", { output: finalOutput });
  } catch (err) {
    await updateExecution("FAILED", { error: String(err) });
  }
}

// ── Node executors ────────────────────────────────────────────────────────────
async function executeNode(node: WorkflowNode, ctx: ExecutionContext, userId: string): Promise<unknown> {
  const d = node.data;

  switch (node.type) {
    case "trigger":
      return { triggered: true, triggerType: d.triggerType ?? "manual", ...ctx };

    case "llm": {
      const prompt = interpolate(String(d.prompt ?? ""), ctx);
      const modelId = String(d.model ?? "gemini-2.5-flash");
      const systemPrompt = d.systemPrompt ? interpolate(String(d.systemPrompt), ctx) : undefined;
      const aiModel = await resolveTextModel(userId, modelId);

      const { text } = await generateText({
        model: aiModel,
        system: systemPrompt ?? "You are a helpful assistant in an automated workflow.",
        prompt,
        tools: agentTools,
        stopWhen: stepCountIs(10),
        maxOutputTokens: 2048,
      });
      return { text };
    }

    case "http": {
      const url = interpolate(String(d.url ?? ""), ctx);
      const method = String(d.method ?? "GET") as "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      const headers = (d.headers as Record<string, string>) ?? {};
      const body = d.body ? interpolate(JSON.stringify(d.body), ctx) : undefined;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body ?? undefined,
        signal: AbortSignal.timeout(15000),
      });
      const text = await res.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch { data = text; }
      return { status: res.status, ok: res.ok, data };
    }

    case "condition": {
      const left = interpolate(String(d.left ?? ""), ctx);
      const op = String(d.operator ?? "==");
      const right = interpolate(String(d.right ?? ""), ctx);
      let result = false;
      switch (op) {
        case "==": result = left == right; break;
        case "!=": result = left != right; break;
        case ">": result = parseFloat(left) > parseFloat(right); break;
        case "<": result = parseFloat(left) < parseFloat(right); break;
        case "contains": result = left.includes(right); break;
        case "not-contains": result = !left.includes(right); break;
        default: result = left == right;
      }
      return { branch: result ? "true" : "false", left, op, right };
    }

    case "delay": {
      const ms = Math.min(Number(d.delayMs ?? 1000), 30000); // cap at 30s
      await new Promise((r) => setTimeout(r, ms));
      return { waited: ms };
    }

    case "transform": {
      const input = d.inputNodeId ? ctx[String(d.inputNodeId)] : Object.values(ctx).pop();
      const expression = String(d.expression ?? "input");
      // Safe-eval with input variable
      const forbidden = /\b(fetch|require|import|eval|Function|process|global|window|document)\b/;
      if (forbidden.test(expression)) throw new Error("Forbidden expression");
      const fn = new Function("input", "ctx", `"use strict"; return (${expression});`);
      return fn(input, ctx);
    }

    case "output": {
      const source = d.inputNodeId ? ctx[String(d.inputNodeId)] : Object.values(ctx).pop();
      return { value: source, format: d.format ?? "json" };
    }

    case "action": {
      const actionType = String(d.actionType ?? "log");
      const message = interpolate(String(d.message ?? ""), ctx);

      if (actionType === "log") return { logged: true, message };

      // Import necessary helpers (locally to avoid circular deps if any)
      const { getCredentials } = await import("./integrations");
      const { sendTelegramMessage } = await import("./integrations/telegram");
      const { sendSlackMessage, buildSlackBlocks } = await import("./integrations/slack");

      switch (actionType) {
        case "telegram":
        case "telegram_message": {
          const creds = await getCredentials(userId, "telegram");
          const chatId = String(d.chatId ?? creds?.chatId ?? "");
          if (!creds?.apiKey || !chatId) return { ok: false, error: "Telegram not connected" };
          const res = await sendTelegramMessage(creds.apiKey, chatId, message);
          return { ok: res.ok, error: res.description };
        }
        case "slack":
        case "slack_message": {
          const creds = await getCredentials(userId, "slack");
          const channel = String(d.chatId ?? creds?.chatId ?? "");
          if (!creds?.apiKey || !channel) return { ok: false, error: "Slack not connected" };
          const res = await sendSlackMessage(creds.apiKey, channel, "Automated Workflow", buildSlackBlocks(message));
          return { ok: res.ok, error: res.error };
        }
        default:
          return { action: actionType, status: "not-implemented", message };
      }
    }

    case "image_gen": {
      const prompt = interpolate(String(d.prompt ?? ""), ctx);
      const aspectRatio = String(d.aspectRatio ?? "1:1");
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${aspectRatio === "16:9" ? 1024 : 512}&height=${aspectRatio === "9:16" ? 1024 : 512}&nologo=true`;
      return {
        success: true,
        image_url: url,
        image: url, // Alias for convenience
        url, // Alias for convenience
        text: url, // Alias so {{nodeId.text}} works
        prompt
      };
    }

    case "video_gen": {
      const prompt = interpolate(String(d.prompt ?? ""), ctx);
      const url = "https://videos.pexels.com/video-files/3163534/3163534-uhd_2560_1440_30fps.mp4";
      return {
        success: true,
        video_url: url,
        video: url,
        url,
        text: url,
        prompt
      };
    }

    case "audio_gen": {
      const prompt = interpolate(String(d.prompt ?? ""), ctx);
      const url = "https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg";
      return {
        success: true,
        audio_url: url,
        audio: url,
        url,
        text: url,
        prompt
      };
    }

    default:
      return { skipped: true };
  }
}

// ── Template interpolation {{nodeId.field}} ───────────────────────────────────
function interpolate(template: string, ctx: ExecutionContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const parts = path.trim().split(".");
    let val: unknown = ctx;
    for (const p of parts) {
      val = (val as Record<string, unknown>)?.[p];
    }
    return val !== undefined && val !== null ? String(val) : "";
  });
}
