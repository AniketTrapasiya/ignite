"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────
interface Memory {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
}

interface AIModel {
  id: string;
  name: string;
  provider: "google" | "anthropic";
  description: string;
  available: boolean;
}

type Tab = "memory" | "models" | "tools";

// ── Provider badge ────────────────────────────────────────────────────────
function ProviderBadge({ provider }: { provider: "google" | "anthropic" }) {
  if (provider === "google") {
    return (
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
        style={{ background: "rgba(66,133,244,0.18)", color: "#4285f4" }}>
        Gemini
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
      style={{ background: "rgba(201,109,73,0.18)", color: "#d97b5b" }}>
      Claude
    </span>
  );
}

// ── Section header ────────────────────────────────────────────────────────
function SectionHeader({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: dot, boxShadow: `0 0 5px ${dot}` }} />
      <h2 className="text-xs font-bold text-white/60 uppercase tracking-[0.2em]">{label}</h2>
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${className}`}
      style={{
        background: "linear-gradient(145deg, #0e0b22 0%, #0b0918 100%)",
        borderColor: "rgba(120,50,255,0.25)",
        boxShadow: "0 0 20px rgba(100,30,255,0.05)",
      }}
    >
      {children}
    </div>
  );
}

// ── Memory Tab ────────────────────────────────────────────────────────────
function MemoryTab() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = search.trim() ? `?q=${encodeURIComponent(search)}` : "";
      const r = await fetch(`/api/engine/memory${q}`);
      const d = await r.json();
      setMemories(d.memories ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function deleteMemory(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/engine/memory/${id}`, { method: "DELETE" });
      setMemories((m) => m.filter((x) => x.id !== id));
    } catch { /* ignore */ } finally {
      setDeleting(null);
    }
  }

  async function togglePin(id: string, pinned: boolean) {
    try {
      await fetch(`/api/engine/memory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !pinned }),
      });
      setMemories((m) => m.map((x) => x.id === id ? { ...x, pinned: !x.pinned } : x));
    } catch { /* ignore */ }
  }

  const filtered = memories.filter((m) =>
    !search.trim() ||
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader dot="#a855f7" label="Memory Bank" />
        <p className="text-xs text-white/35 mb-4">
          Memories are saved outputs from engine runs. They are automatically injected as context into future runs.
        </p>

        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search memories…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/40 transition-colors"
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/[0.03] border border-white/8 flex items-center justify-center text-2xl">🧠</div>
            <p className="text-sm text-white/25">{search ? "No memories match your search." : "No memories saved yet."}</p>
            <p className="text-xs text-white/15 mt-1">Run the engine and save outputs to build your memory bank.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/25">{filtered.length} memor{filtered.length === 1 ? "y" : "ies"}</span>
              <span className="text-[10px] text-white/20">{memories.filter((m) => m.pinned).length} pinned</span>
            </div>
            {filtered.map((mem) => (
              <motion.div
                key={mem.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="rounded-xl border transition-all"
                style={{
                  background: mem.pinned ? "rgba(168,85,247,0.06)" : "rgba(255,255,255,0.02)",
                  borderColor: mem.pinned ? "rgba(168,85,247,0.25)" : "rgba(255,255,255,0.07)",
                }}
              >
                <div
                  className="flex items-start gap-3 p-3 cursor-pointer"
                  onClick={() => setExpanded(expanded === mem.id ? null : mem.id)}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.2)" }}>
                    {mem.pinned ? "📌" : "💡"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate">{mem.title}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {mem.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.25)", color: "#c084fc" }}>
                          {tag}
                        </span>
                      ))}
                      <span className="text-[9px] text-white/20 ml-auto">
                        {new Date(mem.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => togglePin(mem.id, mem.pinned)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/[0.08]"
                      title={mem.pinned ? "Unpin" : "Pin"}
                    >
                      <span className="text-xs">{mem.pinned ? "📌" : "📍"}</span>
                    </button>
                    <button
                      onClick={() => deleteMemory(mem.id)}
                      disabled={deleting === mem.id}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-red-500/15 text-white/20 hover:text-red-400"
                    >
                      {deleting === mem.id ? (
                        <div className="w-2.5 h-2.5 border border-red-400/50 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                <AnimatePresence>
                  {expanded === mem.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 pt-0 border-t border-white/[0.05] mt-0">
                        <p className="text-xs text-white/45 leading-relaxed mt-3 whitespace-pre-wrap line-clamp-6">
                          {mem.content}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Models Tab ────────────────────────────────────────────────────────────
function ModelsTab() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState<{ google: boolean; anthropic: boolean; openai: boolean; pinecone: boolean }>({ google: false, anthropic: false, openai: false, pinecone: false });
  const [selectedModel, setSelectedModel] = useState<string>(
    typeof window !== "undefined" ? localStorage.getItem("autoflow-model") ?? "gemini-2.0-flash" : "gemini-2.0-flash"
  );

  useEffect(() => {
    fetch("/api/settings/models")
      .then((r) => r.json())
      .then((d) => {
        setModels(d.models ?? []);
        setConfigured({
          google: d.configured?.google ?? false,
          anthropic: d.configured?.anthropic ?? false,
          openai: d.configured?.openai ?? false,
          pinecone: d.configured?.pinecone ?? false,
        });
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  function selectModel(id: string) {
    setSelectedModel(id);
    localStorage.setItem("autoflow-model", id);
  }

  const googleModels = models.filter((m) => m.provider === "google");
  const anthropicModels = models.filter((m) => m.provider === "anthropic");

  return (
    <div className="space-y-4">
      {/* API Key Status */}
      <Card>
        <SectionHeader dot="#22d3ee" label="API Key Status" />
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Gemini (Google)", key: "GEMINI_API_KEY", ok: configured.google, color: "#4285f4" },
            { label: "Claude (Anthropic)", key: "ANTHROPIC_API_KEY", ok: configured.anthropic, color: "#d97b5b" },
            { label: "OpenAI", key: "OPENAI_API_KEY", ok: configured.openai, color: "#10a37f" },
            { label: "Pinecone", key: "PINECONE_API_KEY", ok: configured.pinecone, color: "#6366f1" },
          ].map((kv) => (
            <div key={kv.key} className="flex items-center gap-3 p-3 rounded-xl border"
              style={{ background: kv.ok ? `${kv.color}0f` : "rgba(255,255,255,0.02)", borderColor: kv.ok ? `${kv.color}30` : "rgba(255,255,255,0.07)" }}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: kv.ok ? kv.color : "rgba(255,255,255,0.15)", boxShadow: kv.ok ? `0 0 6px ${kv.color}` : "none" }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white/70 truncate">{kv.label}</p>
                <p className="text-[9px] text-white/25 truncate font-mono">{kv.key}</p>
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider ${kv.ok ? "" : "text-white/20"}`}
                style={kv.ok ? { color: kv.color } : {}}>
                {kv.ok ? "✓ SET" : "MISSING"}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-white/20 mt-3">Configure API keys in your <code className="text-purple-400/70">.env</code> file to unlock more models.</p>
      </Card>

      {/* Model Selection */}
      <Card>
        <SectionHeader dot="#a855f7" label="Default Model" />
        <p className="text-xs text-white/35 mb-4">
          Select the AI model used for engine runs. Selection is saved to your browser.
        </p>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 rounded-xl bg-white/[0.03] animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Google Models */}
            {googleModels.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <span className="text-base">🔵</span> Google Gemini
                  <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded ${configured.google ? "text-blue-400" : "text-white/20"}`}
                    style={configured.google ? { background: "rgba(66,133,244,0.12)" } : {}}>
                    {configured.google ? "✓ Key configured" : "No key"}
                  </span>
                </p>
                <div className="space-y-1.5">
                  {googleModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => model.available && selectModel(model.id)}
                      disabled={!model.available}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left"
                      style={{
                        background: selectedModel === model.id ? "rgba(66,133,244,0.1)" : model.available ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.01)",
                        borderColor: selectedModel === model.id ? "rgba(66,133,244,0.4)" : "rgba(255,255,255,0.07)",
                        opacity: model.available ? 1 : 0.4,
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white/80 truncate">{model.name}</span>
                          <ProviderBadge provider="google" />
                        </div>
                        <p className="text-[10px] text-white/30 truncate mt-0.5">{model.id}</p>
                      </div>
                      {selectedModel === model.id && (
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: "#4285f4" }}>
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Anthropic Models */}
            {anthropicModels.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <span className="text-base">🟤</span> Anthropic Claude
                  <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded ${configured.anthropic ? "text-orange-400" : "text-white/20"}`}
                    style={configured.anthropic ? { background: "rgba(217,123,91,0.12)" } : {}}>
                    {configured.anthropic ? "✓ Key configured" : "Add ANTHROPIC_API_KEY to .env"}
                  </span>
                </p>
                <div className="space-y-1.5">
                  {anthropicModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => model.available && selectModel(model.id)}
                      disabled={!model.available}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left"
                      style={{
                        background: selectedModel === model.id ? "rgba(217,123,91,0.1)" : "rgba(255,255,255,0.01)",
                        borderColor: selectedModel === model.id ? "rgba(217,123,91,0.4)" : "rgba(255,255,255,0.07)",
                        opacity: model.available ? 1 : 0.4,
                        cursor: model.available ? "pointer" : "not-allowed",
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white/80 truncate">{model.name}</span>
                          <ProviderBadge provider="anthropic" />
                        </div>
                        <p className="text-[10px] text-white/30 truncate mt-0.5">{model.id}</p>
                      </div>
                      {selectedModel === model.id && (
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: "#d97b5b" }}>
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {selectedModel && (
          <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>
            <span className="text-xs text-purple-300/80">Active model:</span>
            <code className="text-xs font-mono text-purple-200">{selectedModel}</code>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── MCP / Tools config ────────────────────────────────────────────────────
const MCP_PRESETS = [
  { id: "filesystem", name: "Filesystem", icon: "📁", desc: "Read & write local files", color: "#f59e0b" },
  { id: "fetch", name: "Web Fetch", icon: "🌐", desc: "Fetch URLs and scrape content", color: "#3b82f6" },
  { id: "github", name: "GitHub", icon: "🐙", desc: "Repos, PRs, issues, code", color: "#e2e8f0" },
  { id: "postgres", name: "PostgreSQL", icon: "🐘", desc: "Query your database directly", color: "#336791" },
  { id: "brave_search", name: "Brave Search", icon: "🔍", desc: "Web search via Brave API", color: "#fb7185" },
  { id: "puppeteer", name: "Puppeteer", icon: "🤖", desc: "Browser automation & scraping", color: "#22c55e" },
];

interface KeyValuePair {
  key: string;
  value: string;
}

interface CustomAPITool {
  id: string;
  name: string;
  description: string;
  method: string;
  url: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  bodyType: "none" | "json" | "form";
  bodyContent: string;
}

const EMPTY_TOOL: Omit<CustomAPITool, "id"> = {
  name: "",
  description: "",
  method: "GET",
  url: "",
  headers: [],
  queryParams: [],
  bodyType: "none",
  bodyContent: "",
};

function KeyValueEditor({
  label,
  pairs,
  onChange,
  placeholder = { key: "Key", value: "Value" },
}: {
  label: string;
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
  placeholder?: { key: string; value: string };
}) {
  const addPair = () => onChange([...pairs, { key: "", value: "" }]);
  const updatePair = (index: number, field: "key" | "value", val: string) => {
    const updated = [...pairs];
    updated[index] = { ...updated[index], [field]: val };
    onChange(updated);
  };
  const removePair = (index: number) => onChange(pairs.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">{label}</span>
        <button
          type="button"
          onClick={addPair}
          className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          + Add
        </button>
      </div>
      {pairs.length === 0 ? (
        <p className="text-[10px] text-white/20 italic">No {label.toLowerCase()} configured</p>
      ) : (
        <div className="space-y-1.5">
          {pairs.map((pair, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={pair.key}
                onChange={(e) => updatePair(i, "key", e.target.value)}
                placeholder={placeholder.key}
                className="flex-1 px-2 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/40"
              />
              <input
                type="text"
                value={pair.value}
                onChange={(e) => updatePair(i, "value", e.target.value)}
                placeholder={placeholder.value}
                className="flex-1 px-2 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/40"
              />
              <button
                type="button"
                onClick={() => removePair(i)}
                className="w-6 h-6 rounded flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolsTab() {
  const [enabledMCP, setEnabledMCP] = useState<string[]>([]);
  const [apiTools, setApiTools] = useState<CustomAPITool[]>([]);
  const [showAddAPI, setShowAddAPI] = useState(false);
  const [editingTool, setEditingTool] = useState<CustomAPITool | null>(null);
  const [newTool, setNewTool] = useState<Omit<CustomAPITool, "id">>(EMPTY_TOOL);

  function toggleMCP(id: string) {
    setEnabledMCP((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }

  function resetForm() {
    setNewTool(EMPTY_TOOL);
    setShowAddAPI(false);
    setEditingTool(null);
  }

  function saveTool() {
    if (!newTool.name.trim() || !newTool.url.trim()) return;

    if (editingTool) {
      setApiTools((p) => p.map((t) => t.id === editingTool.id ? { ...newTool, id: editingTool.id } : t));
    } else {
      setApiTools((p) => [...p, { ...newTool, id: `api-${Date.now()}` }]);
    }
    resetForm();
  }

  function editTool(tool: CustomAPITool) {
    setNewTool(tool);
    setEditingTool(tool);
    setShowAddAPI(true);
  }

  function deleteTool(id: string) {
    setApiTools((p) => p.filter((t) => t.id !== id));
  }

  const showBodySection = newTool.method !== "GET" && newTool.method !== "DELETE";

  return (
    <div className="space-y-4">
      {/* MCP Servers */}
      <Card>
        <SectionHeader dot="#f97316" label="MCP Servers" />
        <p className="text-xs text-white/35 mb-4">
          Model Context Protocol servers extend the engine with real tools — file access, search, databases, and more.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {MCP_PRESETS.map((mcp) => {
            const isOn = enabledMCP.includes(mcp.id);
            return (
              <button
                key={mcp.id}
                onClick={() => toggleMCP(mcp.id)}
                className="flex items-start gap-3 p-3 rounded-xl border text-left transition-all"
                style={{
                  background: isOn ? `${mcp.color}0f` : "rgba(255,255,255,0.02)",
                  borderColor: isOn ? `${mcp.color}35` : "rgba(255,255,255,0.07)",
                }}
              >
                <span className="text-lg flex-shrink-0">{mcp.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/80 truncate">{mcp.name}</p>
                  <p className="text-[10px] text-white/30 line-clamp-2 mt-0.5">{mcp.desc}</p>
                </div>
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                  style={{
                    borderColor: isOn ? mcp.color : "rgba(255,255,255,0.15)",
                    background: isOn ? mcp.color : "transparent",
                  }}
                >
                  {isOn && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {enabledMCP.length > 0 && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
            <span className="text-xs text-orange-300/80">{enabledMCP.length} MCP server{enabledMCP.length > 1 ? "s" : ""} enabled</span>
            <span className="text-[10px] text-orange-300/40 ml-auto">Restart engine to apply</span>
          </div>
        )}
      </Card>

      {/* Custom API Tools */}
      <Card>
        <div className="flex items-center mb-4">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#22d3ee", boxShadow: "0 0 5px #22d3ee" }} />
            <h2 className="text-xs font-bold text-white/60 uppercase tracking-[0.2em]">Custom API Tools</h2>
          </div>
          <button
            onClick={() => { resetForm(); setShowAddAPI(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.25)", color: "#22d3ee" }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Tool
          </button>
        </div>

        {apiTools.length === 0 && !showAddAPI ? (
          <div className="text-center py-6">
            <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-white/[0.03] border border-white/8 flex items-center justify-center text-xl">🔌</div>
            <p className="text-xs text-white/25">No custom API tools configured.</p>
            <p className="text-[10px] text-white/15 mt-1">Add REST endpoints the engine can call during runs.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {apiTools.map((tool) => (
              <div key={tool.id} className="rounded-xl border overflow-hidden"
                style={{ background: "rgba(34,211,238,0.05)", borderColor: "rgba(34,211,238,0.2)" }}>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${tool.method === "GET" ? "bg-green-500/20 text-green-400" :
                      tool.method === "POST" ? "bg-blue-500/20 text-blue-400" :
                        tool.method === "PUT" ? "bg-yellow-500/20 text-yellow-400" :
                          tool.method === "DELETE" ? "bg-red-500/20 text-red-400" :
                            "bg-purple-500/20 text-purple-400"
                    }`}>{tool.method}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white/75 truncate">{tool.name}</p>
                    <p className="text-[10px] text-white/25 truncate font-mono">{tool.url}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {tool.headers.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/30">H:{tool.headers.length}</span>
                    )}
                    {tool.queryParams.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/30">Q:{tool.queryParams.length}</span>
                    )}
                    {tool.bodyType !== "none" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/30">B</span>
                    )}
                    <button
                      onClick={() => editTool(tool)}
                      className="w-6 h-6 rounded flex items-center justify-center text-white/20 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteTool(tool.id)}
                      className="w-6 h-6 rounded flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                {tool.description && (
                  <div className="px-3 pb-2.5 -mt-1">
                    <p className="text-[10px] text-white/30">{tool.description}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit API Tool form */}
        <AnimatePresence>
          {showAddAPI && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-3 p-4 rounded-xl border space-y-4"
              style={{ background: "rgba(34,211,238,0.04)", borderColor: "rgba(34,211,238,0.2)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/70">
                  {editingTool ? "Edit Tool" : "New Custom API Tool"}
                </span>
                <button onClick={resetForm} className="text-white/30 hover:text-white/60 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Basic Info */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={newTool.name}
                  onChange={(e) => setNewTool((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Tool name (e.g. Get Weather)"
                  className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/40 transition-colors"
                />
                <input
                  type="text"
                  value={newTool.description}
                  onChange={(e) => setNewTool((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Description (optional)"
                  className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/40 transition-colors"
                />
              </div>

              {/* Method & URL */}
              <div className="flex gap-2">
                <select
                  value={newTool.method}
                  onChange={(e) => setNewTool((p) => ({ ...p, method: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-white/[0.08] bg-[#0e0b22] text-xs font-semibold focus:outline-none"
                  style={{
                    color:
                      newTool.method === "GET" ? "#4ade80" :
                        newTool.method === "POST" ? "#60a5fa" :
                          newTool.method === "PUT" ? "#facc15" :
                            newTool.method === "DELETE" ? "#f87171" : "#c084fc"
                  }}
                >
                  {["GET", "POST", "PUT", "DELETE", "PATCH"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newTool.url}
                  onChange={(e) => setNewTool((p) => ({ ...p, url: e.target.value }))}
                  placeholder="https://api.example.com/endpoint"
                  className="flex-1 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/40 transition-colors font-mono"
                />
              </div>

              {/* Headers */}
              <KeyValueEditor
                label="Headers"
                pairs={newTool.headers}
                onChange={(headers) => setNewTool((p) => ({ ...p, headers }))}
                placeholder={{ key: "Header name", value: "Header value" }}
              />

              {/* Query Parameters */}
              <KeyValueEditor
                label="Query Parameters"
                pairs={newTool.queryParams}
                onChange={(queryParams) => setNewTool((p) => ({ ...p, queryParams }))}
                placeholder={{ key: "Param name", value: "Param value" }}
              />

              {/* Body (only for POST, PUT, PATCH) */}
              {showBodySection && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Body</span>
                    <div className="flex gap-1">
                      {(["none", "json", "form"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setNewTool((p) => ({ ...p, bodyType: type }))}
                          className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${newTool.bodyType === type
                              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                              : "bg-white/[0.03] text-white/30 border border-white/[0.06] hover:text-white/50"
                            }`}
                        >
                          {type === "none" ? "None" : type === "json" ? "JSON" : "Form Data"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {newTool.bodyType === "json" && (
                    <textarea
                      value={newTool.bodyContent}
                      onChange={(e) => setNewTool((p) => ({ ...p, bodyContent: e.target.value }))}
                      placeholder='{"key": "value"}'
                      rows={4}
                      className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/40 transition-colors font-mono resize-none"
                    />
                  )}
                  {newTool.bodyType === "form" && (
                    <p className="text-[10px] text-white/30 italic">Form data will be constructed from query parameters</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
                <button onClick={saveTool}
                  disabled={!newTool.name.trim() || !newTool.url.trim()}
                  className="flex-1 py-2.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(90deg, #06b6d4, #22d3ee)" }}>
                  {editingTool ? "Update Tool" : "Add Tool"}
                </button>
                <button onClick={resetForm}
                  className="px-4 py-2.5 rounded-lg text-xs text-white/40 border border-white/8 hover:text-white/70 transition-all">
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Coming soon note */}
      <div className="px-4 py-3 rounded-2xl border border-dashed border-white/10 text-center">
        <p className="text-[10px] text-white/20">MCP server execution coming in the next release. Configuration is saved locally.</p>
      </div>
    </div>
  );
}

// ── Main Settings Page ────────────────────────────────────────────────────
export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("memory");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "memory", label: "Memory", icon: "🧠" },
    { id: "models", label: "Models", icon: "🤖" },
    { id: "tools", label: "Tools", icon: "🔧" },
  ];

  return (
    <div className="min-h-screen bg-[#07070f] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#e91e8c", textShadow: "0 0 30px rgba(233,30,140,0.45)" }}>
            SETTINGS
          </h1>
          <p className="text-white/30 text-xs mt-0.5 tracking-widest uppercase">Memory · Models · Tools</p>
        </div>
        <div className="w-2 h-2 rounded-full bg-purple-500" style={{ boxShadow: "0 0 8px #a855f7" }} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
            style={
              tab === t.id
                ? { background: "linear-gradient(135deg, #6366f1, #a855f7)", color: "#fff" }
                : { color: "rgba(255,255,255,0.35)", background: "transparent" }
            }
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {tab === "memory" && <MemoryTab />}
            {tab === "models" && <ModelsTab />}
            {tab === "tools" && <ToolsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
