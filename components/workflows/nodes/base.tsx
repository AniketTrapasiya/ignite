/**
 * components/workflows/nodes/base.tsx
 * Shared base wrapper for all workflow nodes.
 */
"use client";
import { Handle, Position } from "@xyflow/react";
import { ReactNode } from "react";

// Color palettes per node type — border + glow + header gradient
export const NODE_PALETTE: Record<string, { border: string; glow: string; header: string; dot: string }> = {
  "border-yellow-500": { border: "border-yellow-500/70", glow: "shadow-yellow-500/20", header: "from-yellow-600/30 to-yellow-500/10", dot: "#eab308" },
  "border-blue-500": { border: "border-blue-500/70", glow: "shadow-blue-500/20", header: "from-blue-600/30 to-blue-500/10", dot: "#3b82f6" },
  "border-green-500": { border: "border-green-500/70", glow: "shadow-green-500/20", header: "from-green-600/30 to-green-500/10", dot: "#22c55e" },
  "border-purple-500": { border: "border-purple-500/70", glow: "shadow-purple-500/20", header: "from-purple-600/30 to-purple-500/10", dot: "#a855f7" },
  "border-orange-500": { border: "border-orange-500/70", glow: "shadow-orange-500/20", header: "from-orange-600/30 to-orange-500/10", dot: "#f97316" },
  "border-neutral-500": { border: "border-neutral-500/70", glow: "shadow-neutral-500/20", header: "from-neutral-600/30 to-neutral-500/10", dot: "#737373" },
  "border-cyan-500": { border: "border-cyan-500/70", glow: "shadow-cyan-500/20", header: "from-cyan-600/30 to-cyan-500/10", dot: "#06b6d4" },
  "border-pink-500": { border: "border-pink-500/70", glow: "shadow-pink-500/20", header: "from-pink-600/30 to-pink-500/10", dot: "#ec4899" },
};

interface BaseNodeProps {
  label: string;
  icon: string;
  color: string;        // key into NODE_PALETTE
  bgColor?: string;
  children?: ReactNode;
  hasInput?: boolean;
  hasOutput?: boolean;
  hasTrue?: boolean;
  hasFalse?: boolean;
  selected?: boolean;
  invalid?: boolean;    // red dot if required fields missing
}

export function BaseNode({
  label,
  icon,
  color,
  children,
  hasInput = true,
  hasOutput = true,
  hasTrue = false,
  hasFalse = false,
  selected = false,
  invalid = false,
}: BaseNodeProps) {
  const palette = NODE_PALETTE[color] ?? NODE_PALETTE["border-neutral-500"];

  return (
    <div
      className={`relative rounded-2xl shadow-xl border min-w-[190px] max-w-[250px] text-sm
        ${palette.border}
        ${selected ? `ring-2 ring-white/30 shadow-2xl ${palette.glow}` : "shadow-black/40"}
        bg-neutral-900/95 backdrop-blur
        transition-all duration-150`}
    >
      {/* Invalid indicator */}
      {invalid && (
        <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-neutral-900 z-10" title="Required fields missing" />
      )}

      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-2xl bg-gradient-to-r ${palette.header} border-b border-white/5`}>
        <span className="text-base leading-none">{icon}</span>
        <span className="text-white/90 text-xs font-semibold tracking-wide truncate flex-1">{label}</span>
        {/* Accent dot */}
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 opacity-80" style={{ background: palette.dot }} />
      </div>

      {/* Content */}
      {children && (
        <div className="px-3 py-2.5 text-neutral-400 text-xs space-y-1.5">{children}</div>
      )}

      {/* Handles */}
      {hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !border-2 !border-neutral-700"
          style={{ background: palette.dot, top: -6 }}
        />
      )}
      {hasOutput && !hasTrue && !hasFalse && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !border-2 !border-neutral-700"
          style={{ background: palette.dot, bottom: -6 }}
        />
      )}
      {hasTrue && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="true"
          style={{ left: "28%", background: "#22c55e", bottom: -6 }}
          className="!w-3 !h-3 !border-2 !border-neutral-700"
        />
      )}
      {hasFalse && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="false"
          style={{ left: "72%", background: "#ef4444", bottom: -6 }}
          className="!w-3 !h-3 !border-2 !border-neutral-700"
        />
      )}

      {/* True / False labels under condition handles */}
      {(hasTrue || hasFalse) && (
        <div className="flex justify-between px-3 pb-1 text-[9px] font-semibold">
          <span className="text-green-400" style={{ marginLeft: "10%" }}>TRUE</span>
          <span className="text-red-400" style={{ marginRight: "10%" }}>FALSE</span>
        </div>
      )}
    </div>
  );
}
