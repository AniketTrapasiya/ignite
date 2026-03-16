"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WorkflowStep {
  id: string;
  icon: string;
  type: string;
  title: string;
  description: string;
}

interface GeneratedWorkflow {
  name: string;
  description: string;
  triggerType: string;
  nodes: unknown[];
  edges: unknown[];
  steps: WorkflowStep[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Node type metadata for step cards
// ─────────────────────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  trigger: { border: "border-emerald-500/40", bg: "bg-emerald-500/10", text: "text-emerald-300", dot: "bg-emerald-400" },
  llm: { border: "border-purple-500/40", bg: "bg-purple-500/10", text: "text-purple-300", dot: "bg-purple-400" },
  http: { border: "border-cyan-500/40", bg: "bg-cyan-500/10", text: "text-cyan-300", dot: "bg-cyan-400" },
  condition: { border: "border-yellow-500/40", bg: "bg-yellow-500/10", text: "text-yellow-300", dot: "bg-yellow-400" },
  action: { border: "border-pink-500/40", bg: "bg-pink-500/10", text: "text-pink-300", dot: "bg-pink-400" },
  delay: { border: "border-orange-500/40", bg: "bg-orange-500/10", text: "text-orange-300", dot: "bg-orange-400" },
  transform: { border: "border-blue-500/40", bg: "bg-blue-500/10", text: "text-blue-300", dot: "bg-blue-400" },
  output: { border: "border-indigo-500/40", bg: "bg-indigo-500/10", text: "text-indigo-300", dot: "bg-indigo-400" },
};

const TYPE_LABELS: Record<string, string> = {
  trigger: "Trigger", llm: "AI", http: "HTTP", condition: "Condition",
  action: "Action", delay: "Delay", transform: "Transform", output: "Output",
};

// ─────────────────────────────────────────────────────────────────────────────
// Example prompts
// ─────────────────────────────────────────────────────────────────────────────

const EXAMPLES = [
  {
    icon: "📧",
    label: "Email & Slack alert",
    prompt: "When a webhook arrives with a customer complaint, use AI to classify severity, send a support email to the customer, and post a Slack alert to #support with priority level",
  },
  {
    icon: "🤖",
    label: "WhatsApp auto-reply",
    prompt: "When someone sends a WhatsApp message, use AI to generate a helpful reply, check if they asked about pricing, and if yes send them a pricing PDF via email",
  },
  {
    icon: "📊",
    label: "Daily report",
    prompt: "Every day at 9am, fetch data from our API, summarize it with AI, and send a report email to the team",
  },
  {
    icon: "🔗",
    label: "Lead capture",
    prompt: "When a form submission webhook fires, save the lead to Notion, send a welcome email, and after 2 hours send a follow-up email with a demo link",
  },
  {
    icon: "🧹",
    label: "Content moderation",
    prompt: "Receive a webhook with user-submitted content, use AI to check if it violates our rules, if yes block it and notify via Telegram, if no publish it and log to Notion",
  },
  {
    icon: "💬",
    label: "Telegram bot",
    prompt: "When a Telegram message arrives, use AI to understand the intent, search the web if needed, and reply with a helpful answer",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Step card
// ─────────────────────────────────────────────────────────────────────────────

function StepCard({ step, index, total }: { step: WorkflowStep; index: number; total: number }) {
  const colors = NODE_COLORS[step.type] ?? NODE_COLORS.action;
  const isLast = index === total - 1;

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <div
        className={`w-full rounded-2xl border ${colors.border} ${colors.bg} p-5 flex items-start gap-4 transition-all group`}
      >
        {/* Step number + icon */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${colors.bg} border ${colors.border}`}
          >
            {step.icon}
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
            {TYPE_LABELS[step.type] ?? step.type}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold ${colors.text} mb-0.5`}>{step.title}</div>
          <div className="text-xs text-white/50 leading-relaxed">{step.description}</div>
        </div>

        {/* Step index */}
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-white/25 font-mono">
          {index + 1}
        </div>
      </div>

      {/* Connector arrow (not on last item) */}
      {!isLast && (
        <div className="flex flex-col items-center my-1">
          <div className="w-px h-5 bg-white/10" />
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
            <path d="M6 8L0 0h12L6 8z" fill="rgba(255,255,255,0.15)" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────────────────────────────────────────

function ThinkingAnimation() {
  return (
    <div className="flex flex-col items-center gap-6 py-20">
      {/* Pulsing chain of nodes */}
      <div className="flex items-center gap-2">
        {["🎯", "⚡", "🤖", "🔗", "✅"].map((icon, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg"
              style={{
                animation: `pulse 1.5s ease-in-out ${i * 0.3}s infinite`,
              }}
            >
              {icon}
            </div>
            {i < 4 && <div className="w-4 h-px bg-white/10" />}
          </div>
        ))}
      </div>

      <div className="text-center space-y-1">
        <p className="text-white/60 text-sm font-medium">Building your workflow…</p>
        <p className="text-white/25 text-xs">AI is designing the automation steps</p>
      </div>

      {/* Animated dots */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-indigo-500/60"
            style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4;transform:scale(.9)} 50%{opacity:1;transform:scale(1)} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

type PageState = "idle" | "generating" | "preview" | "saving";

export default function NewWorkflowPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>("idle");
  const [description, setDescription] = useState("");
  const [workflow, setWorkflow] = useState<GeneratedWorkflow | null>(null);
  const [workflowName, setWorkflowName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Generate from description ─────────────────────────────────────────────
  const generate = async () => {
    if (!description.trim() || state === "generating") return;
    setError(null);
    setState("generating");

    try {
      const res = await fetch("/api/workflows/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      });
      const data = await res.json() as { workflow?: GeneratedWorkflow; error?: string };

      if (!res.ok || data.error) {
        setError(data.error ?? "Generation failed. Please try again.");
        setState("idle");
        return;
      }

      setWorkflow(data.workflow!);
      setWorkflowName(data.workflow!.name);
      setState("preview");
    } catch {
      setError("Network error. Please check your connection and try again.");
      setState("idle");
    }
  };

  // ── Regenerate (back to idle with same description) ───────────────────────
  const regenerate = () => {
    setWorkflow(null);
    setState("idle");
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // ── Save workflow ─────────────────────────────────────────────────────────
  const save = async (openBuilder: boolean) => {
    if (!workflow) return;
    setState("saving");

    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workflowName.trim() || workflow.name,
          description: workflow.description,
          nodes: workflow.nodes,
          edges: workflow.edges,
          triggerType: workflow.triggerType,
        }),
      });
      const data = await res.json() as { workflow?: { id: string }; error?: string };

      if (!res.ok || data.error) {
        setError(data.error ?? "Save failed. Please try again.");
        setState("preview");
        return;
      }

      if (openBuilder) {
        router.push(`/dashboard/workflows/${data.workflow!.id}/builder`);
      } else {
        router.push("/dashboard/workflows");
      }
    } catch {
      setError("Network error while saving.");
      setState("preview");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render: IDLE state
  // ─────────────────────────────────────────────────────────────────────────

  if (state === "idle" || state === "generating") {
    return (
      <div className="min-h-screen bg-[#080810] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06]">
          <Link
            href="/dashboard/workflows"
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            ← Workflows
          </Link>
          <span className="text-white/15">/</span>
          <span className="text-xs text-white/50">AI Workflow Wizard</span>
          <div className="flex-1" />
          <Link
            href="/dashboard/workflows"
            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white/50"
          >
            Use Visual Builder instead →
          </Link>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-3xl mx-auto w-full">
          {state === "generating" ? (
            <ThinkingAnimation />
          ) : (
            <>
              {/* Hero */}
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 mb-4">
                  ✨ AI Workflow Wizard
                </div>
                <h1 className="text-3xl font-bold text-white mb-3 leading-tight">
                  Describe your automation
                </h1>
                <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
                  Tell the AI what you want to automate in plain English — no dragging, no config.
                  It will design the full workflow for you.
                </p>
              </div>

              {/* Input */}
              <div className="w-full space-y-3">
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    autoFocus
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
                    }}
                    placeholder="e.g. When I receive a webhook with a new order, use AI to check if it's a high-value customer, send them a personalised thank-you email, and post to our #sales Slack channel…"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/20 leading-relaxed transition-colors"
                  />
                  <div className="absolute bottom-3.5 right-3.5 text-[10px] text-white/20">
                    ⌘↵ to generate
                  </div>
                </div>

                {error && (
                  <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    ⚠ {error}
                  </div>
                )}

                <button
                  onClick={generate}
                  disabled={!description.trim()}
                  className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
                >
                  Generate Workflow ✨
                </button>
              </div>

              {/* Example prompts */}
              <div className="w-full mt-10">
                <p className="text-xs text-white/25 uppercase tracking-widest mb-4 text-center">
                  or pick an example
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.label}
                      onClick={() => {
                        setDescription(ex.prompt);
                        setTimeout(() => textareaRef.current?.focus(), 50);
                      }}
                      className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] hover:border-white/[0.12] text-left transition-all"
                    >
                      <span className="text-xl">{ex.icon}</span>
                      <div>
                        <div className="text-sm font-medium text-white/70">{ex.label}</div>
                        <div className="text-xs text-white/30 mt-0.5 leading-relaxed line-clamp-2">{ex.prompt}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: PREVIEW state
  // ─────────────────────────────────────────────────────────────────────────

  if ((state === "preview" || state === "saving") && workflow) {
    return (
      <div className="min-h-screen bg-[#080810] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <button
            onClick={regenerate}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            ← Back
          </button>
          <span className="text-white/15">/</span>
          <span className="text-xs text-white/50">AI Workflow Wizard</span>
          <div className="flex-1" />
          <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
            ✓ Generated
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
            {/* Workflow name */}
            <div className="text-center space-y-3">
              <div className="text-xs text-white/30 uppercase tracking-widest">Your workflow is ready</div>
              {editingName ? (
                <input
                  autoFocus
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
                  className="text-2xl font-bold text-white bg-transparent border-b border-indigo-400/50 focus:outline-none text-center w-full"
                />
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="group flex items-center gap-2 mx-auto"
                >
                  <h2 className="text-2xl font-bold text-white group-hover:text-white/80 transition-colors">
                    {workflowName}
                  </h2>
                  <span className="text-white/20 group-hover:text-white/50 transition-colors text-xs">
                    ✏
                  </span>
                </button>
              )}
              <p className="text-sm text-white/40 max-w-md mx-auto leading-relaxed">
                {workflow.description}
              </p>

              {/* Stats row */}
              <div className="flex items-center justify-center gap-6 text-xs text-white/30 mt-2">
                <span>{workflow.steps.length} step{workflow.steps.length !== 1 ? "s" : ""}</span>
                <span className="w-px h-3 bg-white/10" />
                <span className="capitalize">{workflow.triggerType} trigger</span>
                <span className="w-px h-3 bg-white/10" />
                <span>{workflow.nodes.length} node{workflow.nodes.length !== 1 ? "s" : ""}</span>
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-0">
              {workflow.steps.map((step, i) => (
                <StepCard key={step.id} step={step} index={i} total={workflow.steps.length} />
              ))}
            </div>

            {/* Description recap */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-4 text-xs text-white/35 leading-relaxed">
              <span className="text-white/20 mr-2">Your description:</span>
              {description}
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                ⚠ {error}
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-3 pb-10">
              <button
                onClick={() => save(true)}
                disabled={state === "saving"}
                className="w-full py-4 rounded-2xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
              >
                {state === "saving" ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Saving…
                  </span>
                ) : (
                  "Save & Open Visual Builder →"
                )}
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => save(false)}
                  disabled={state === "saving"}
                  className="flex-1 py-3 rounded-2xl text-sm font-medium text-white/60 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-all disabled:opacity-50"
                >
                  Save without editing
                </button>
                <button
                  onClick={regenerate}
                  disabled={state === "saving"}
                  className="flex-1 py-3 rounded-2xl text-sm font-medium text-white/60 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-all disabled:opacity-50"
                >
                  ↺ Regenerate
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
