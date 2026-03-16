"use client";
import { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base";

export function TransformNode({ data, selected }: NodeProps) {
  const expression = (data as Record<string, unknown>).expression;
  return (
    <BaseNode label="Transform" icon="⚗️" color="border-cyan-500" selected={selected}>
      {expression != null && (
        <p className="font-mono text-cyan-300 text-[10px] truncate">{String(expression)}</p>
      )}
    </BaseNode>
  );
}
