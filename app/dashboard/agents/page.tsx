"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AgentCard from "@/components/agents/agent-card";

interface AgentSummary {
  id: string;
  icon: string;
  name: string;
  description?: string | null;
  triggerType: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED";
  actions: unknown[];
  runs: { status: string; createdAt: string }[];
  _count: { runs: number };
}

export default function AgentsPageClient() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d) => { setAgents(d.agents ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = (id: string) => setAgents((prev) => prev.filter((a) => a.id !== id));
  const handleToggle = (id: string, newStatus: "ACTIVE" | "PAUSED") =>
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)));

  const active = agents.filter((a) => a.status === "ACTIVE").length;
  const totalRuns = agents.reduce((sum, a) => sum + a._count.runs, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agents</h1>
          <p className="text-white/40 text-sm mt-1">Autonomous AI workflows triggered by real-world events</p>
        </div>
        <Link
          href="/dashboard/agents/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
          style={{
            background: "linear-gradient(135deg,#6366f1,#a855f7)",
            boxShadow: "0 0 24px rgba(168,85,247,0.3)",
          }}
        >
          <span>🤖</span> New Agent
        </Link>
      </div>

      {/* Stats */}
      {agents.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Agents", value: agents.length, color: "text-white" },
            { label: "Active", value: active, color: "text-emerald-400" },
            { label: "Total Runs", value: totalRuns, color: "text-indigo-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/8 bg-white/2 p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-white/35 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div
          className="rounded-2xl p-16 text-center"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)" }}
        >
          <div className="text-5xl mb-4">🤖</div>
          <h3 className="text-lg font-bold text-white mb-2">No agents yet</h3>
          <p className="text-white/40 text-sm mb-6 max-w-sm mx-auto">
            Create your first agent — it will listen for events, run AI, and automatically execute actions like sending emails or updating spreadsheets.
          </p>

          {/* Example scenarios */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto mb-8 text-left">
            {[
              { icon: "📘", title: "Lead Qualifier", desc: "Facebook Lead → AI research → Email + CRM note" },
              { icon: "💳", title: "Payment Handler", desc: "Stripe payment → Thank-you email → Airtable log" },
              { icon: "🟠", title: "Deal Tracker", desc: "HubSpot event → AI summary → Slack alert + Notion entry" },
            ].map((ex) => (
              <div
                key={ex.title}
                className="p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="text-xl">{ex.icon}</span>
                <p className="text-xs font-semibold text-white mt-2">{ex.title}</p>
                <p className="text-[11px] text-white/35 mt-1 leading-relaxed">{ex.desc}</p>
              </div>
            ))}
          </div>

          <Link
            href="/dashboard/agents/new"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white"
            style={{
              background: "linear-gradient(135deg,#6366f1,#a855f7)",
              boxShadow: "0 0 24px rgba(168,85,247,0.3)",
            }}
          >
            🤖 Create your first agent
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((a) => (
            <AgentCard
              key={a.id}
              id={a.id}
              icon={a.icon}
              name={a.name}
              description={a.description}
              triggerType={a.triggerType}
              status={a.status}
              actionCount={a.actions.length}
              runCount={a._count.runs}
              lastRunStatus={a.runs[0]?.status}
              lastRunAt={a.runs[0]?.createdAt}
              onDelete={handleDelete}
              onToggleStatus={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
