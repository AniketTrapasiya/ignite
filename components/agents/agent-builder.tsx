"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionType, TriggerType } from "@/lib/agent-runner";

// ── Type definitions ────────────────────────────────────────────────────────

interface BuilderAction {
  type: ActionType;
  config: Record<string, string>;
}

interface FormState {
  step: 1 | 2 | 3 | 4 | 5;
  name: string;
  description: string;
  icon: string;
  triggerType: TriggerType;
  triggerConfig: Record<string, string>;
  promptTemplate: string;
  actions: BuilderAction[];
  isSubmitting: boolean;
  error: string;
}

// ── Trigger definitions ─────────────────────────────────────────────────────

const TRIGGERS: {
  type: TriggerType;
  label: string;
  icon: string;
  description: string;
  badge?: string;
  vars: { key: string; desc: string }[];
}[] = [
    {
      type: "manual",
      label: "Manual",
      icon: "⚡",
      description: "Triggered by clicking 'Run' in the dashboard. Great for testing and on-demand workflows.",
      vars: [
        { key: "date", desc: "Today's date" },
        { key: "time", desc: "Current time" },
      ],
    },
    {
      type: "webhook",
      label: "Webhook",
      icon: "🌐",
      description: "Any external service can POST to your unique URL. Universal — works with anything.",
      vars: [
        { key: "date", desc: "Today's date" },
        { key: "timestamp", desc: "ISO timestamp" },
      ],
    },
    {
      type: "schedule",
      label: "Schedule",
      icon: "⏰",
      description: "Run on a recurring schedule — daily reports, weekly summaries, hourly checks.",
      badge: "Soon",
      vars: [
        { key: "date", desc: "Today's date" },
        { key: "time", desc: "Current time" },
      ],
    },
    {
      type: "facebook_lead",
      label: "Facebook Lead",
      icon: "📘",
      description: "Fires when a new lead submits your Facebook Lead Ad form. Auto-research and follow up instantly.",
      badge: "Hot",
      vars: [
        { key: "full_name", desc: "Lead's full name" },
        { key: "email", desc: "Lead's email" },
        { key: "phone_number", desc: "Lead's phone" },
        { key: "ad_name", desc: "Ad name" },
        { key: "campaign_name", desc: "Campaign name" },
      ],
    },
    {
      type: "hubspot_event",
      label: "HubSpot Event",
      icon: "🟠",
      description: "Fires on HubSpot workflow events — new contact, deal stage change, property update.",
      vars: [
        { key: "email", desc: "Contact email" },
        { key: "firstname", desc: "First name" },
        { key: "lastname", desc: "Last name" },
        { key: "company", desc: "Company" },
        { key: "deal_stage", desc: "Deal stage" },
      ],
    },
    {
      type: "stripe_payment",
      label: "Stripe Payment",
      icon: "💳",
      description: "Fires when a payment is received. Send thank-you emails, update CRM, log to sheets.",
      vars: [
        { key: "amount", desc: "Amount + currency" },
        { key: "customer_email", desc: "Customer email" },
        { key: "customer_name", desc: "Customer name" },
        { key: "description", desc: "Payment description" },
      ],
    },
  ];

// ── Action definitions ──────────────────────────────────────────────────────

const ACTIONS: {
  type: ActionType;
  label: string;
  icon: string;
  desc: string;
  fields?: { key: string; label: string; placeholder: string; hint?: string }[];
}[] = [
    {
      type: "send_email",
      label: "Send Email",
      icon: "📧",
      desc: "Email the AI result via Gmail, SendGrid, or Resend",
      fields: [
        { key: "to", label: "Recipient", placeholder: "{{email}} or you@example.com", hint: "Use {{email}} to send to the trigger's email" },
        { key: "subject", label: "Subject", placeholder: "Agent Result: {{ad_name}}" },
      ],
    },
    {
      type: "google_sheets_append",
      label: "Google Sheets",
      icon: "📊",
      desc: "Append a row with the AI result",
      fields: [
        { key: "spreadsheetId", label: "Spreadsheet ID (optional override)", placeholder: "Uses connected Sheets credential" },
        { key: "sheetName", label: "Sheet Name (optional override)", placeholder: "Sheet1" },
      ],
    },
    { type: "slack_message", label: "Slack Message", icon: "💬", desc: "Post result to Slack channel" },
    { type: "telegram_message", label: "Telegram", icon: "✈️", desc: "Send via Telegram bot" },
    { type: "discord_message", label: "Discord", icon: "🎮", desc: "Post to Discord channel" },
    {
      type: "notion_page",
      label: "Notion Page",
      icon: "📝",
      desc: "Create a page in your Notion database",
      fields: [
        { key: "chatId", label: "Database ID (optional override)", placeholder: "Uses connected Notion credential" },
      ],
    },
    {
      type: "github_issue",
      label: "GitHub Issue",
      icon: "🐙",
      desc: "Open an issue with the AI result",
      fields: [
        { key: "repo", label: "Repository (optional override)", placeholder: "owner/repo" },
        { key: "issueTitle", label: "Issue Title", placeholder: "Agent: {{full_name}} follow-up" },
      ],
    },
    {
      type: "airtable_record",
      label: "Airtable",
      icon: "🗃️",
      desc: "Create a record in your Airtable base",
    },
    {
      type: "hubspot_note",
      label: "HubSpot Note",
      icon: "🟠",
      desc: "Log a note on a HubSpot contact",
      fields: [
        { key: "contactId", label: "Contact ID (optional)", placeholder: "{{hubspot_contact_id}}" },
      ],
    },
    {
      type: "whatsapp_message",
      label: "WhatsApp",
      icon: "📲",
      desc: "Send via WhatsApp Business API",
      fields: [
        { key: "chatId", label: "Recipient Phone (optional override)", placeholder: "{{phone_number}}" },
      ],
    },
    {
      type: "twilio_sms",
      label: "Twilio SMS",
      icon: "📟",
      desc: "Send SMS via Twilio",
      fields: [
        { key: "chatId", label: "Recipient Phone (optional override)", placeholder: "{{phone_number}}" },
      ],
    },
    {
      type: "webhook_call",
      label: "Outbound Webhook",
      icon: "🔗",
      desc: "POST the result to any external URL",
      fields: [
        { key: "url", label: "Webhook URL", placeholder: "https://your-app.com/hooks/autoflow" },
        { key: "method", label: "Method", placeholder: "POST" },
      ],
    },
    {
      type: "image_gen",
      label: "Generate Image",
      icon: "🖼️",
      desc: "Create an AI image based on the result",
      fields: [
        { key: "prompt", label: "Custom Prompt (Optional)", placeholder: "Uses AI result if empty", hint: "Prefix or override the AI output" },
      ],
    },
    {
      type: "video_gen",
      label: "Generate Video",
      icon: "🎥",
      desc: "Create an AI video from the result",
    },
    {
      type: "audio_gen",
      label: "Generate Audio",
      icon: "🎵",
      desc: "Convert result to AI speech/audio",
    },
  ];

const ICONS = ["🤖", "⚡", "🚀", "🧠", "🔥", "📊", "🎯", "💼", "🌟", "⚙️", "🔮", "💡"];

// ── Sub-components ──────────────────────────────────────────────────────────

function StepBar({ currentStep }: { currentStep: number }) {
  const steps = ["Identity", "Trigger", "Intelligence", "Actions", "Deploy"];
  return (
    <div className="flex items-center gap-1 mb-8">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < currentStep;
        const active = n === currentStep;
        return (
          <div key={n} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: done ? "#10b981" : active ? "linear-gradient(135deg,#6366f1,#a855f7)" : "rgba(255,255,255,0.08)",
                  color: done || active ? "#fff" : "rgba(255,255,255,0.3)",
                  boxShadow: active ? "0 0 16px rgba(168,85,247,0.5)" : undefined,
                }}
              >
                {done ? "✓" : n}
              </div>
              <span
                className="text-[10px] font-medium hidden sm:block"
                style={{ color: active ? "#a855f7" : done ? "#10b981" : "rgba(255,255,255,0.3)" }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="h-px flex-1 mx-1 -mt-3 transition-all"
                style={{ background: done ? "#10b981" : "rgba(255,255,255,0.08)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main builder ────────────────────────────────────────────────────────────

export default function AgentBuilder() {
  const router = useRouter();
  const [state, setState] = useState<FormState>({
    step: 1,
    name: "",
    description: "",
    icon: "🤖",
    triggerType: "manual",
    triggerConfig: {},
    promptTemplate: "",
    actions: [],
    isSubmitting: false,
    error: "",
  });

  const set = (partial: Partial<FormState>) => setState((s) => ({ ...s, ...partial }));

  const trigger = TRIGGERS.find((t) => t.type === state.triggerType)!;

  // Build a default prompt template when trigger changes
  function getDefaultPrompt(type: TriggerType): string {
    switch (type) {
      case "facebook_lead":
        return "A new lead just came in from a Facebook ad.\n\nName: {{full_name}}\nEmail: {{email}}\nPhone: {{phone_number}}\nAd: {{ad_name}}\nCampaign: {{campaign_name}}\n\nPlease:\n1. Write a personalised outreach email for this lead (3–4 sentences)\n2. Suggest 3 follow-up talking points based on the ad they responded to\n3. Rate their potential from 1–10 and justify the rating";
      case "hubspot_event":
        return "A HubSpot contact event was triggered.\n\nContact: {{firstname}} {{lastname}}\nEmail: {{email}}\nCompany: {{company}}\nDeal Stage: {{deal_stage}}\n\nPlease:\n1. Summarise what this event means for the sales pipeline\n2. Suggest the ideal next action for the sales team\n3. Draft a short follow-up message for this contact";
      case "stripe_payment":
        return "A new payment was received via Stripe.\n\nAmount: {{amount}}\nCustomer: {{customer_name}} ({{customer_email}})\nDescription: {{description}}\n\nPlease:\n1. Write a personalised thank-you email for the customer\n2. Summarise this transaction for our records\n3. Suggest any upsell or retention opportunity";
      case "schedule":
        return "Today is {{date}} at {{time}}.\n\nPlease generate a comprehensive daily briefing including:\n1. Key tasks and priorities to focus on today\n2. A motivational insight for the team\n3. Any patterns or trends worth watching this week";
      default:
        return "Analyse the following data and provide a structured summary with key insights and recommended next actions:\n\n{{date}} at {{time}}";
    }
  }

  async function handleSubmit() {
    set({ isSubmitting: true, error: "" });
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name,
          description: state.description,
          icon: state.icon,
          triggerType: state.triggerType,
          triggerConfig: state.triggerConfig,
          promptTemplate: state.promptTemplate,
          actions: state.actions.map((a) => ({ type: a.type, config: a.config })),
          status: "ACTIVE",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create agent");
      router.push(`/dashboard/agents/${data.agent.id}`);
    } catch (err) {
      set({ isSubmitting: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // ── Step 1: Identity ────────────────────────────────────────────────────
  const Step1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Name your agent</h2>
        <p className="text-white/40 text-sm">Give it a name and icon so you can identify it at a glance.</p>
      </div>

      {/* Icon picker */}
      <div>
        <label className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-2 block">Icon</label>
        <div className="flex flex-wrap gap-2">
          {ICONS.map((ic) => (
            <button
              key={ic}
              onClick={() => set({ icon: ic })}
              className="w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all"
              style={{
                background: state.icon === ic ? "rgba(168,85,247,0.25)" : "rgba(255,255,255,0.05)",
                border: `1.5px solid ${state.icon === ic ? "#a855f7" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {ic}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-2 block">Agent Name *</label>
        <input
          autoFocus
          value={state.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g. Facebook Lead Qualifier"
          className="w-full px-4 py-3 rounded-xl text-white placeholder-white/25 text-sm outline-none transition-all"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1.5px solid rgba(255,255,255,0.1)",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#a855f7")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-2 block">Description</label>
        <textarea
          value={state.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="What does this agent do? (optional, helps the AI understand its purpose)"
          rows={3}
          className="w-full px-4 py-3 rounded-xl text-white placeholder-white/25 text-sm outline-none resize-none transition-all"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1.5px solid rgba(255,255,255,0.1)",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#a855f7")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
        />
      </div>

      <button
        onClick={() => set({ step: 2 })}
        disabled={!state.name.trim()}
        className="w-full py-3 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-40"
        style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}
      >
        Continue →
      </button>
    </div>
  );

  // ── Step 2: Trigger ─────────────────────────────────────────────────────
  const Step2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">What fires this agent?</h2>
        <p className="text-white/40 text-sm">Choose the event that starts this automation.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TRIGGERS.map((t) => {
          const selected = state.triggerType === t.type;
          return (
            <button
              key={t.type}
              onClick={() => {
                set({
                  triggerType: t.type,
                  triggerConfig: {},
                  promptTemplate: state.promptTemplate || getDefaultPrompt(t.type),
                });
              }}
              className="p-4 rounded-xl text-left transition-all relative"
              style={{
                background: selected ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.03)",
                border: `1.5px solid ${selected ? "#a855f7" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {t.badge && (
                <span
                  className="absolute top-3 right-3 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: t.badge === "Hot" ? "rgba(239,68,68,0.2)" : "rgba(99,102,241,0.2)",
                    color: t.badge === "Hot" ? "#f87171" : "#818cf8",
                    border: `1px solid ${t.badge === "Hot" ? "rgba(239,68,68,0.3)" : "rgba(99,102,241,0.3)"}`,
                  }}
                >
                  {t.badge}
                </span>
              )}
              <div className="text-2xl mb-2">{t.icon}</div>
              <div className="text-sm font-bold text-white mb-1">{t.label}</div>
              <div className="text-xs text-white/40 leading-relaxed">{t.description}</div>
            </button>
          );
        })}
      </div>

      {/* Trigger-specific config */}
      {state.triggerType === "webhook" && (
        <div
          className="p-4 rounded-xl"
          style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}
        >
          <p className="text-xs font-semibold text-indigo-400 mb-3">🌐 Webhook Configuration</p>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">
              Secret Token (optional) — sent in X-Agent-Secret header
            </label>
            <input
              value={state.triggerConfig.secret ?? ""}
              onChange={(e) => set({ triggerConfig: { ...state.triggerConfig, secret: e.target.value } })}
              placeholder="my-secret-token (leave blank to allow any caller)"
              className="w-full px-3 py-2 rounded-lg text-white placeholder-white/25 text-xs outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>
          <p className="text-xs text-white/30 mt-2">
            Your webhook URL will be shown after deployment: <code className="text-indigo-400">/api/webhooks/agents/[id]</code>
          </p>
        </div>
      )}

      {state.triggerType === "facebook_lead" && (
        <div
          className="p-4 rounded-xl space-y-3"
          style={{ background: "rgba(24,119,242,0.08)", border: "1px solid rgba(24,119,242,0.2)" }}
        >
          <p className="text-xs font-semibold text-blue-400">📘 Facebook Lead Ads Setup</p>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Verify Token (paste this in Facebook App &gt; Webhooks)</label>
            <input
              value={state.triggerConfig.secret ?? ""}
              onChange={(e) => set({ triggerConfig: { ...state.triggerConfig, secret: e.target.value } })}
              placeholder="my-fb-verify-token"
              className="w-full px-3 py-2 rounded-lg text-white placeholder-white/25 text-xs outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>
          <p className="text-xs text-white/30">
            After deploying, go to Facebook Developers → App → Webhooks → Subscribe to <strong className="text-white/50">leadgen</strong> field.
          </p>
        </div>
      )}

      {state.triggerType === "hubspot_event" && (
        <div
          className="p-4 rounded-xl"
          style={{ background: "rgba(255,122,89,0.08)", border: "1px solid rgba(255,122,89,0.2)" }}
        >
          <p className="text-xs font-semibold text-orange-400">🟠 HubSpot Setup</p>
          <p className="text-xs text-white/40 mt-2">
            After deploying, create a HubSpot Workflow → Add action → <strong className="text-white/60">Trigger a webhook</strong> → paste your agent webhook URL.
          </p>
        </div>
      )}

      {state.triggerType === "stripe_payment" && (
        <div
          className="p-4 rounded-xl"
          style={{ background: "rgba(99,91,255,0.08)", border: "1px solid rgba(99,91,255,0.2)" }}
        >
          <p className="text-xs font-semibold text-purple-300">💳 Stripe Setup</p>
          <p className="text-xs text-white/40 mt-2">
            After deploying, go to Stripe Dashboard → Developers → Webhooks → Add endpoint → paste your agent URL. Listen for <strong className="text-white/60">payment_intent.succeeded</strong>.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => set({ step: 1 })}
          className="flex-1 py-3 rounded-xl text-white/60 text-sm font-medium transition-all"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          ← Back
        </button>
        <button
          onClick={() => set({ step: 3, promptTemplate: state.promptTemplate || getDefaultPrompt(state.triggerType) })}
          className="flex-1 py-3 rounded-xl text-white text-sm font-bold transition-all"
          style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}
        >
          Continue →
        </button>
      </div>
    </div>
  );

  // ── Step 3: Prompt Template ─────────────────────────────────────────────
  const Step3 = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Write the AI prompt</h2>
        <p className="text-white/40 text-sm">Use <code className="text-purple-400">{"{{variable}}"}</code> to inject trigger data into the prompt.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <textarea
            value={state.promptTemplate}
            onChange={(e) => set({ promptTemplate: e.target.value })}
            placeholder="Describe what the AI should do with the trigger data..."
            rows={14}
            className="w-full px-4 py-3 rounded-xl text-white placeholder-white/25 text-sm outline-none resize-none font-mono transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1.5px solid rgba(255,255,255,0.1)",
              lineHeight: 1.7,
            }}
            onFocus={(e) => (e.target.style.borderColor = "#a855f7")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
          />
        </div>

        {/* Variable reference panel */}
        <div
          className="rounded-xl p-3 overflow-y-auto max-h-80"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Available Variables</p>
          <div className="space-y-1">
            {trigger.vars.map((v) => (
              <button
                key={v.key}
                onClick={() => set({ promptTemplate: `${state.promptTemplate}{{${v.key}}}` })}
                className="w-full text-left p-1.5 rounded-lg transition-all hover:bg-white/5 group"
              >
                <code className="text-purple-400 text-xs block group-hover:text-purple-300">{`{{${v.key}}}`}</code>
                <span className="text-[10px] text-white/30">{v.desc}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/20 mt-3 leading-relaxed">Click a variable to insert it at cursor position</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => set({ step: 2 })}
          className="flex-1 py-3 rounded-xl text-white/60 text-sm font-medium"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          ← Back
        </button>
        <button
          onClick={() => set({ step: 4 })}
          disabled={!state.promptTemplate.trim()}
          className="flex-1 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-40"
          style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}
        >
          Continue →
        </button>
      </div>
    </div>
  );

  // ── Step 4: Actions ─────────────────────────────────────────────────────
  const Step4 = () => {
    const [showPicker, setShowPicker] = useState(false);

    const addAction = (type: ActionType) => {
      set({ actions: [...state.actions, { type, config: {} }] });
      setShowPicker(false);
    };

    const removeAction = (idx: number) => {
      set({ actions: state.actions.filter((_, i) => i !== idx) });
    };

    const updateActionConfig = (idx: number, key: string, value: string) => {
      const updated = [...state.actions];
      updated[idx] = { ...updated[idx], config: { ...updated[idx].config, [key]: value } };
      set({ actions: updated });
    };

    const moveAction = (idx: number, dir: -1 | 1) => {
      const arr = [...state.actions];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      set({ actions: arr });
    };

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Build the action pipeline</h2>
          <p className="text-white/40 text-sm">After the AI generates output, these run in sequence.</p>
        </div>

        {/* Action list */}
        <div className="space-y-3">
          {state.actions.length === 0 && (
            <div
              className="p-6 rounded-xl text-center"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)" }}
            >
              <p className="text-white/30 text-sm">No actions yet — add at least one below</p>
            </div>
          )}

          {state.actions.map((action, idx) => {
            const def = ACTIONS.find((a) => a.type === action.type)!;
            return (
              <div
                key={idx}
                className="rounded-xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl shrink-0">{def.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{def.label}</p>
                    <p className="text-xs text-white/35">{def.desc}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => moveAction(idx, -1)}
                      disabled={idx === 0}
                      className="text-white/30 hover:text-white/60 disabled:opacity-20 text-sm"
                    >↑</button>
                    <button
                      onClick={() => moveAction(idx, 1)}
                      disabled={idx === state.actions.length - 1}
                      className="text-white/30 hover:text-white/60 disabled:opacity-20 text-sm"
                    >↓</button>
                    <button onClick={() => removeAction(idx)} className="text-red-400/60 hover:text-red-400 text-sm ml-1">✕</button>
                  </div>
                </div>

                {/* Action config fields */}
                {def.fields && def.fields.length > 0 && (
                  <div className="px-4 pb-4 space-y-2 pt-0">
                    {def.fields.map((f) => (
                      <div key={f.key}>
                        <label className="text-[10px] text-white/35 block mb-1">{f.label}</label>
                        <input
                          value={action.config[f.key] ?? ""}
                          onChange={(e) => updateActionConfig(idx, f.key, e.target.value)}
                          placeholder={f.placeholder}
                          className="w-full px-3 py-2 rounded-lg text-white placeholder-white/20 text-xs outline-none"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                        />
                        {f.hint && <p className="text-[10px] text-white/25 mt-0.5">{f.hint}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add action */}
        {!showPicker ? (
          <button
            onClick={() => setShowPicker(true)}
            className="w-full py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white/80 transition-all"
            style={{ background: "rgba(255,255,255,0.03)", border: "1.5px dashed rgba(255,255,255,0.12)" }}
          >
            + Add Action
          </button>
        ) : (
          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-white/60">Choose an action</p>
              <button onClick={() => setShowPicker(false)} className="text-white/30 hover:text-white/60 text-sm">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ACTIONS.map((a) => (
                <button
                  key={a.type}
                  onClick={() => addAction(a.type)}
                  className="flex items-center gap-2 p-2.5 rounded-lg text-left text-xs hover:bg-white/5 transition-all"
                  style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <span className="text-lg">{a.icon}</span>
                  <span className="text-white/70 font-medium">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => set({ step: 3 })}
            className="flex-1 py-3 rounded-xl text-white/60 text-sm font-medium"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            ← Back
          </button>
          <button
            onClick={() => set({ step: 5 })}
            className="flex-1 py-3 rounded-xl text-white text-sm font-bold"
            style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}
          >
            Review & Deploy →
          </button>
        </div>
      </div>
    );
  };

  // ── Step 5: Review & Deploy ─────────────────────────────────────────────
  const Step5 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Review & Deploy</h2>
        <p className="text-white/40 text-sm">Your agent will be deployed and ready to run immediately.</p>
      </div>

      <div className="space-y-3">
        {/* Identity */}
        <div
          className="p-4 rounded-xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">{state.icon}</span>
            <div>
              <p className="font-bold text-white">{state.name}</p>
              <p className="text-sm text-white/40">{state.description || "No description"}</p>
            </div>
          </div>
        </div>

        {/* Trigger */}
        <div
          className="p-4 rounded-xl flex items-center gap-3"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="text-2xl">{trigger.icon}</span>
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest">Trigger</p>
            <p className="text-sm font-medium text-white">{trigger.label}</p>
          </div>
        </div>

        {/* Prompt */}
        <div
          className="p-4 rounded-xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">AI Prompt</p>
          <p className="text-xs text-white/60 whitespace-pre-wrap font-mono leading-relaxed line-clamp-6">
            {state.promptTemplate}
          </p>
        </div>

        {/* Actions */}
        <div
          className="p-4 rounded-xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
            Action Pipeline ({state.actions.length} action{state.actions.length !== 1 ? "s" : ""})
          </p>
          {state.actions.length === 0 ? (
            <p className="text-xs text-white/25">No actions — AI runs but output stays in dashboard only</p>
          ) : (
            <div className="space-y-2">
              {state.actions.map((a, idx) => {
                const def = ACTIONS.find((d) => d.type === a.type)!;
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-white/20 text-xs w-4">{idx + 1}.</span>
                    <span className="text-sm">{def.icon}</span>
                    <span className="text-sm text-white/70">{def.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {state.error && (
        <div className="p-3 rounded-xl text-sm text-red-400" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {state.error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => set({ step: 4 })}
          className="flex-1 py-3 rounded-xl text-white/60 text-sm font-medium"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          ← Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={state.isSubmitting}
          className="flex-1 py-3 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 min-w-[200px]"
          style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", boxShadow: "0 0 24px rgba(168,85,247,0.4)" }}
        >
          {state.isSubmitting ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
              </svg>
              Deploying...
            </>
          ) : (
            "🚀 Deploy Agent"
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="max-w-2xl mx-auto rounded-2xl p-8"
      style={{
        background: "#0d0b1e",
        border: "1px solid rgba(120,50,255,0.2)",
        boxShadow: "0 0 60px rgba(120,50,255,0.08)",
      }}
    >
      <StepBar currentStep={state.step} />

      {state.step === 1 && Step1()}
      {state.step === 2 && Step2()}
      {state.step === 3 && Step3()}
      {state.step === 4 && Step4()}
      {state.step === 5 && Step5()}
    </div>
  );
}
