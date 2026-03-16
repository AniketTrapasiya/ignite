"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Session {
  id: string;
  title: string;
  model: string;
  updatedAt: string;
  messages?: { content: string; role: string; createdAt: string }[];
  _count?: { messages: number };
}

interface CredentialField {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  required: boolean;
  hint?: string;
}

interface CredentialRequest {
  id?: string;
  toolName: string;
  title: string;
  description: string;
  fields: CredentialField[];
}

interface CodeArtifact {
  filename: string;
  language: string;
  code: string;
  description: string;
  requiredEnvVars?: { name: string; description: string; required: boolean }[];
}

type ToolCallInfo = { name: string; args: Record<string, unknown> };

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  artifacts: CodeArtifact[];
  credentialRequest: CredentialRequest | null;
  toolCalls: ToolCallInfo[];
  streaming?: boolean;
}

const MODELS = [
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Syntax-highlight code (simple CSS-class based, no extra libs needed)
// ─────────────────────────────────────────────────────────────────────────────
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const download = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `file.${language}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0d1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <span className="text-xs font-mono text-purple-400">{language}</span>
        <div className="flex gap-2">
          <button
            onClick={download}
            className="text-xs text-white/40 hover:text-white/80 transition-colors px-2 py-0.5 rounded bg-white/5 hover:bg-white/10"
          >
            ↓ download
          </button>
          <button
            onClick={copy}
            className="text-xs text-white/40 hover:text-white/80 transition-colors px-2 py-0.5 rounded bg-white/5 hover:bg-white/10"
          >
            {copied ? "✓ copied" : "copy"}
          </button>
        </div>
      </div>
      {/* Code */}
      <pre className="p-4 text-sm font-mono text-green-300/90 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
        {code}
      </pre>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Credential Form (inline in chat)
// ─────────────────────────────────────────────────────────────────────────────
function CredentialForm({
  request,
  onSubmit,
}: {
  request: CredentialRequest;
  onSubmit: (id: string | undefined, values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(request.id, values);
    setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
        ✓ Credentials submitted — continuing…
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 space-y-4"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">🔐</span>
        <div>
          <div className="font-semibold text-sm text-yellow-300">{request.title}</div>
          <div className="text-xs text-white/50 mt-1 leading-relaxed">{request.description}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {request.fields.map((field) => (
          <div key={field.name}>
            <label className="block text-xs font-medium text-white/60 mb-1">
              {field.label} {field.required && <span className="text-red-400">*</span>}
            </label>
            <input
              type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
              placeholder={field.placeholder ?? ""}
              required={field.required}
              value={values[field.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/20"
            />
            {field.hint && (
              <p className="text-[11px] text-white/30 mt-1">{field.hint}</p>
            )}
          </div>
        ))}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 rounded-lg bg-yellow-500/80 hover:bg-yellow-500 text-black text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting…" : "Submit Credentials"}
        </button>
      </form>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message bubble
// ─────────────────────────────────────────────────────────────────────────────
function MessageBubble({
  message,
  onCredentialSubmit,
}: {
  message: ChatMessage;
  onCredentialSubmit: (credId: string | undefined, values: Record<string, string>) => void;
}) {
  const isUser = message.role === "user";

  // Parse inline code blocks from assistant text
  const renderContent = (text: string) => {
    // Split on ```lang ... ``` blocks
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      const match = part.match(/^```(\w*)\n([\s\S]*?)```$/);
      if (match) {
        return (
          <div key={i} className="mt-2 mb-1">
            <CodeBlock code={match[2]} language={match[1] || "text"} />
          </div>
        );
      }
      // Render non-code with basic markdown: **bold**, `inline`
      const formatted = part
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`\n]+)`/g, '<code class="bg-white/10 px-1 rounded text-xs font-mono text-purple-300">$1</code>');
      return (
        <span key={i} dangerouslySetInnerHTML={{ __html: formatted }} />
      );
    });
  };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${isUser ? "bg-purple-600 text-white" : "bg-gradient-to-br from-cyan-500 to-purple-600 text-white"
          }`}
      >
        {isUser ? "U" : "⚡"}
      </div>

      <div className={`max-w-[80%] space-y-2 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {/* Tool calls */}
        {message.toolCalls.length > 0 && (
          <div className="space-y-1">
            {message.toolCalls.map((tc, i) => (
              <div
                key={i}
                className="text-[11px] font-mono text-white/40 flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1"
              >
                <span className="text-cyan-400">⚙</span>
                <span>{tc.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Main bubble */}
        {message.content && (
          <div
            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser
                ? "bg-purple-600/80 text-white rounded-tr-sm"
                : "bg-white/5 border border-white/10 text-white/90 rounded-tl-sm"
              }`}
          >
            {message.streaming && !message.content ? (
              <div className="flex gap-1 py-1">
                <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            ) : (
              <div className="space-y-1 [&_strong]:font-semibold [&_strong]:text-white whitespace-pre-wrap">
                {renderContent(message.content)}
              </div>
            )}
          </div>
        )}

        {/* Streaming indicator on empty assistant message */}
        {message.streaming && !message.content && (
          <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
            <div className="flex gap-1 py-1">
              <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {/* Code artifacts */}
        {message.artifacts.map((artifact, i) => (
          <div key={i} className="w-full space-y-1">
            <div className="text-[11px] text-white/40 flex items-center gap-1">
              <span>📄</span>
              <span className="font-mono">{artifact.filename}</span>
              <span className="text-white/20">—</span>
              <span>{artifact.description}</span>
            </div>
            <CodeBlock code={artifact.code} language={artifact.language} />
            {artifact.requiredEnvVars && artifact.requiredEnvVars.length > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs space-y-1">
                <div className="text-blue-300 font-medium">Required Environment Variables</div>
                {artifact.requiredEnvVars.map((ev) => (
                  <div key={ev.name} className="flex gap-2 text-white/50">
                    <code className="text-blue-400 font-mono">{ev.name}</code>
                    <span>{ev.description}</span>
                    {!ev.required && <span className="text-white/25">(optional)</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Credential request form */}
        {message.credentialRequest && (
          <div className="w-full">
            <CredentialForm
              request={message.credentialRequest}
              onSubmit={onCredentialSubmit}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifact Panel (right side)
// ─────────────────────────────────────────────────────────────────────────────
function ArtifactPanel({ artifacts }: { artifacts: CodeArtifact[] }) {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (artifacts.length > 0) setActiveIdx(artifacts.length - 1);
  }, [artifacts.length]);

  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/20 gap-3">
        <span className="text-6xl">📂</span>
        <p className="text-sm">Code artifacts will appear here</p>
        <p className="text-xs text-white/15 text-center max-w-xs">
          Ask the agent to write a function, script, or API integration and it will be displayed with syntax highlighting here.
        </p>
      </div>
    );
  }

  const artifact = artifacts[activeIdx];

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-1 p-2 bg-white/3 border-b border-white/10 overflow-x-auto flex-shrink-0">
        {artifacts.map((a, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-colors ${i === activeIdx
                ? "bg-purple-500/30 text-purple-300 border border-purple-500/30"
                : "text-white/40 hover:text-white/70 hover:bg-white/5"
              }`}
          >
            {a.filename}
          </button>
        ))}
      </div>

      {/* Content */}
      {artifact && (
        <div className="flex-1 overflow-auto p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-sm text-white/80">{artifact.filename}</div>
              <div className="text-xs text-white/40 mt-0.5">{artifact.description}</div>
            </div>
            <span className="text-xs font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
              {artifact.language}
            </span>
          </div>

          <CodeBlock code={artifact.code} language={artifact.language} />

          {artifact.requiredEnvVars && artifact.requiredEnvVars.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-2">
              <div className="text-sm font-medium text-blue-300">Required Environment Variables</div>
              <div className="space-y-1.5">
                {artifact.requiredEnvVars.map((ev) => (
                  <div key={ev.name} className="flex items-start gap-3 text-xs">
                    <code className="text-blue-400 font-mono min-w-0 shrink-0">{ev.name}</code>
                    <span className="text-white/50">{ev.description}</span>
                    {!ev.required && <span className="text-white/25 shrink-0">(optional)</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Workshop Page
// ─────────────────────────────────────────────────────────────────────────────
export default function WorkshopPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [artifactsPanelOpen, setArtifactsPanelOpen] = useState(true);
  const [allArtifacts, setAllArtifacts] = useState<CodeArtifact[]>([]);

  // Pending credential response (for current streaming request)
  const pendingCredRef = useRef<null | {
    credId: string | undefined;
    values: Record<string, string>;
  }>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Load sessions ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/chat/sessions")
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
      .catch(() => { });
  }, []);

  // ── Scroll to bottom on new messages ──────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Create new session ─────────────────────────────────────────────────────
  const createSession = useCallback(async () => {
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: selectedModel }),
    });
    const data = await res.json();
    const session = data.session as Session;
    setSessions((prev) => [session, ...prev]);
    setActiveSession(session);
    setMessages([]);
    setAllArtifacts([]);
  }, [selectedModel]);

  // ── Load session ───────────────────────────────────────────────────────────
  const loadSession = useCallback(async (session: Session) => {
    setActiveSession(session);
    const res = await fetch(`/api/chat/sessions/${session.id}`);
    const data = await res.json();
    const dbMessages = (data.session?.messages ?? []) as {
      id: string;
      role: string;
      content: string;
      artifacts: unknown;
      metadata: unknown;
    }[];

    const chatMessages: ChatMessage[] = dbMessages.map((m) => {
      const artifacts = (Array.isArray(m.artifacts) ? m.artifacts : []) as CodeArtifact[];
      const meta = (typeof m.metadata === "object" && m.metadata ? m.metadata : {}) as Record<string, unknown>;
      return {
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        artifacts,
        credentialRequest: (meta.credentialRequest ?? null) as CredentialRequest | null,
        toolCalls: [],
      };
    });

    setMessages(chatMessages);
    setAllArtifacts(chatMessages.flatMap((m) => m.artifacts));
  }, []);

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (
      text: string,
      credentialResponse?: { credentialId: string | undefined; values: Record<string, string> }
    ) => {
      if (!activeSession) return;
      if (streaming) return;

      const userContent = text.trim();
      if (!userContent && !credentialResponse) return;

      setStreaming(true);
      setInput("");

      // Add user message to UI
      if (userContent) {
        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          content: userContent,
          artifacts: [],
          credentialRequest: null,
          toolCalls: [],
        };
        setMessages((prev) => [...prev, userMsg]);
      }

      // Add placeholder assistant message
      const assistantId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          artifacts: [],
          credentialRequest: null,
          toolCalls: [],
          streaming: true,
        },
      ]);

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        const body: Record<string, unknown> = {
          message: userContent || undefined,
        };
        if (credentialResponse) {
          body.credentialResponse = {
            credentialId: credentialResponse.credentialId,
            values: credentialResponse.values,
          };
        }

        const res = await fetch(
          `/api/chat/sessions/${activeSession.id}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: abort.signal,
          }
        );

        if (!res.ok || !res.body) {
          throw new Error("Stream not available");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === "[DONE]") continue;

            try {
              const event = JSON.parse(raw) as Record<string, unknown>;

              if (event.text) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + (event.text as string), streaming: true }
                      : m
                  )
                );
              } else if (event.toolCall) {
                const tc = event.toolCall as ToolCallInfo;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, toolCalls: [...m.toolCalls, tc] }
                      : m
                  )
                );
              } else if (event.codeArtifact) {
                const artifact = event.codeArtifact as CodeArtifact;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, artifacts: [...m.artifacts, artifact] }
                      : m
                  )
                );
                setAllArtifacts((prev) => [...prev, artifact]);
              } else if (event.credentialRequest) {
                const cr = event.credentialRequest as CredentialRequest;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, credentialRequest: cr, streaming: false }
                      : m
                  )
                );
              } else if (event.done) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, streaming: false } : m
                  )
                );
              } else if (event.error) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                        ...m,
                        content:
                          m.content ||
                          `⚠ Error: ${event.error as string}`,
                        streaming: false,
                      }
                      : m
                  )
                );
              }
            } catch {
              // Ignore parse errors in SSE stream
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                  ...m,
                  content: m.content || "⚠ Connection failed. Please try again.",
                  streaming: false,
                }
                : m
            )
          );
        }
      } finally {
        setStreaming(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, streaming: false } : m
          )
        );
        abortRef.current = null;
      }
    },
    [activeSession, streaming]
  );

  // ── Handle credential form submission ──────────────────────────────────────
  const handleCredentialSubmit = useCallback(
    (credId: string | undefined, values: Record<string, string>) => {
      pendingCredRef.current = { credId, values };
      sendMessage("", {
        credentialId: credId,
        values,
      });
    },
    [sendMessage]
  );

  // ── Delete session ─────────────────────────────────────────────────────────
  const deleteSession = async (id: string) => {
    await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSession?.id === id) {
      setActiveSession(null);
      setMessages([]);
      setAllArtifacts([]);
    }
  };

  // ── Handle keyboard ────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!streaming && activeSession && input.trim()) {
        sendMessage(input);
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-[#0a0a0f] overflow-hidden">
      {/* ── Sessions Sidebar ───────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col border-r border-white/10 bg-black/20 overflow-hidden flex-shrink-0"
          >
            <div className="p-3 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">💬</span>
                <span className="font-semibold text-sm text-white/80">Sessions</span>
              </div>

              {/* Model selector */}
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white/70 mb-2 focus:outline-none focus:border-purple-400/50"
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id} className="bg-black">
                    {m.label}
                  </option>
                ))}
              </select>

              <button
                onClick={createSession}
                className="w-full py-2 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-medium transition-colors"
              >
                + New Chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.length === 0 && (
                <div className="text-xs text-white/25 text-center mt-8 px-4">
                  No sessions yet. Click "+ New Chat" to start.
                </div>
              )}
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${activeSession?.id === s.id
                      ? "bg-purple-600/20 border border-purple-500/30"
                      : "hover:bg-white/5"
                    }`}
                  onClick={() => loadSession(s)}
                >
                  <span className="text-sm">💬</span>
                  <span className="flex-1 text-xs text-white/70 truncate">{s.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(s.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-opacity text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Chat Panel ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="text-white/30 hover:text-white/70 transition-colors"
          >
            ☰
          </button>
          <span className="text-sm font-medium text-white/60">
            {activeSession ? activeSession.title : "Agent Workshop"}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setArtifactsPanelOpen((v) => !v)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${artifactsPanelOpen
                ? "border-purple-500/40 text-purple-400 bg-purple-500/10"
                : "border-white/10 text-white/30 hover:text-white/60"
              }`}
          >
            📂 Artifacts {allArtifacts.length > 0 && `(${allArtifacts.length})`}
          </button>
        </div>

        {/* Empty state */}
        {!activeSession && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
            <div className="text-5xl">⚡</div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold text-white/80">Agent Workshop</h2>
              <p className="text-sm text-white/40 max-w-md">
                Chat with the AI agent to write code, set up integrations, send emails, and build automations.
                The agent asks for credentials only when needed.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
              {[
                { icon: "📧", text: "Write a SendGrid email function and send a test email" },
                { icon: "🤖", text: "Create a WhatsApp bot that replies to messages with GPT" },
                { icon: "🔗", text: "Write a webhook handler that posts to Slack" },
                { icon: "📊", text: "Fetch data from an API and write it to a spreadsheet" },
              ].map((s) => (
                <button
                  key={s.text}
                  onClick={async () => {
                    const res = await fetch("/api/chat/sessions", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ model: selectedModel }),
                    });
                    const data = await res.json();
                    const session = data.session as Session;
                    setSessions((prev) => [session, ...prev]);
                    setActiveSession(session);
                    setMessages([]);
                    setAllArtifacts([]);
                    // Slight delay so state updates first
                    setTimeout(() => {
                      setInput(s.text);
                      inputRef.current?.focus();
                    }, 100);
                  }}
                  className="flex items-start gap-2 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors text-left"
                >
                  <span className="text-lg">{s.icon}</span>
                  <span className="text-xs text-white/60 leading-relaxed">{s.text}</span>
                </button>
              ))}
            </div>
            <button
              onClick={createSession}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
            >
              Start New Chat
            </button>
          </div>
        )}

        {/* Messages */}
        {activeSession && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {messages.length === 0 && !streaming && (
                <div className="text-center text-white/25 text-sm mt-16">
                  <p>Ask me to write code, send an email, or build an automation.</p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <MessageBubble
                      message={msg}
                      onCredentialSubmit={handleCredentialSubmit}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="border-t border-white/10 p-4 flex-shrink-0">
              <div className="flex gap-3 items-end bg-white/5 border border-white/10 rounded-2xl p-3 focus-within:border-purple-400/40 transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    streaming
                      ? "Agent is thinking…"
                      : "Ask the agent to write code, build an automation, send an email…"
                  }
                  disabled={streaming}
                  rows={1}
                  className="flex-1 bg-transparent resize-none outline-none text-sm text-white/80 placeholder-white/25 disabled:opacity-40 max-h-40 overflow-y-auto leading-relaxed"
                  style={{ minHeight: "24px" }}
                />
                <button
                  onClick={() => {
                    if (streaming && abortRef.current) {
                      abortRef.current.abort();
                    } else if (input.trim()) {
                      sendMessage(input);
                    }
                  }}
                  disabled={!streaming && !input.trim()}
                  className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${streaming
                      ? "bg-red-500/80 hover:bg-red-500 text-white"
                      : "bg-purple-600 hover:bg-purple-500 text-white"
                    }`}
                >
                  {streaming ? "■" : "↑"}
                </button>
              </div>
              <p className="text-[10px] text-white/20 mt-2 text-center">
                Enter ↵ to send · Shift+Enter for new line · Agent can write code and ask for credentials
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Artifact Panel ─────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {artifactsPanelOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 480, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col border-l border-white/10 bg-black/20 overflow-hidden flex-shrink-0"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
              <span className="text-sm font-medium text-white/60">Code Artifacts</span>
              <button
                onClick={() => setArtifactsPanelOpen(false)}
                className="text-white/30 hover:text-white/70 transition-colors text-sm"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ArtifactPanel artifacts={allArtifacts} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
