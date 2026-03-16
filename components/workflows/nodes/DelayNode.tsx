"use client";
import { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base";

export function DelayNode({ data, selected }: NodeProps) {
  const ms = Number((data as Record<string, unknown>).delayMs ?? 1000);
  const display = ms >= 60000 ? `${ms / 60000}m` : ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`;
  return (
    <BaseNode label="Delay" icon="⏱️" color="border-neutral-500" selected={selected}>
      <p className="text-neutral-300 font-mono">{display}</p>
    </BaseNode>
  );
}
