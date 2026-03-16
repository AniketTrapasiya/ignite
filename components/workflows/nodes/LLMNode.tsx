"use client";
import { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base";

export function LLMNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>;
  const prompt = d.prompt != null ? String(d.prompt) : "";
  return (
    <BaseNode label="LLM" icon="🤖" color="border-blue-500" selected={selected}>
      <p className="text-blue-300 text-[10px]">{String(d.model ?? "gemini-2.5-flash")}</p>
      {prompt && <p className="line-clamp-2 text-neutral-400">{prompt}</p>}
    </BaseNode>
  );
}
