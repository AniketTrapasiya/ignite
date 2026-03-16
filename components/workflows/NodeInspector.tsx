/**
 * components/workflows/NodeInspector.tsx
 * Right-panel configuration form for the selected node.
 * Includes: per-field validation, copy reference helper, node notes.
 */
"use client";
import { useState } from "react";
import { WorkflowNode, NodeType } from "@/lib/workflow-executor";

interface Props {
  node: WorkflowNode;
  onChange: (id: string, data: Record<string, unknown>) => void;
  onCommit?: (id: string, data: Record<string, unknown>) => void;
  onDelete?: (id: string) => void;
}

const modelOptions = [
  "gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-pro",
  "gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet-20241022", "llama-3.3-70b-versatile",
];

const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const operators = ["==", "!=", ">", "<", ">=", "<=", "contains", "not-contains", "startsWith", "endsWith"];
const actionTypes = ["log", "telegram", "slack", "email", "discord", "webhook", "whatsapp", "notion", "github"];
const triggerTypes = ["manual", "webhook", "schedule"];

export function NodeInspector({ node, onChange, onCommit, onDelete }: Props) {
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const set = (key: string, value: unknown) => {
    onChange(node.id, { ...node.data, [key]: value });
  };

  const commit = (key: string, value: unknown) => {
    const next = { ...node.data, [key]: value };
    onChange(node.id, next);
    onCommit?.(node.id, next);
  };

  const copyRef = (field: string) => {
    const ref = `{{${node.id}.${field}}}`;
    navigator.clipboard.writeText(ref);
    setCopiedRef(field);
    setTimeout(() => setCopiedRef(null), 1500);
  };

  // Field component
  const field = (label: string, key: string, opts?: {
    type?: string; placeholder?: string; rows?: number; required?: boolean; hint?: string;
  }) => {
    const val = String(node.data[key] ?? "");
    const isEmpty = opts?.required && !val.trim();
    return (
      <div key={key}>
        <div className="flex items-center justify-between mb-1">
          <label className={`text-[11px] font-medium ${isEmpty ? "text-red-400" : "text-white/50"}`}>
            {label}{opts?.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          <button
            onClick={() => copyRef(key)}
            title={`Copy reference {{${node.id}.${key}}}`}
            className="text-[9px] text-white/20 hover:text-indigo-400 transition-colors font-mono"
          >
            {copiedRef === key ? "âœ“" : "{{}}"}
          </button>
        </div>
        {opts?.rows ? (
          <textarea
            className={`w-full bg-black/30 border rounded-lg px-2.5 py-2 text-xs text-white/80 resize-none
              focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/20 transition-colors
              placeholder-white/20
              ${isEmpty ? "border-red-500/50" : "border-white/10"}`}
            rows={opts.rows}
            value={val}
            onChange={(e) => set(key, e.target.value)}
            onBlur={(e) => commit(key, e.target.value)}
            placeholder={opts?.placeholder}
          />
        ) : (
          <input
            className={`w-full bg-black/30 border rounded-lg px-2.5 py-2 text-xs text-white/80
              focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/20 transition-colors
              placeholder-white/20
              ${isEmpty ? "border-red-500/50" : "border-white/10"}`}
            type={opts?.type ?? "text"}
            value={val}
            onChange={(e) => set(key, e.target.value)}
            onBlur={(e) => commit(key, e.target.value)}
            placeholder={opts?.placeholder}
          />
        )}
        {opts?.hint && <p className="text-[10px] text-white/20 mt-1 leading-relaxed">{opts.hint}</p>}
        {isEmpty && <p className="text-[10px] text-red-400/70 mt-1">Required field</p>}
      </div>
    );
  };

  const select = (label: string, key: string, options: string[]) => (
    <div key={key}>
      <label className="block text-[11px] font-medium text-white/50 mb-1">{label}</label>
      <select
        className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white/80
          focus:outline-none focus:border-indigo-400/50 transition-colors"
        value={String(node.data[key] ?? options[0])}
        onChange={(e) => { set(key, e.target.value); onCommit?.(node.id, { ...node.data, [key]: e.target.value }); }}
      >
        {options.map((o) => <option key={o} value={o} className="bg-neutral-900">{o}</option>)}
      </select>
    </div>
  );

  const typeLabel: Record<NodeType, string> = {
    trigger: "⚡ Trigger", llm: "🤖 LLM / AI", http: "ðŸŒ HTTP Request",
    condition: "🔀 Condition", action: "âš™ï¸ Action", delay: "⏱ Delay",
    transform: "âš—ï¸ Transform", output: "📤 Output",
  };

  const renderFields = () => {
    switch (node.type as NodeType) {
      case "trigger":
        return (
          <>
            {select("Trigger Type", "triggerType", triggerTypes)}
            {String(node.data.triggerType ?? "manual") === "schedule" && field("Cron Expression", "cron", { placeholder: "0 9 * * *", hint: "Standard cron: min hour day month weekday" })}
            {String(node.data.triggerType ?? "manual") === "webhook" && field("Webhook Path", "webhookPath", { placeholder: "/webhooks/my-trigger", hint: "Relative path for the webhook endpoint" })}
            {field("Label / Description", "description", { placeholder: "What starts this workflow?" })}
          </>
        );
      case "llm":
        return (
          <>
            {select("Model", "model", modelOptions)}
            {field("System Prompt", "systemPrompt", { rows: 3, placeholder: "You are a helpful assistant..." })}
            {field("User Prompt / Template", "prompt", { rows: 4, placeholder: "Summarize: {{trigger.data.text}}", required: true, hint: "Use {{nodeId.field}} to reference previous outputs" })}
            {field("Temperature (0-1)", "temperature", { type: "number", placeholder: "0.7" })}
          </>
        );
      case "http":
        return (
          <>
            {select("Method", "method", httpMethods)}
            {field("URL", "url", { placeholder: "https://api.example.com/data", required: true })}
            {field("Headers (JSON)", "headers", { rows: 2, placeholder: '{"Authorization": "Bearer {{env.TOKEN}}"}' })}
            {field("Body (JSON)", "body", { rows: 3, placeholder: '{"key": "{{trigger.data.value}}"}' })}
            {field("Timeout (ms)", "timeout", { type: "number", placeholder: "10000" })}
          </>
        );
      case "condition":
        return (
          <>
            {field("Left side (path or value)", "left", { placeholder: "{{http1.status}}", required: true, hint: "Use {{nodeId.field}} for dynamic values" })}
            {select("Operator", "operator", operators)}
            {field("Right side (comparison)", "right", { placeholder: "200", required: true })}
          </>
        );
      case "action":
        return (
          <>
            {select("Action Type", "actionType", actionTypes)}
            {field("Message / Payload", "message", { rows: 3, placeholder: "Result: {{llm1.text}}", required: true, hint: "Use {{nodeId.field}} to include data from previous nodes" })}
            {(node.data.actionType === "email") && field("To Email", "toEmail", { type: "email", placeholder: "user@example.com", required: true })}
            {(node.data.actionType === "email") && field("Subject", "subject", { placeholder: "Workflow result" })}
          </>
        );
      case "delay":
        return (
          <>
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1">Duration (ms)</label>
              <input
                className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white/80 focus:outline-none focus:border-indigo-400/50"
                type="number"
                min={100}
                max={86400000}
                step={1000}
                value={Number(node.data.delayMs ?? 5000)}
                onChange={(e) => set("delayMs", parseInt(e.target.value))}
                onBlur={(e) => commit("delayMs", parseInt(e.target.value))}
              />
              <p className="text-[10px] text-white/20 mt-1">
                {Number(node.data.delayMs ?? 5000) < 1000
                  ? `${node.data.delayMs}ms`
                  : Number(node.data.delayMs ?? 5000) < 60000
                    ? `${Number(node.data.delayMs) / 1000}s`
                    : `${(Number(node.data.delayMs) / 60000).toFixed(1)}m`}
              </p>
            </div>
          </>
        );
      case "transform":
        return (
          <>
            {field("Input node ID", "inputNodeId", { placeholder: "http1 or llm1", hint: "Which node's output to transform" })}
            {field("JavaScript expression", "expression", { rows: 4, placeholder: "input.items.map(i => i.name)", required: true, hint: "'input' is the source node's output" })}
          </>
        );
      case "output":
        return (
          <>
            {select("Format", "format", ["json", "text", "markdown", "html"])}
            {field("Source node ID", "inputNodeId", { placeholder: "llm1 (optional - defaults to last node)" })}
            {field("Label", "label", { placeholder: "Final result" })}
          </>
        );
      default:
        return <p className="text-white/25 text-xs">No config for this node type.</p>;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.07]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/80">{typeLabel[node.type as NodeType] ?? node.type}</h3>
          {onDelete && (
            <button
              onClick={() => onDelete(node.id)}
              className="text-xs text-red-400/50 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
            >
              Delete
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <code
            className="text-[10px] text-white/25 font-mono bg-white/5 px-1.5 py-0.5 rounded cursor-pointer hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
            title="Click to copy node ID"
            onClick={() => navigator.clipboard.writeText(node.id)}
          >
            {node.id}
          </code>
          <span className="text-[10px] text-white/15">â† click to copy</span>
        </div>
      </div>

      {/* Reference helper */}
      <div className="px-4 py-2.5 bg-indigo-500/5 border-b border-indigo-500/10">
        <p className="text-[10px] text-indigo-300/60 leading-relaxed">
          Reference this node: <code className="font-mono text-indigo-300/90">{`{{${node.id}.text}}`}</code>
          <br />
          Click <code className="font-mono">{"{{}}"}</code> next to a field to copy its ref.
        </p>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {renderFields()}

        {/* Notes field - available on all nodes */}
        <div className="border-t border-white/6 pt-4">
          {field("Notes (optional)", "notes", { rows: 2, placeholder: "Describe what this node does..." })}
        </div>
      </div>
    </div>
  );
}
