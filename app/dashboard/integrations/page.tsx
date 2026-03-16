"use client";

import { useState, useEffect } from "react";
import { INTEGRATIONS } from "@/lib/integrations-config";

interface ConnectedIntegration {
  service: string;
  status: string;
  lastUsedAt: string | null;
}

interface ConnectModalProps {
  service: (typeof INTEGRATIONS)[number] | null;
  onClose: () => void;
  onConnected: () => void;
}

function ConnectModal({ service, onClose, onConnected }: ConnectModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [extraValues, setExtraValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!service) return null;

  type ExtraField = { key: string; label: string; placeholder: string; type?: string };
  const extraFields: ExtraField[] =
    (service as unknown as { extraFields?: ExtraField[] }).extraFields ?? [];

  async function connect() {
    if (!service) return;
    if (!apiKey.trim()) { setError("API key is required"); return; }

    for (const f of extraFields) {
      if (!extraValues[f.key]?.trim()) { setError(`${f.label} is required`); return; }
    }

    setSaving(true);
    setError("");
    const credentials: Record<string, string> = { apiKey: apiKey.trim() };
    if (service.service === "custom" && baseUrl.trim()) credentials.baseUrl = baseUrl.trim();
    for (const f of extraFields) {
      if (extraValues[f.key]?.trim()) credentials[f.key] = extraValues[f.key].trim();
    }

    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: service.service, credentials }),
    });

    if (res.ok) {
      onConnected();
      onClose();
    } else {
      setError("Failed to save credentials. Try again.");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f1a] p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
            style={{ background: service.color + "33", border: `1px solid ${service.color}44` }}
          >
            {service.name.slice(0, 2)}
          </div>
          <div>
            <h2 className="font-semibold text-white">Connect {service.name}</h2>
            <p className="text-xs text-white/40">{service.description}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-white/40 hover:text-white text-xl">×</button>
        </div>

        {/* Capabilities */}
        <div className="space-y-1">
          <p className="text-xs text-white/30 uppercase tracking-widest">Enables</p>
          <div className="flex flex-wrap gap-1.5">
            {service.capabilities.map((cap) => (
              <span key={cap} className="text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">
                {cap}
              </span>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-white/50">{service.keyLabel}</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your key here..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 font-mono"
            />
          </div>
          {service.service === "custom" && (
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">Base URL (optional)</label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          )}
          {extraFields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-xs text-white/50">{f.label}</label>
              <input
                type={f.type ?? "text"}
                value={extraValues[f.key] ?? ""}
                onChange={(e) => setExtraValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          ))}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <p className="text-xs text-white/20">
          🔒 Keys are encrypted with AES-256 before storage. Never exposed in API responses.
        </p>

        {service.docsUrl && (
          <a
            href={service.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-indigo-400/70 hover:text-indigo-400 transition-colors w-fit"
          >
            <span>🔑</span>
            <span>Get your {service.name} API key →</span>
          </a>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={connect}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ background: service.color }}
          >
            {saving ? "Connecting..." : "Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}

const CATEGORIES = [
  "All",
  "Content",
  "Communication",
  "Social",
  "Messaging",
  "Marketing",
  "Payment",
  "CRM",
  "Productivity",
  "Analytics",
  "Support",
  "Developer",
  "Custom",
];

export default function IntegrationsPage() {
  const [connected, setConnected] = useState<ConnectedIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [modalService, setModalService] = useState<(typeof INTEGRATIONS)[number] | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  useEffect(() => { loadIntegrations(); }, []);

  async function loadIntegrations() {
    setLoading(true);
    const res = await fetch("/api/integrations");
    if (res.ok) {
      const data = await res.json();
      setConnected(data.integrations);
    }
    setLoading(false);
  }

  async function disconnect(service: string) {
    await fetch(`/api/integrations/${service}`, { method: "DELETE" });
    setConnected((prev) => prev.filter((i) => i.service !== service));
    setTestResults((prev) => { const n = { ...prev }; delete n[service]; return n; });
  }

  async function testIntegration(service: string) {
    setTesting(service);
    setTestResults((prev) => ({ ...prev, [service]: { ok: false, message: "Testing…" } }));
    try {
      const res = await fetch(`/api/integrations/${service}/test`, { method: "POST" });
      const data = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [service]: { ok: !!data.ok, message: data.message ?? data.error ?? "Unknown result" },
      }));
    } catch {
      setTestResults((prev) => ({ ...prev, [service]: { ok: false, message: "Request failed" } }));
    }
    setTesting(null);
  }

  const connectedServices = connected.map((c) => c.service);
  const filtered = activeCategory === "All"
    ? INTEGRATIONS
    : INTEGRATIONS.filter((i) => i.category === activeCategory);

  function connectedCountForCategory(cat: string) {
    if (cat === "All") return connectedServices.length;
    return INTEGRATIONS.filter(
      (i) => i.category === cat && connectedServices.includes(i.service)
    ).length;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
        <p className="text-white/40 text-sm mt-1">
          Connect tools to supercharge your engine.{" "}
          <span className="text-indigo-400">{connectedServices.length} connected</span>
        </p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const count = connectedCountForCategory(cat);
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border flex items-center gap-1.5 ${activeCategory === cat
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
                }`}
            >
              {cat}
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold leading-none ${activeCategory === cat
                    ? "bg-white/20 text-white"
                    : "bg-emerald-500/20 text-emerald-400"
                    }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((integration) => {
            const isConnected = connectedServices.includes(integration.service);
            const connInfo = connected.find((c) => c.service === integration.service);
            return (
              <div
                key={integration.service}
                className={`relative rounded-2xl border p-4 flex flex-col gap-3 transition-all duration-200 ${isConnected
                  ? "border-white/20 bg-white/[0.04]"
                  : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.03]"
                  }`}
              >
                {/* Connected badge */}
                {isConnected && (
                  <div className="absolute top-3 right-3 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-emerald-400">Live</span>
                  </div>
                )}

                {/* Icon + Name row */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{
                      background: integration.color + "22",
                      border: `1.5px solid ${integration.color}44`,
                    }}
                  >
                    {integration.name.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-white text-sm leading-tight">{integration.name}</p>
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{ background: integration.color + "18", color: integration.color }}
                    >
                      {integration.category}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-white/35 line-clamp-2 leading-relaxed">{integration.description}</p>

                {/* Capabilities */}
                <div className="flex flex-wrap gap-1">
                  {integration.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 border border-white/8 text-white/35"
                    >
                      {cap}
                    </span>
                  ))}
                </div>

                {isConnected && connInfo?.lastUsedAt && (
                  <p className="text-xs text-white/20">
                    Last used: {new Date(connInfo.lastUsedAt).toLocaleDateString()}
                  </p>
                )}

                {/* Test result */}
                {isConnected && testResults[integration.service] && (
                  <p className={`text-[10px] px-2 py-1 rounded-lg ${testResults[integration.service].ok
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}>
                    {testResults[integration.service].ok ? "✓ " : "✗ "}{testResults[integration.service].message}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-auto">
                  {integration.docsUrl && (
                    <a
                      href={integration.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 py-2 px-3 rounded-xl text-xs border border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 transition-colors"
                      title="Get API Key"
                    >
                      🔑
                    </a>
                  )}
                  {isConnected ? (
                    <>
                      <button
                        onClick={() => testIntegration(integration.service)}
                        disabled={testing === integration.service}
                        className="flex-1 py-2 rounded-xl text-xs font-medium border border-white/10 text-white/40 hover:border-white/20 hover:text-white/70 disabled:opacity-40 transition-colors"
                      >
                        {testing === integration.service ? "Testing…" : "Test"}
                      </button>
                      <button
                        onClick={() => disconnect(integration.service)}
                        className="flex-1 py-2 rounded-xl text-xs font-medium border border-red-500/20 text-red-400/70 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400 transition-colors"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setModalService(integration)}
                      className="flex-1 py-2 rounded-xl text-xs font-medium border text-white/50 hover:text-white transition-colors"
                      style={{ borderColor: integration.color + "44" }}
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConnectModal
        service={modalService}
        onClose={() => setModalService(null)}
        onConnected={loadIntegrations}
      />
    </div>
  );
}
