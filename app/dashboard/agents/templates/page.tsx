"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TEMPLATES = [
  {
    id: "facebook-lead-qualifier",
    icon: "📢",
    name: "Facebook Lead Qualifier",
    description: "Auto-qualifies new Facebook Lead Ad submissions with AI research and sends a personalised outreach email instantly.",
    trigger: "facebook_lead",
    triggerLabel: "Facebook Lead",
    color: "#1877f2",
    actions: ["Send Email", "Google Sheets"],
    prompt: `A new lead just came in from a Facebook ad.

Name: {{full_name}}
Email: {{email}}
Phone: {{phone_number}}
Ad: {{ad_name}}
Campaign: {{campaign_name}}

Please:
1. Write a personalised outreach email for this lead (3–4 sentences)
2. Suggest 3 follow-up talking points based on the ad they clicked
3. Rate their potential from 1–10 and justify the rating`,
    actionConfig: [
      { type: "send_email", config: { to: "{{email}}", subject: "{{ad_name}} — follow-up for {{full_name}}" } },
      { type: "google_sheets_append", config: { label: "Lead qualified" } },
    ],
    badge: "🔥 Popular",
  },
  {
    id: "stripe-payment-handler",
    icon: "💳",
    name: "Stripe Payment Handler",
    description: "Fires on every successful payment — sends a thank-you email, logs to Google Sheets and posts a Slack notification.",
    trigger: "stripe_payment",
    triggerLabel: "Stripe Payment",
    color: "#635bff",
    actions: ["Send Email", "Slack", "Google Sheets"],
    prompt: `A payment was received.

Customer: {{customer_name}}
Email: {{customer_email}}
Amount: {{amount}}
Description: {{description}}
Date: {{date}}

Please write a warm, professional thank-you message (2–3 sentences) and include a brief summary of what was purchased.`,
    actionConfig: [
      { type: "send_email", config: { to: "{{customer_email}}", subject: "Thank you for your payment, {{customer_name}}!" } },
      { type: "slack_message", config: { message: "💳 Payment received: {{amount}} from {{customer_name}}" } },
      { type: "google_sheets_append", config: { label: "Payment logged" } },
    ],
    badge: "⚡ Quick setup",
  },
  {
    id: "hubspot-deal-tracker",
    icon: "🤝",
    name: "HubSpot Deal Tracker",
    description: "Triggered by HubSpot workflow events — writes an AI deal summary, emails the sales rep and logs to Airtable.",
    trigger: "hubspot_event",
    triggerLabel: "HubSpot Event",
    color: "#ff7a59",
    actions: ["Send Email", "Airtable"],
    prompt: `A HubSpot deal event fired.

Contact: {{firstname}} {{lastname}}
Email: {{email}}
Company: {{company}}
Deal Stage: {{dealstage}}
Deal Value: {{amount}}

Summarise this deal opportunity in 2 sentences, identify the key next action, and draft a brief internal note for the sales team.`,
    actionConfig: [
      { type: "send_email", config: { to: "sales@yourcompany.com", subject: "Deal update: {{firstname}} {{lastname}} — {{dealstage}}" } },
      { type: "airtable_record", config: { label: "Deal logged" } },
    ],
  },
  {
    id: "daily-digest",
    icon: "📰",
    name: "Daily Digest Agent",
    description: "Runs on a schedule — gathers key data, produces a concise AI summary and emails it to your team every morning.",
    trigger: "schedule",
    triggerLabel: "Scheduled",
    color: "#10b981",
    actions: ["Send Email", "Telegram"],
    prompt: `Good morning! It's {{date}}.

Please compile a concise daily digest covering:
1. 3 trending topics in AI and automation (brief, one sentence each)
2. One motivational insight for the team
3. A simple priority reminder: "Today, focus on one thing that moves the needle."

Keep it short, punchy, and energising.`,
    actionConfig: [
      { type: "send_email", config: { subject: "🌅 Daily Digest — {{date}}" } },
      { type: "telegram_message", config: {} },
    ],
    badge: "📅 Schedule",
  },
  {
    id: "webhook-responder",
    icon: "🔗",
    name: "Universal Webhook Responder",
    description: "Listens for any incoming webhook — runs AI analysis on the payload and sends a structured Slack or Discord notification.",
    trigger: "webhook",
    triggerLabel: "Webhook",
    color: "#8b5cf6",
    actions: ["Slack", "Discord"],
    prompt: `An incoming webhook was received at {{timestamp}}.

Payload summary:
{{raw}}

Please:
1. Identify what type of event this is
2. Summarise the key data in 2–3 bullet points
3. Assess if action is needed (Yes/No) and why`,
    actionConfig: [
      { type: "slack_message", config: {} },
    ],
  },
  {
    id: "customer-support-triage",
    icon: "🎧",
    name: "Support Ticket Triage",
    description: "Triggered by webhook from your helpdesk — classifies the ticket with AI, routes it to the right team and sends an auto-acknowledgement.",
    trigger: "webhook",
    triggerLabel: "Webhook",
    color: "#06b6d4",
    actions: ["Send Email", "Slack", "Notion"],
    prompt: `A new support ticket was received.

Customer: {{name}}
Email: {{email}}
Subject: {{subject}}
Message: {{message}}

Please:
1. Categorise this ticket: (Billing / Technical / Account / General)
2. Assess urgency: (Low / Medium / High / Critical)
3. Draft a friendly auto-acknowledgement email (2–3 sentences)
4. Suggest the best internal team to route this to`,
    actionConfig: [
      { type: "send_email", config: { to: "{{email}}", subject: "We received your message: {{subject}}" } },
      { type: "slack_message", config: {} },
      { type: "notion_page", config: {} },
    ],
  },
  {
    id: "content-repurposer",
    icon: "🔁",
    name: "Content Repurposer",
    description: "Triggered manually — takes a long-form article or blog post and repurposes it into a Twitter thread, LinkedIn post, and a short email newsletter.",
    trigger: "manual",
    triggerLabel: "Manual",
    color: "#06b6d4",
    actions: ["Telegram", "Slack", "Send Email"],
    prompt: `Please repurpose the following content for multiple platforms.

Content:
{{content}}

Create:
1. A Twitter/X thread (5–7 tweets, numbered, punchy and engaging)
2. A LinkedIn post (professional tone, 150–200 words, ends with a question)
3. A short email newsletter snippet (100–120 words, casual and friendly)

Format each section clearly with headers.`,
    actionConfig: [
      { type: "telegram_message", config: {} },
      { type: "slack_message", config: {} },
    ],
    badge: "✍️ Content",
  },
  {
    id: "ecommerce-review-monitor",
    icon: "⭐",
    name: "Review & Feedback Monitor",
    description: "Webhook-triggered when a new review arrives — uses AI to analyse sentiment, generate a professional response, and alert your team via Slack.",
    trigger: "webhook",
    triggerLabel: "Webhook",
    color: "#f59e0b",
    actions: ["Slack", "Send Email", "Airtable"],
    prompt: `A new customer review has been submitted.

Customer: {{customer_name}}
Product: {{product_name}}
Rating: {{rating}}/5
Review: {{review_text}}
Date: {{date}}

Please:
1. Analyse the sentiment (Positive / Neutral / Negative) and why
2. Write a professional, empathetic public response (3–4 sentences)
3. If rating < 3, flag key issues for the product team
4. Suggest one internal action based on the feedback`,
    actionConfig: [
      { type: "slack_message", config: { message: "⭐ New {{rating}}/5 review from {{customer_name}}: {{review_text}}" } },
      { type: "airtable_record", config: {} },
    ],
    badge: "⭐ E-commerce",
  },
  {
    id: "team-standup-bot",
    icon: "📋",
    name: "Daily Standup Bot",
    description: "Runs every morning on schedule — collects yesterday's highlights from Notion, generates a concise team standup report and posts it to Slack.",
    trigger: "schedule",
    triggerLabel: "Scheduled",
    color: "#8b5cf6",
    actions: ["Slack", "Notion"],
    prompt: `Good morning! It's standup time — {{date}}.

Generate a daily standup summary for the team based on these points:
- What was completed yesterday: {{completed_tasks}}
- What is planned for today: {{planned_tasks}}
- Any blockers or risks: {{blockers}}

Format as:
✅ Done Yesterday (bullet points)
🎯 Today's Focus (bullet points)
🚧 Blockers (if any, otherwise "None")

Keep it concise — max 150 words total. End with one motivating sentence.`,
    actionConfig: [
      { type: "slack_message", config: {} },
      { type: "notion_page", config: {} },
    ],
    badge: "📅 Schedule",
  },
];

export default function TemplatesPage() {
  const router = useRouter();
  const [deploying, setDeploying] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const filtered = TEMPLATES.filter((t) => {
    const matchSearch =
      !search.trim() ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || t.trigger === filter;
    return matchSearch && matchFilter;
  });

  async function selectTemplate(t: typeof TEMPLATES[0]) {
    setDeploying(t.id);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: t.name,
          description: t.description,
          icon: t.icon,
          triggerType: t.trigger,
          triggerConfig: {},
          promptTemplate: t.prompt,
          actions: t.actionConfig,
          status: "DRAFT",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      router.push(`/dashboard/agents/${data.agent.id}`);
    } catch {
      setDeploying(null);
    }
  }

  const triggers = [
    { value: "all", label: "All" },
    { value: "facebook_lead", label: "Facebook Lead" },
    { value: "stripe_payment", label: "Stripe" },
    { value: "hubspot_event", label: "HubSpot" },
    { value: "webhook", label: "Webhook" },
    { value: "schedule", label: "Schedule" },
    { value: "manual", label: "Manual" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Agent Templates
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(168,85,247,0.2)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.25)" }}
            >
              {TEMPLATES.length}
            </span>
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Pre-built automation blueprints — deploy in one click, customise from the agent detail page
          </p>
        </div>
        <a
          href="/dashboard/agents/new"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white whitespace-nowrap transition-all"
          style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", boxShadow: "0 0 20px rgba(99,102,241,0.25)" }}
        >
          + Custom Agent
        </a>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-white text-sm placeholder-white/25 outline-none transition-all"
            style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)" }}
            onFocus={(e) => (e.target.style.borderColor = "#a855f7")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
          />
        </div>
        <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {triggers.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
              style={
                filter === t.value
                  ? { background: "rgba(168,85,247,0.25)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.3)" }
                  : { color: "rgba(255,255,255,0.4)" }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-white/40 text-sm">No templates match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl p-5 space-y-4 relative overflow-hidden"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {/* Color accent */}
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: t.color, opacity: 0.6 }} />

              {/* Top row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: `${t.color}18`, border: `1px solid ${t.color}30` }}
                  >
                    {t.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm leading-tight">{t.name}</h3>
                    <span
                      className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1"
                      style={{ background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}25` }}
                    >
                      {t.triggerLabel}
                    </span>
                  </div>
                </div>
                {t.badge && (
                  <span className="text-[10px] font-medium text-white/40 shrink-0">{t.badge}</span>
                )}
              </div>

              {/* Description */}
              <p className="text-sm text-white/50 leading-relaxed">{t.description}</p>

              {/* Actions pills */}
              <div className="flex flex-wrap gap-1.5">
                {t.actions.map((a) => (
                  <span
                    key={a}
                    className="text-[10px] px-2 py-1 rounded-lg font-medium"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {a}
                  </span>
                ))}
              </div>

              {/* Deploy button */}
              <button
                onClick={() => selectTemplate(t)}
                disabled={!!deploying}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: deploying === t.id ? "rgba(255,255,255,0.08)" : `linear-gradient(135deg, ${t.color}, ${t.color}cc)`,
                  boxShadow: deploying === t.id ? "none" : `0 0 20px ${t.color}30`,
                }}
              >
                {deploying === t.id ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                    </svg>
                    Creating…
                  </>
                ) : (
                  <>
                    Use Template →
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Build custom */}
      <div
        className="rounded-2xl p-6 text-center"
        style={{ background: "rgba(168,85,247,0.05)", border: "1px dashed rgba(168,85,247,0.25)" }}
      >
        <p className="text-2xl mb-2">🛠</p>
        <p className="text-white font-semibold text-sm">Need something custom?</p>
        <p className="text-white/40 text-xs mt-1 mb-4">Build your agent from scratch with the full builder wizard</p>
        <a
          href="/dashboard/agents/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
          style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}
        >
          Build Custom Agent →
        </a>
      </div>
    </div>
  );
}
