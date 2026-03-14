"use client";

import { useState, useEffect } from "react";

interface Run {
  id: string;
  prompt: string;
  status: string;
  output: string | null;
  mods: string[];
  createdAt: string;
}

interface RunHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onReplay: (prompt: string) => void;
}

const STATUS_CONFIG: Record<string, { color: string; dot: string; label: string }> = {
  COMPLETED: { color: "text-emerald-400", dot: "bg-emerald-400", label: "Done" },
  FAILED: { color: "text-red-400", dot: "bg-red-500", label: "Failed" },
  RUNNING: { color: "text-orange-400", dot: "bg-orange-400 animate-pulse", label: "Running" },
  CANCELLED: { color: "text-white/30", dot: "bg-white/20", label: "Cancelled" },
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

export default function RunHistoryPanel({ isOpen, onClose, onReplay }: RunHistoryPanelProps) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) loadRuns();
  }, [isOpen]);

  async function loadRuns() {
    setLoading(true);
    const res = await fetch("/api/engine/runs");
    if (res.ok) {
      const data = await res.json();
      setRuns(data.runs);
    }
    setLoading(false);
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-[#0f0f1a] border-r border-white/10 z-50 flex flex-col transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-lg">🕐</span>
            <h2 className="font-semibold text-white">Run History</h2>
            {runs.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/40">
                {runs.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
              <p className="text-4xl mb-3">🚀</p>
              <p className="text-white/30 text-sm">No runs yet.</p>
              <p className="text-white/20 text-xs mt-1">Fire the engine to see history here.</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {runs.map((run) => {
                const sc = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.CANCELLED;
                const isExpanded = expanded === run.id;
                return (
                  <div
                    key={run.id}
                    className="rounded-xl border border-white/8 bg-white/[0.02] hover:border-white/15 transition-all"
                  >
                    {/* Run header row */}
                    <div
                      className="flex items-start gap-3 p-3 cursor-pointer"
                      onClick={() => setExpanded(isExpanded ? null : run.id)}
                    >
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sc.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/80 truncate leading-snug">
                          {run.prompt}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs font-medium ${sc.color}`}>{sc.label}</span>
                          <span className="text-white/20 text-xs">·</span>
                          <span className="text-xs text-white/25">{timeAgo(run.createdAt)}</span>
                          {run.mods.length > 0 && (
                            <>
                              <span className="text-white/20 text-xs">·</span>
                              <span className="text-xs text-white/25">{run.mods.length} mods</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className={`text-white/20 text-xs transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                        ▾
                      </span>
                    </div>

                    {/* Expanded output */}
                    {isExpanded && run.output && (
                      <div className="px-3 pb-3 border-t border-white/5 pt-2">
                        <p className="text-xs text-white/40 font-mono whitespace-pre-wrap line-clamp-6 leading-relaxed">
                          {run.output}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => { onReplay(run.prompt); onClose(); }}
                            className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/20 transition-colors"
                          >
                            ↺ Replay
                          </button>
                          <button
                            onClick={() => navigator.clipboard.writeText(run.output!)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 border border-white/10 transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer refresh */}
        <div className="px-4 py-3 border-t border-white/10">
          <button
            onClick={loadRuns}
            disabled={loading}
            className="w-full text-xs text-white/30 hover:text-white/60 transition-colors disabled:opacity-30"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>
      </div>
    </>
  );
}
