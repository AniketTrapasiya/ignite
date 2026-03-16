"use client";

import Link from "next/link";
import { useState } from "react";

interface AgentCardProps {
  id: string;
  icon: string;
  name: string;
  description?: string | null;
  triggerType: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED";
  actionCount: number;
  runCount: number;
  lastRunStatus?: string | null;
  lastRunAt?: string | null;
  onDelete?: (id: string) => void;
  onToggleStatus?: (id: string, newStatus: "ACTIVE" | "PAUSED") => void;
}

const TRIGGER_META: Record<string, { icon: string; label: string }> = {
  manual: { icon: "⚡", label: "Manual" },
  webhook: { icon: "🌐", label: "Webhook" },
  schedule: { icon: "⏰", label: "Schedule" },
  facebook_lead: { icon: "📘", label: "Facebook Lead" },
  hubspot_event: { icon: "🟠", label: "HubSpot Event" },
  stripe_payment: { icon: "💳", label: "Stripe Payment" },
};

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  ACTIVE: { bg: "rgba(16,185,129,0.12)", color: "#34d399", dot: "#10b981", label: "Active" },
  PAUSED: { bg: "rgba(245,158,11,0.12)", color: "#fbbf24", dot: "#f59e0b", label: "Paused" },
  DRAFT: { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", dot: "rgba(255,255,255,0.25)", label: "Draft" },
};

const RUN_STATUS_COLOR: Record<string, string> = {
  COMPLETED: "#34d399",
  FAILED: "#f87171",
  RUNNING: "#818cf8",
};

export default function AgentCard({
  id, icon, name, description, triggerType, status, actionCount,
  runCount, lastRunStatus, lastRunAt, onDelete, onToggleStatus,
}: AgentCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const trigger = TRIGGER_META[triggerType] ?? { icon: "⚙️", label: triggerType };
  const ss = STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT;

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(`Delete agent "${name}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/agents/${id}`, { method: "DELETE" });
      onDelete?.(id);
    } catch {
      setIsDeleting(false);
    }
  }

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    const next: "ACTIVE" | "PAUSED" = status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    await fetch(`/api/agents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    onToggleStatus?.(id, next);
  }

  return (
    <Link
      href={`/dashboard/agents/${id}`}
      className="block rounded-2xl transition-all hover:translate-y-[-1px] relative group"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        opacity: isDeleting ? 0.5 : 1,
      }}
    >
      {/* Top gradient bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl transition-opacity opacity-0 group-hover:opacity-100"
        style={{ background: "linear-gradient(90deg,#6366f1,#a855f7)" }}
      />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {icon}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-sm truncate max-w-[180px]">{name}</h3>
              <p className="text-xs text-white/35 mt-0.5 truncate max-w-[180px]">{description ?? "No description"}</p>
            </div>
          </div>

          {/* Status badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0"
            style={{ background: ss.bg, color: ss.color }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: ss.dot }} />
            {ss.label}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <span>{trigger.icon}</span>
            <span>{trigger.label}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <span>🔧</span>
            <span>{actionCount} action{actionCount !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <span>▶</span>
            <span>{runCount} run{runCount !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Last run */}
        {lastRunAt && (
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: RUN_STATUS_COLOR[lastRunStatus ?? ""] ?? "rgba(255,255,255,0.2)" }}
            />
            <span className="text-xs text-white/30">
              Last run {new Date(lastRunAt).toLocaleDateString()} · {lastRunStatus?.toLowerCase() ?? "unknown"}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={handleToggle}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: status === "ACTIVE" ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)",
              color: status === "ACTIVE" ? "#fbbf24" : "#34d399",
              border: `1px solid ${status === "ACTIVE" ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}`,
            }}
          >
            {status === "ACTIVE" ? "⏸ Pause" : "▶ Activate"}
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400/60 hover:text-red-400 transition-all"
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.1)" }}
          >
            🗑
          </button>
        </div>
      </div>
    </Link>
  );
}
