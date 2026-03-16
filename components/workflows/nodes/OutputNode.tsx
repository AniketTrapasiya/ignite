"use client";
import { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base";

export function OutputNode({ data, selected }: NodeProps) {
  return (
    <BaseNode label="Output" icon="📤" color="border-pink-500" hasOutput={false} selected={selected}>
      <p className="text-pink-300 capitalize">{String((data as Record<string, unknown>).format ?? "json")}</p>
    </BaseNode>
  );
}
