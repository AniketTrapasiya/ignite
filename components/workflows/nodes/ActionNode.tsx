"use client";
import { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base";

export function ActionNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>;
  const actionType = String(d.actionType ?? "log");
  const icons: Record<string, string> = {
    telegram: "✈️", slack: "💬", email: "📧", webhook: "🔔", log: "📋", discord: "🎮",
  };
  return (
    <BaseNode label="Action" icon={icons[actionType] ?? "⚙️"} color="border-orange-500" selected={selected}>
      <p className="capitalize text-orange-300">{actionType}</p>
      {d.message != null && <p className="truncate text-neutral-400">{String(d.message)}</p>}
    </BaseNode>
  );
}
