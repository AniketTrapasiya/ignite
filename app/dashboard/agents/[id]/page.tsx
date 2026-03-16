"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────

interface AgentAction {
  id: string;
  type: string;
  config: Record<string, string>;
  order: number;
}

interface AgentRun {
  id: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  triggerData: Record<string, unknown>;
  output?: string | null;
  actionsLog: { type: string; ok: boolean; error?: string }[];
  error?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

interface Agent {
  id: string;
  icon: string;
  name: string;
  description?: string | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED";
  triggerType: string;
  triggerConfig: Record<string, string>;
  promptTemplate: string;
  actions: AgentAction[];
  runs: AgentRun[];
  _count: { runs: number };
}

// ── Utilities ─────────────────────────────────────────────────────────────

const ACTION_ICONS: Record<string, string> = {
  send_email: "📧", google_sheets_append: "📊", slack_message: "💬",
  telegram_message: "✈️", discord_message: "🎮", notion_page: "📝",
  github_issue: "🐙", airtable_record: "🗃️", hubspot_note: "🟠",
  whatsapp_message: "📲", twilio_sms: "📟", webhook_call: "🔗",
};

const ACTION_LABELS: Record<string, string> = {
  send_email: "Send Email", google_sheets_append: "Google Sheets", slack_message: "Slack",
  telegram_message: "Telegram", discord_message: "Discord", notion_page: "Notion",
  github_issue: "GitHub Issue", airtable_record: "Airtable", hubspot_note: "HubSpot Note",
  whatsapp_message: "WhatsApp", twilio_sms: "Twilio SMS", webhook_call: "Outbound Webhook",
};

const TRIGGER_META: Record<string, { icon: string; label: string }> = {
  manual: { icon: "⚡", label: "Manual" }, webhook: { icon: "🌐", label: "Webhook" },
  schedule: { icon: "⏰", label: "Schedule" }, facebook_lead: { icon: "📘", label: "Facebook Lead" },
  hubspot_event: { icon: "🟠", label: "HubSpot Event" }, stripe_payment: { icon: "💳", label: "Stripe Payment" },
};

function statusBadge(s: string) {
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    ACTIVE: { bg: "rgba(16,185,129,0.12)", text: "#34d399", dot: "#10b981" },
    PAUSED: { bg: "rgba(245,158,11,0.12)", text: "#fbbf24", dot: "#f59e0b" },
    DRAFT: { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.4)", dot: "rgba(255,255,255,0.25)" },
    RUNNING: { bg: "rgba(99,102,241,0.12)", text: "#818cf8", dot: "#6366f1" },
    COMPLETED: { bg: "rgba(16,185,129,0.12)", text: "#34d399", dot: "#10b981" },
    FAILED: { bg: "rgba(239,68,68,0.12)", text: "#f87171", dot: "#ef4444" },
  };
  const m = map[s] ?? map.DRAFT;
  return (
    <span
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: m.bg, color: m.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      {s.charAt(0) + s.slice(1).toLowerCase()}
    </span>
  );
}

function durationMs(run: AgentRun) {
  if (!run.completedAt) return null;
  const ms = new Date(run.completedAt).getTime() - new Date(run.createdAt).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// ── Run detail drawer ─────────────────────────────────────────────────────

function RunDrawer({ run, onClose }: { run: AgentRun; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl p-6"
        style={{ background: "#0d0b1e", border: "1px solid rgba(120,50,255,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-white">Run Detail</h3>
            {statusBadge(run.status)}
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60">✕</button>
        </div>

        <div className="space-y-4">
          {/* Trigger data */}
          {Object.keys(run.triggerData).length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Trigger Data</p>
              <div className="rounded-xl p-3 overflow-x-auto" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <pre className="text-xs text-white/60 font-mono whitespace-pre-wrap">
                  {JSON.stringify(run.triggerData, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* AI output */}
          {run.output && (
            <div>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">AI Output</p>
              <div className="rounded-xl p-4" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
                <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{run.output}</p>
              </div>
            </div>
          )}

          {/* Error */}
          {run.error && (
            <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <p className="text-xs font-semibold text-red-400 mb-1">Error</p>
              <p className="text-xs text-red-300/80">{run.error}</p>
            </div>
          )}

          {/* Actions log */}
          {run.actionsLog.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">
                Action Results ({run.actionsLog.length})
              </p>
              <div className="space-y-2">
                {run.actionsLog.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{
                      background: a.ok ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
                      border: `1px solid ${a.ok ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`,
                    }}
                  >
                    <span className="text-lg">{ACTION_ICONS[a.type] ?? "⚙️"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white/80">{ACTION_LABELS[a.type] ?? a.type}</p>
                      {a.error && <p className="text-xs text-red-400 mt-0.5">{a.error}</p>}
                    </div>
                    <span className="text-sm font-bold" style={{ color: a.ok ? "#34d399" : "#f87171" }}>
                      {a.ok ? "✓" : "✗"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/agents/${params.id}`);
    const data = await res.json();
    setAgent(data.agent ?? null);
    setLoading(false);
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  async function handleRunNow() {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch(`/api/agents/${params.id}/run`, { method: "POST" });
      const data = await res.json();
      setRunResult(data.output ?? data.error ?? "Completed");
      load(); // refresh runs
    } catch (err) {
      setRunResult(err instanceof Error ? err.message : "Failed");
    } finally {
      setRunning(false);
    }
  }

  async function handleToggleStatus() {
    if (!agent) return;
    const next = agent.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    await fetch(`/api/agents/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setAgent((a) => a ? { ...a, status: next } : null);
  }

  function copyWebhookUrl() {
    const url = `${window.location.origin}/api/webhooks/agents/${params.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
        ))}
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-6 text-center">
        <p className="text-white/40">Agent not found</p>
        <Link href="/dashboard/agents" className="text-indigo-400 text-sm mt-2 block">← Back to Agents</Link>
      </div>
    );
  }

  const trigger = TRIGGER_META[agent.triggerType] ?? { icon: "⚙️", label: agent.triggerType };
  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/agents/${agent.id}` : `/api/webhooks/agents/${agent.id}`;
  const needsWebhookUrl = ["webhook", "facebook_lead", "hubspot_event", "stripe_payment"].includes(agent.triggerType);

  const completedRuns = agent.runs.filter((r) => r.status === "COMPLETED").length;
  const failedRuns = agent.runs.filter((r) => r.status === "FAILED").length;

  return (
    <>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Back */}
        <Link href="/dashboard/agents" className="flex items-center gap-1 text-sm text-white/40 hover:text-white/70 transition-colors w-fit">
          ← Agents
        </Link>

        {/* Agent header */}
        <div
          className="rounded-2xl p-6"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {agent.icon}
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold text-white">{agent.name}</h1>
                  {statusBadge(agent.status)}
                </div>
                {agent.description && <p className="text-sm text-white/40 mt-1">{agent.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-white/35">
                  <span>{trigger.icon} {trigger.label}</span>
                  <span>·</span>
                  <span>🔧 {agent.actions.length} action{agent.actions.length !== 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span>▶ {agent._count.runs} run{agent._count.runs !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {agent.triggerType === "manual" && (
                <button
                  onClick={handleRunNow}
                  disabled={running || agent.status !== "ACTIVE"}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all"
                  style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}
                >
                  {running ? (
                    <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                    </svg> Running...</>
                  ) : "▶ Run Now"}
                </button>
              )}
              <button
                onClick={handleToggleStatus}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: agent.status === "ACTIVE" ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)",
                  color: agent.status === "ACTIVE" ? "#fbbf24" : "#34d399",
                  border: `1px solid ${agent.status === "ACTIVE" ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}`,
                }}
              >
                {agent.status === "ACTIVE" ? "⏸ Pause" : "▶ Activate"}
              </button>
            </div>
          </div>
        </div>

        {/* Run result */}
        {runResult && (
          <div
            className="p-4 rounded-xl"
            style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}
          >
            <p className="text-xs font-bold text-indigo-400 mb-2">Latest Run Output</p>
            <p className="text-sm text-white/80 whitespace-pre-wrap">{runResult}</p>
          </div>
        )}

        {/* Webhook URL */}
        {needsWebhookUrl && (
          <div
            className="p-4 rounded-xl"
            style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)" }}
          >
            <p className="text-xs font-semibold text-indigo-400 mb-2">
              {trigger.icon} {trigger.label} Webhook URL
            </p>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 text-xs text-white/60 px-3 py-2 rounded-lg overflow-hidden text-ellipsis whitespace-nowrap"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                {webhookUrl}
              </code>
              <button
                onClick={copyWebhookUrl}
                className="px-3 py-2 rounded-lg text-xs font-medium transition-all shrink-0"
                style={{
                  background: copied ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.08)",
                  color: copied ? "#34d399" : "rgba(255,255,255,0.6)",
                  border: `1px solid ${copied ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.12)"}`,
                }}
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
            <p className="text-[10px] text-white/25 mt-2">
              {agent.triggerType === "facebook_lead"
                ? "Subscribe this URL in Facebook App → Webhooks → leadgen field"
                : agent.triggerType === "hubspot_event"
                  ? "Add this URL in HubSpot Workflow → Trigger a webhook action"
                  : agent.triggerType === "stripe_payment"
                    ? "Add this URL in Stripe Dashboard → Developers → Webhooks"
                    : "Any service can POST JSON to this URL to trigger the agent"}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Action pipeline */}
          <div
            className="md:col-span-1 rounded-2xl p-5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Action Pipeline</p>
            {agent.actions.length === 0 ? (
              <p className="text-xs text-white/25">No actions configured</p>
            ) : (
              <div className="space-y-2">
                {agent.actions.map((action, idx) => (
                  <div key={action.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                        style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.2)" }}
                      >
                        {ACTION_ICONS[action.type] ?? "⚙️"}
                      </div>
                      {idx < agent.actions.length - 1 && (
                        <div className="w-px h-4 mt-1" style={{ background: "rgba(99,102,241,0.2)" }} />
                      )}
                    </div>
                    <div className="pt-0.5">
                      <p className="text-xs font-medium text-white/70">{ACTION_LABELS[action.type] ?? action.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Run stats */}
          <div
            className="md:col-span-2 rounded-2xl p-5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Run Statistics</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total", value: agent._count.runs, color: "text-white" },
                { label: "Completed", value: completedRuns, color: "text-emerald-400" },
                { label: "Failed", value: failedRuns, color: "text-red-400" },
              ].map((s) => (
                <div key={s.label}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-white/30">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Prompt preview */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">AI Prompt Template</p>
          <pre className="text-xs text-white/50 font-mono whitespace-pre-wrap leading-relaxed line-clamp-8">
            {agent.promptTemplate || "No prompt configured"}
          </pre>
        </div>

        {/* Run history */}
        <div>
          <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest mb-4">Recent Runs</h2>
          {agent.runs.length === 0 ? (
            <div
              className="text-center p-8 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}
            >
              <p className="text-white/25 text-sm">No runs yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {agent.runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => setSelectedRun(run)}
                  className="w-full text-left rounded-xl px-4 py-3 transition-all hover:bg-white/3"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {statusBadge(run.status)}
                      <span className="text-xs text-white/40">
                        {new Date(run.createdAt).toLocaleDateString()} {new Date(run.createdAt).toLocaleTimeString()}
                      </span>
                      {run.completedAt && (
                        <span className="text-xs text-white/25">{durationMs(run)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {run.actionsLog.length > 0 && (
                        <span className="text-xs text-white/30">
                          {run.actionsLog.filter((a) => a.ok).length}/{run.actionsLog.length} actions
                        </span>
                      )}
                      <span className="text-white/20 text-xs">View →</span>
                    </div>
                  </div>
                  {run.output && (
                    <p className="text-xs text-white/30 mt-2 truncate">{run.output.slice(0, 120)}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedRun && (
        <RunDrawer run={selectedRun} onClose={() => setSelectedRun(null)} />
      )}
    </>
  );
}
