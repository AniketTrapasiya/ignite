/**
 * app/dashboard/workflows/page.tsx
 * Workflow management dashboard — list, create, run, and build visual workflows.
 */
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "FAILED";
  triggerType: string;
  createdAt: string;
  updatedAt: string;
  _count: { executions: number };
}

const statusBadge: Record<WorkflowSummary["status"], { label: string; classes: string }> = {
  DRAFT: { label: "Draft", classes: "bg-neutral-800 text-neutral-400" },
  ACTIVE: { label: "Active", classes: "bg-green-900/50 text-green-400" },
  PAUSED: { label: "Paused", classes: "bg-yellow-900/50 text-yellow-400" },
  COMPLETED: { label: "Completed", classes: "bg-blue-900/50 text-blue-400" },
  FAILED: { label: "Failed", classes: "bg-red-900/50 text-red-400" },
};

const triggerIcon: Record<string, string> = {
  manual: "👆", webhook: "🔔", schedule: "🕐",
};

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runResults, setRunResults] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const res = await fetch("/api/workflows");
      const data = await res.json() as { workflows?: WorkflowSummary[] };
      setWorkflows(data.workflows ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json() as { workflow?: { id: string } };
      if (data.workflow) {
        router.push(`/dashboard/workflows/${data.workflow.id}/builder`);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this workflow?")) return;
    await fetch(`/api/workflows/${id}`, { method: "DELETE" });
    setWorkflows((ws) => ws.filter((w) => w.id !== id));
  };

  const handleRun = async (id: string) => {
    setRunningId(id);
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json() as { executionId?: string; error?: string };
      setRunResults((r) => ({ ...r, [id]: data.executionId ? `Running: ${data.executionId.slice(0, 8)}` : `Error: ${data.error}` }));
    } finally {
      setRunningId(null);
    }
  };

  const handleToggleActive = async (w: WorkflowSummary) => {
    const newStatus = w.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    await fetch(`/api/workflows/${w.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setWorkflows((ws) => ws.map((wf) => wf.id === w.id ? { ...wf, status: newStatus } : wf));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Workflows</h1>
          <p className="text-white/40 text-sm mt-1">Build visual automation pipelines with AI-powered nodes</p>
        </div>
        <button
          onClick={() => setShowModePicker(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
        >
          <span>+</span> New Workflow
        </button>
      </div>

      {/* ── Mode picker modal ──────────────────────────────────────────────── */}
      {showModePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Choose how to build</h2>
              <button
                onClick={() => setShowModePicker(false)}
                className="text-white/30 hover:text-white/70 text-lg transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* AI Wizard */}
              <Link
                href="/dashboard/workflows/new_workflow"
                onClick={() => setShowModePicker(false)}
                className="group flex flex-col gap-3 p-5 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-400/50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">✨</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    RECOMMENDED
                  </span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white mb-1">AI Wizard</div>
                  <div className="text-xs text-white/40 leading-relaxed">
                    Describe what you want in plain English. The AI builds the full workflow — no dragging needed.
                  </div>
                </div>
                <div className="text-xs text-indigo-400 group-hover:text-indigo-300 transition-colors mt-auto">
                  Open Wizard →
                </div>
              </Link>

              {/* Visual Builder */}
              <button
                onClick={() => { setShowModePicker(false); setShowCreate(true); }}
                className="group flex flex-col gap-3 p-5 rounded-2xl border border-white/10 bg-white/3 hover:bg-white/[0.06] hover:border-white/20 text-left transition-all"
              >
                <span className="text-2xl">🎨</span>
                <div>
                  <div className="text-sm font-semibold text-white mb-1">Visual Builder</div>
                  <div className="text-xs text-white/40 leading-relaxed">
                    Drag-and-drop node canvas with full control over every step. Best for technical users.
                  </div>
                </div>
                <div className="text-xs text-white/30 group-hover:text-white/50 transition-colors mt-auto">
                  Open Canvas →
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form
            onSubmit={handleCreate}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4"
          >
            <h2 className="text-sm font-semibold text-white">Create Workflow</h2>
            <input
              autoFocus
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              placeholder="Workflow name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium text-white transition-colors"
              >
                {creating ? "Creating..." : "Create & Open Builder"}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setNewName(""); }}
                className="px-4 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-white/70 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {workflows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: workflows.length, color: "text-white" },
            { label: "Active", value: workflows.filter((w) => w.status === "ACTIVE").length, color: "text-green-400" },
            { label: "Draft", value: workflows.filter((w) => w.status === "DRAFT").length, color: "text-neutral-400" },
            { label: "Total Runs", value: workflows.reduce((s, w) => s + w._count.executions, 0), color: "text-indigo-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/[0.08] bg-white/2 p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-white/35 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-white/30 text-sm">Loading workflows...</div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-white/[0.08]">
          <p className="text-5xl mb-4">🔗</p>
          <p className="text-white/50 font-medium mb-1">No workflows yet</p>
          <p className="text-white/25 text-sm mb-6">
            Create a workflow and build automated pipelines with AI, HTTP, conditions, and more.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/dashboard/workflows/new_workflow"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
            >
              ✨ AI Wizard
            </Link>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white/70 bg-white/[0.06] border border-white/10 hover:bg-white/[0.10] transition-colors"
            >
              🎨 Visual Builder
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {workflows.map((w) => {
            const badge = statusBadge[w.status] ?? statusBadge.DRAFT;
            return (
              <div
                key={w.id}
                className="rounded-2xl border border-white/[0.07] bg-white/2 hover:bg-white/4 transition-colors"
              >
                <div className="flex items-center gap-4 px-4 py-4">
                  <span className="text-xl shrink-0">{triggerIcon[w.triggerType] ?? "⚡"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white truncate">{w.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.classes}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {w.description && (
                        <span className="text-xs text-white/40 truncate">{w.description}</span>
                      )}
                      <span className="text-xs text-white/25">
                        {w._count.executions} run{w._count.executions !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-white/25">
                        Updated {new Date(w.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    {runResults[w.id] && (
                      <p className="text-xs text-indigo-400 mt-1">{runResults[w.id]}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleRun(w.id)}
                      disabled={runningId === w.id}
                      className="px-3 py-1.5 rounded-lg text-xs text-green-400 hover:bg-green-500/10 border border-transparent hover:border-green-500/20 disabled:opacity-50 transition-all"
                    >
                      {runningId === w.id ? "..." : "▶"}
                    </button>
                    <button
                      onClick={() => handleToggleActive(w)}
                      className={`px-3 py-1.5 rounded-lg text-xs border border-transparent transition-all ${w.status === "ACTIVE"
                        ? "text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-500/20"
                        : "text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20"
                        }`}
                    >
                      {w.status === "ACTIVE" ? "Pause" : "Activate"}
                    </button>
                    <Link
                      href={`/dashboard/workflows/${w.id}/builder`}
                      className="px-3 py-1.5 rounded-lg text-xs text-indigo-300 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 transition-all"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(w.id)}
                      className="px-3 py-1.5 rounded-lg text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
