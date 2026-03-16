"use client";
import { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base";

export function HTTPNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>;
  const method = String(d.method ?? "GET");
  const url = d.url != null ? String(d.url) : "";
  const methodColor = method === "GET" ? "text-green-400" : method === "POST" ? "text-blue-400" : "text-orange-400";
  return (
    <BaseNode label="HTTP Request" icon="🌐" color="border-green-500" selected={selected}>
      <span className={`font-mono font-bold ${methodColor}`}>{method}</span>
      {url && <p className="truncate text-neutral-400">{url}</p>}
    </BaseNode>
  );
}
