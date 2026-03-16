"use client";

import { useState, useEffect } from "react";

type AIProvider = "openai" | "gemini" | "groq" | "anthropic";

interface StoredCredential {
  id: string;
  provider: AIProvider;
  label: string;
  createdAt: string;
}

interface AvailableModel {
  id: string;
  name: string;
  description: string;
  cap: string[];
  available: boolean;
}

const PROVIDERS: {
  id: AIProvider;
  name: string;
  color: string;
  logo: string;
  description: string;
  keyPlaceholder: string;
  docsUrl: string;
  capabilities: string[];
}[] = [
    {
      id: "openai",
      name: "OpenAI",
      color: "#10a37f",
      logo: "⬛",
      description: "GPT-4o, DALL-E 3, TTS — text, image & audio generation",
      keyPlaceholder: "sk-...",
      docsUrl: "https://platform.openai.com/api-keys",
      capabilities: ["Text (GPT-4o, GPT-3.5)", "Images (DALL-E 3)", "Audio TTS"],
    },
    {
      id: "gemini",
      name: "Google Gemini",
      color: "#4285f4",
      logo: "🔵",
      description: "Gemini 2.0 Flash, 1.5 Pro — fast multimodal models",
      keyPlaceholder: "AIza...",
      docsUrl: "https://aistudio.google.com/app/apikey",
      capabilities: ["Text (Gemini Flash, Pro)", "Vision", "Long context (1M tokens)"],
    },
    {
      id: "groq",
      name: "Groq",
      color: "#f55036",
      logo: "⚡",
      description: "Llama, Mixtral, Gemma — ultra-fast inference",
      keyPlaceholder: "gsk_...",
      docsUrl: "https://console.groq.com/keys",
      capabilities: ["Llama 3.3 70B", "Mixtral 8x7B", "DeepSeek R1 (reasoning)"],
    },
    {
      id: "anthropic",
      name: "Anthropic",
      color: "#d4a76a",
      logo: "🔶",
      description: "Claude Opus, Sonnet, Haiku — safe & intelligent",
      keyPlaceholder: "sk-ant-...",
      docsUrl: "https://console.anthropic.com/settings/keys",
      capabilities: ["Claude Opus 4.5", "Claude Sonnet 4.5", "Claude Haiku 3.5"],
    },
  ];

export function AIKeysClient() {
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingProvider, setAddingProvider] = useState<AIProvider | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [modelsOpen, setModelsOpen] = useState<string | null>(null);
  const [providerModels, setProviderModels] = useState<Record<string, AvailableModel[]>>({});
  const [loadingModels, setLoadingModels] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchCredentials();
  }, []);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function fetchCredentials() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-keys");
      const data = await res.json();
      setCredentials(data.credentials ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function saveKey(provider: AIProvider) {
    if (!newKey.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/ai-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: newKey.trim(), label: newLabel.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Failed to save key");
        return;
      }
      setCredentials((prev) => {
        const filtered = prev.filter((c) => c.provider !== provider);
        return [...filtered, data.credential];
      });
      setAddingProvider(null);
      setNewKey("");
      setNewLabel("");
      showToast(`${PROVIDERS.find((p) => p.id === provider)?.name} key saved!`);
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteKey(credId: string, provider: string) {
    if (!confirm(`Remove ${PROVIDERS.find((p) => p.id === provider)?.name} key?`)) return;
    try {
      await fetch(`/api/ai-keys/${credId}`, { method: "DELETE" });
      setCredentials((prev) => prev.filter((c) => c.id !== credId));
      showToast("Key removed.");
    } catch {
      showToast("Failed to remove key", "error");
    }
  }

  async function loadModels(credId: string) {
    if (providerModels[credId]) {
      setModelsOpen((p) => (p === credId ? null : credId));
      return;
    }
    setLoadingModels(credId);
    try {
      const res = await fetch(`/api/ai-keys/${credId}/models`);
      const data = await res.json();
      setProviderModels((p) => ({ ...p, [credId]: data.models ?? [] }));
      setModelsOpen(credId);
    } catch {
      // ignore
    } finally {
      setLoadingModels(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl border transition-all ${toast.type === "success"
              ? "bg-emerald-950 border-emerald-500/40 text-emerald-300"
              : "bg-red-950 border-red-500/40 text-red-300"
            }`}
        >
          {toast.type === "success" ? "✓ " : "✗ "}{toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">AI Provider Keys</h2>
        <p className="text-sm text-white/40 mt-1">
          Add your own API keys to unlock all providers. Keys are AES-256-GCM encrypted and never shared.
        </p>
      </div>

      {/* Provider cards */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/[0.03] border border-white/8 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {PROVIDERS.map((prov) => {
            const stored = credentials.find((c) => c.provider === prov.id);
            const isAdding = addingProvider === prov.id;
            const models = providerModels[stored?.id ?? ""] ?? [];
            const isModelsOpen = modelsOpen === stored?.id;

            return (
              <div
                key={prov.id}
                className="rounded-2xl border transition-all"
                style={{
                  background: stored
                    ? `linear-gradient(135deg, ${prov.color}08 0%, transparent 100%)`
                    : "rgba(255,255,255,0.02)",
                  borderColor: stored ? `${prov.color}40` : "rgba(255,255,255,0.08)",
                }}
              >
                {/* Card header */}
                <div className="p-4 flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 border"
                    style={{ background: `${prov.color}15`, borderColor: `${prov.color}30` }}
                  >
                    {prov.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-white">{prov.name}</h3>
                      {stored ? (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium border"
                          style={{ background: `${prov.color}15`, borderColor: `${prov.color}40`, color: prov.color }}
                        >
                          ● Connected
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/5 border border-white/10 text-white/40">
                          Not configured
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">{prov.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {prov.capabilities.map((c) => (
                        <span key={c} className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/8 text-white/30">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {stored && (
                      <button
                        onClick={() => loadModels(stored.id)}
                        disabled={loadingModels === stored.id}
                        className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition-all disabled:opacity-40"
                      >
                        {loadingModels === stored.id ? "Loading…" : isModelsOpen ? "Hide models" : "View models"}
                      </button>
                    )}
                    {stored ? (
                      <>
                        <button
                          onClick={() => {
                            setAddingProvider(prov.id);
                            setNewKey("");
                            setNewLabel(stored.label);
                            setSaveError("");
                          }}
                          className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition-all"
                        >
                          Replace
                        </button>
                        <button
                          onClick={() => deleteKey(stored.id, prov.id)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 transition-all"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setAddingProvider(prov.id);
                          setNewKey("");
                          setNewLabel("");
                          setSaveError("");
                        }}
                        className="px-4 py-1.5 text-xs rounded-lg font-medium transition-all border text-white"
                        style={{
                          background: `${prov.color}20`,
                          borderColor: `${prov.color}50`,
                          boxShadow: "none",
                        }}
                      >
                        + Add key
                      </button>
                    )}
                  </div>
                </div>

                {/* Model list */}
                {isModelsOpen && models.length > 0 && (
                  <div className="px-4 pb-4">
                    <div className="border-t border-white/[0.06] pt-3 grid grid-cols-2 gap-2">
                      {models.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-start gap-2 p-2 rounded-lg border"
                          style={{
                            background: m.available ? "rgba(255,255,255,0.02)" : "transparent",
                            borderColor: m.available ? "rgba(255,255,255,0.06)" : "transparent",
                            opacity: m.available ? 1 : 0.4,
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white/80 truncate">{m.name}</p>
                            <p className="text-[10px] text-white/30 truncate">{m.description}</p>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {m.cap?.map((c) => (
                                <span
                                  key={c}
                                  className="text-[9px] px-1 py-0.5 rounded bg-white/[0.05] text-white/30"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                          {m.available && (
                            <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: prov.color }} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add / replace key form */}
                {isAdding && (
                  <div className="px-4 pb-4">
                    <div
                      className="p-4 rounded-xl border space-y-3"
                      style={{ background: "rgba(0,0,0,0.3)", borderColor: `${prov.color}25` }}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-white/70">
                          {stored ? "Replace" : "Add"} {prov.name} API Key
                        </p>
                        <a
                          href={prov.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-400/60 hover:text-blue-400 underline"
                        >
                          Get key ↗
                        </a>
                      </div>

                      <input
                        type="password"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        placeholder={prov.keyPlaceholder}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 font-mono"
                      />

                      <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Label (optional, e.g. Personal, Work)"
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
                      />

                      {saveError && (
                        <p className="text-xs text-red-400">{saveError}</p>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => saveKey(prov.id)}
                          disabled={!newKey.trim() || saving}
                          className="flex-1 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 text-white"
                          style={{ background: saving ? "rgba(255,255,255,0.1)" : `${prov.color}CC` }}
                        >
                          {saving ? "Validating & saving…" : "Save key"}
                        </button>
                        <button
                          onClick={() => {
                            setAddingProvider(null);
                            setNewKey("");
                            setSaveError("");
                          }}
                          className="px-4 py-2 rounded-lg text-sm text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20 transition-all"
                        >
                          Cancel
                        </button>
                      </div>

                      <p className="text-[10px] text-white/25 text-center">
                        🔒 Your key is encrypted with AES-256-GCM before storage. It&apos;s never logged or transmitted.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info callout */}
      <div className="rounded-xl p-4 border border-amber-500/20 bg-amber-950/20">
        <p className="text-xs text-amber-300/70 leading-relaxed">
          <span className="font-semibold text-amber-300">How keys work:</span> Your keys are used server-side to call AI providers.
          They&apos;re stored encrypted using AES-256-GCM. Keys you add here take priority over any server-configured environment keys.
          Each provider unlocks different models in the Engine.
        </p>
      </div>
    </div>
  );
}
