"use client";
import { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base";

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>;
  return (
    <BaseNode
      label="Condition"
      icon="🔀"
      color="border-purple-500"
      hasTrue
      hasFalse
      selected={selected}
    >
      <p className="text-purple-300 font-mono text-[10px]">
        {`{{${String(d.left ?? "?")}}} ${String(d.operator ?? "==")} ${String(d.right ?? "?")}`}
      </p>

    </BaseNode>
  );
}
