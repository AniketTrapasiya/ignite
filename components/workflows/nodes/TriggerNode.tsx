"use client";
import { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base";

export function TriggerNode({ data, selected }: NodeProps) {
  const triggerType = String((data as Record<string, unknown>).triggerType ?? "manual");
  const description = (data as Record<string, unknown>).description;
  return (
    <BaseNode label="Trigger" icon="⚡" color="border-yellow-500" hasInput={false} selected={selected}>
      <p className="truncate">{triggerType}</p>
      {description != null && <p className="text-neutral-500 truncate">{String(description)}</p>}
    </BaseNode>
  );
}
