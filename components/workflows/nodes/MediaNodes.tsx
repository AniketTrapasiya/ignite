"use client";
import { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base";

export function ImageGenNode({ data, selected }: NodeProps) {
  const d = data as { prompt?: string; status?: "pending" | "running" | "completed" | "failed"; aspectRatio?: string };
  return (
    <BaseNode label="Image Gen" icon="🖼️" color="border-pink-500" selected={selected} status={d.status}>
      <p className="text-neutral-400 line-clamp-2">{String(d.prompt || "No prompt set")}</p>
      {d.aspectRatio && <p className="text-[10px] text-pink-400/70 font-mono mt-1">Ratio: {String(d.aspectRatio)}</p>}
    </BaseNode>
  );
}

export function VideoGenNode({ data, selected }: NodeProps) {
  const d = data as { prompt?: string; status?: "pending" | "running" | "completed" | "failed" };
  return (
    <BaseNode label="Video Gen" icon="🎥" color="border-purple-500" selected={selected} status={d.status}>
      <p className="text-neutral-400 line-clamp-2">{String(d.prompt || "No prompt set")}</p>
    </BaseNode>
  );
}

export function AudioGenNode({ data, selected }: NodeProps) {
  const d = data as { prompt?: string; status?: "pending" | "running" | "completed" | "failed" };
  return (
    <BaseNode label="Audio Gen" icon="🎵" color="border-blue-500" selected={selected} status={d.status}>
      <p className="text-neutral-400 line-clamp-2">{String(d.prompt || "No prompt set")}</p>
    </BaseNode>
  );
}
