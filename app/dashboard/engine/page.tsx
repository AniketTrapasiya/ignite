"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AgentMascot, { type EngineState } from "@/components/engine/agent-mascot";
import SaveMemoryModal from "@/components/engine/save-memory-modal";
import { INTEGRATIONS } from "@/lib/integrations-config";

// ── Engine Power Gauge (SVG arc) ───────────────────────────────────────────
function PowerGauge({ power, color }: { power: number; color: string }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.72; // 260° arc
  const offset = arc * (1 - power / 100);
  return (
    <svg width="110" height="80" viewBox="0 0 110 95">
      {/* Track */}
      <circle cx="55" cy="60" r={r} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth="7"
        strokeDasharray={`${arc} ${circ}`}
        strokeLinecap="round"
        transform="rotate(144 55 60)"
      />
      {/* Fill */}
      <circle cx="55" cy="60" r={r} fill="none"
        stroke={color} strokeWidth="7"
        strokeDasharray={`${arc} ${circ}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(144 55 60)"
        style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.5s ease", filter: `drop-shadow(0 0 6px ${color}80)` }}
      />
      {/* Center text */}
      <text x="55" y="58" textAnchor="middle" fill={color}
        fontSize="18" fontWeight="bold" fontFamily="monospace">
        {Math.round(power)}
      </text>
      <text x="55" y="73" textAnchor="middle" fill="rgba(255,255,255,0.2)"
        fontSize="8" fontFamily="monospace" letterSpacing="2">
        POWER
      </text>
    </svg>
  );
}

// ── Mini status bar ────────────────────────────────────────────────────────
function StatusBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-white/25 uppercase tracking-widest w-9 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
      <span className="text-[9px] font-mono w-7 text-right shrink-0" style={{ color }}>{value}%</span>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────
interface Memory {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
}

interface ConnectedIntegration {
  service: string;
  status: string;
}

interface AvailableModel {
  id: string;
  name: string;
  provider: "google" | "anthropic" | "openai" | "groq";
  description?: string;
  available: boolean;
  cap?: string[];
}

type OutputType = "text" | "image" | "audio";
type Phase = 0 | 1 | 2 | 3 | 4; // 0=idle 1=fueled 2=priming 3=running 4=done

// ── Phase Tracker ──────────────────────────────────────────────────────────
const PHASES = ["LOAD", "PRIME", "RUN", "DONE"];

function PhaseTracker({ phase }: { phase: Phase }) {
  return (
    <div className="flex items-center gap-0">
      {PHASES.map((label, i) => {
        const nodeIndex = i + 1;
        const isActive = phase === nodeIndex;
        const isDone = phase > nodeIndex;
        const isPending = phase < nodeIndex;

        return (
          <div key={label} className="flex items-center">
            {/* Node */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-500"
                style={
                  isDone
                    ? { background: "#7c3aed", borderColor: "#7c3aed", color: "#fff", boxShadow: "0 0 10px rgba(124,58,237,0.55)" }
                    : isActive
                      ? {
                        background: "rgba(233,30,140,0.15)",
                        borderColor: "#e91e8c",
                        color: "#e91e8c",
                        boxShadow: "0 0 18px rgba(233,30,140,0.55)",
                      }
                      : {
                        background: "transparent",
                        borderColor: "rgba(255,255,255,0.1)",
                        color: "rgba(255,255,255,0.2)",
                      }
                }
              >
                {isDone ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  nodeIndex
                )}
              </div>
              <span
                className="text-[9px] font-bold tracking-widest transition-all duration-300"
                style={{
                  color: isDone ? "#a855f7" : isActive ? "#e91e8c" : "rgba(255,255,255,0.2)",
                }}
              >
                {label}
              </span>
            </div>

            {/* Connector line */}
            {i < PHASES.length - 1 && (
              <div className="flex items-center w-12 mx-1 mb-4">
                <div
                  className="w-full transition-all duration-500"
                  style={{
                    borderTop: `1.5px ${phase > nodeIndex ? "solid" : "dashed"} ${phase > nodeIndex ? "#7c3aed" : "rgba(255,255,255,0.12)"
                      }`,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Output line parser ─────────────────────────────────────────────────────
interface OutputLine {
  type: "step" | "result" | "error" | "text";
  content: string;
  stepNum?: number;
}

function parseOutputLines(raw: string): OutputLine[] {
  if (!raw) return [];
  const lines = raw.split("\n").filter(Boolean);
  let stepCounter = 0;
  return lines.map((line) => {
    if (line.startsWith("STEP:")) {
      stepCounter++;
      return { type: "step", content: line.replace(/^STEP:\s*/, ""), stepNum: stepCounter };
    }
    if (line.startsWith("RESULT:")) return { type: "result", content: line.replace(/^RESULT:\s*/, "") };
    if (line.startsWith("ERROR:")) return { type: "error", content: line.replace(/^ERROR:\s*/, "") };
    return { type: "text", content: line };
  });
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function EnginePage() {
  const [prompt, setPrompt] = useState("");
  const [engineState, setEngineState] = useState<EngineState>("idle");
  const [phase, setPhase] = useState<Phase>(0);
  const [chunks, setChunks] = useState<string[]>([]);
  const [isDone, setIsDone] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [toolEvents, setToolEvents] = useState<{ type: "call" | "result"; name: string; payload: unknown; id: number }[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [savedToMemory, setSavedToMemory] = useState(false);
  const [gaugePower, setGaugePower] = useState(0);
  const [gaugeTemp, setGaugeTemp] = useState(0);
  const [gaugeLoad, setGaugeLoad] = useState(0);
  const [stepsPopupOpen, setStepsPopupOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  // Inline panels data
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loadedMemoryIds, setLoadedMemoryIds] = useState<string[]>([]);
  const [connectedIntegrations, setConnectedIntegrations] = useState<ConnectedIntegration[]>([]);
  const [activeMods, setActiveMods] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);

  // Multi-modal state
  const [outputType, setOutputType] = useState<OutputType>("text");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaContext, setMediaContext] = useState<string>("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [ttsVoice, setTtsVoice] = useState("alloy");
  const [imageSize, setImageSize] = useState("1024x1024");
  const [publishPlatforms, setPublishPlatforms] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Load model preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("autoflow-model");
    if (saved) setSelectedModel(saved);
  }, []);

  // Close model dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Load data
  useEffect(() => {
    fetch("/api/engine/memory")
      .then((r) => r.json())
      .then((d) => setMemories(d.memories || []))
      .catch(() => { });

    fetch("/api/integrations")
      .then((r) => r.json())
      .then((d) => {
        const list: ConnectedIntegration[] = d.integrations || [];
        setConnectedIntegrations(list);
        setActiveMods(list.map((i) => i.service));
      })
      .catch(() => { });

    // Fetch available models
    fetch("/api/settings/models")
      .then((r) => r.json())
      .then((d) => {
        const models: AvailableModel[] = d.models || [];
        setAvailableModels(models);
        // Read localStorage directly to avoid stale closure over selectedModel state
        const savedId = localStorage.getItem("autoflow-model");
        const resolvedId = savedId || "gemini-2.5-flash";
        const currentAvailable = models.find((m) => m.id === resolvedId && m.available);
        if (currentAvailable) {
          // Ensure React state matches localStorage
          setSelectedModel(resolvedId);
        } else {
          // Saved model no longer in list — pick first available
          const firstAvailable = models.find((m) => m.available);
          if (firstAvailable) {
            setSelectedModel(firstAvailable.id);
            localStorage.setItem("autoflow-model", firstAvailable.id);
          }
        }
      })
      .catch(() => { });
  }, []);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [chunks]);

  // Update phase based on state
  useEffect(() => {
    if (engineState === "idle" && !isDone) setPhase(prompt.trim() ? 1 : 0);
    else if (engineState === "thinking") setPhase(2);
    else if (engineState === "running") setPhase(3);
    else if (engineState === "success" || engineState === "error") setPhase(4);
  }, [engineState, prompt, isDone]);

  // Update engine gauges based on state
  useEffect(() => {
    const targets: Record<EngineState, [number, number, number]> = {
      idle: [0, 0, 0],
      thinking: [35, 28, 22],
      running: [88, 74, 95],
      success: [100, 60, 100],
      error: [12, 20, 8],
    };
    const [p, t, l] = targets[engineState];
    setGaugePower(p);
    setGaugeTemp(t);
    setGaugeLoad(l);
  }, [engineState]);

  function toggleMemory(id: string) {
    setLoadedMemoryIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function toggleMod(service: string) {
    setActiveMods((p) => (p.includes(service) ? p.filter((x) => x !== service) : [...p, service]));
  }

  async function ignite() {
    if (!prompt.trim() || engineState === "running" || engineState === "thinking") return;
    setChunks([]);
    setIsDone(false);
    setRunError(null);
    setSavedToMemory(false);
    setStepsPopupOpen(false);
    setGeneratedImage(null);
    setGeneratedAudio(null);
    setEngineState("thinking");

    const abort = new AbortController();
    abortRef.current = abort;

    // ── Image generation ──────────────────────────────────────────────────
    if (outputType === "image") {
      try {
        setEngineState("running");
        const res = await fetch("/api/engine/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abort.signal,
          body: JSON.stringify({
            type: "image",
            prompt: prompt.trim(),
            model: selectedModel.startsWith("dall-e") || selectedModel.startsWith("imagen") ? selectedModel : "dall-e-3",
            size: imageSize,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Image generation failed");
        setGeneratedImage(data.b64 ?? null);
        setEngineState("success");
        setIsDone(true);
        setTimeout(() => setEngineState("idle"), 4000);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setRunError(err instanceof Error ? err.message : "Unknown error");
        setEngineState("error");
        setIsDone(true);
      }
      return;
    }

    // ── Audio generation (TTS) ────────────────────────────────────────────
    if (outputType === "audio") {
      try {
        setEngineState("running");
        const res = await fetch("/api/engine/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abort.signal,
          body: JSON.stringify({
            type: "audio",
            text: prompt.trim(),
            model: selectedModel.startsWith("tts-") ? selectedModel : "tts-1",
            voice: ttsVoice,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Audio generation failed");
        setGeneratedAudio(data.audioBase64 ?? null);
        setEngineState("success");
        setIsDone(true);
        setTimeout(() => setEngineState("idle"), 4000);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setRunError(err instanceof Error ? err.message : "Unknown error");
        setEngineState("error");
        setIsDone(true);
      }
      return;
    }

    // ── Text generation (SSE stream) ──────────────────────────────────────
    try {
      const res = await fetch("/api/engine/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({ prompt, memoryIds: loadedMemoryIds, mods: activeMods, model: selectedModel, mediaContext: mediaContext || undefined }),
      });

      if (!res.ok) {
        let errMsg = "Engine failed to start";
        try {
          const err = await res.json();
          errMsg = err.error ?? errMsg;
        } catch {
          // Response might not be JSON
        }
        throw new Error(errMsg);
      }

      setEngineState("running");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = ""; // Buffer for incomplete SSE chunks

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Process any remaining buffer when stream ends
          if (buffer.trim()) {
            processSSEBuffer(buffer);
          }
          // If stream ended but we didn't get a done signal, mark as success
          if (!isDone) {
            setEngineState("success");
            setIsDone(true);
            setTimeout(() => setEngineState("idle"), 4000);
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (split by double newline or single newline for data lines)
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          if (!line.startsWith("data: ")) continue;

          try {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            const data = JSON.parse(jsonStr);
            if (data.error) {
              setRunError(data.error);
              setEngineState("error");
              setIsDone(true);
              return;
            }
            if (data.text) {
              setChunks((p) => [...p, data.text]);
            }
            if (data.toolCall) {
              setToolEvents((p) => [...p, { type: "call", name: data.toolCall.name, payload: data.toolCall.args, id: Date.now() }]);
            }
            if (data.toolResult) {
              setToolEvents((p) => [...p, { type: "result", name: data.toolResult.name, payload: data.toolResult.result, id: Date.now() + 1 }]);
            }
            if (data.done) {
              setEngineState("success");
              setIsDone(true);
              setTimeout(() => setEngineState("idle"), 4000);
            }
          } catch {
            // Skip malformed JSON lines, continue processing
            console.warn("Skipping malformed SSE line:", line);
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setRunError(err instanceof Error ? err.message : "Unknown error");
      setEngineState("error");
      setIsDone(true);
    }
  }

  function processSSEBuffer(buffer: string) {
    const lines = buffer.split("\n");
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6).trim());
        if (data.text) setChunks((p) => [...p, data.text]);
        if (data.toolCall) setToolEvents((p) => [...p, { type: "call", name: data.toolCall.name, payload: data.toolCall.args, id: Date.now() }]);
        if (data.toolResult) setToolEvents((p) => [...p, { type: "result", name: data.toolResult.name, payload: data.toolResult.result, id: Date.now() + 1 }]);
        if (data.done) {
          setEngineState("success");
          setIsDone(true);
        }
      } catch {
        // Ignore
      }
    }
  }

  function stop() {
    abortRef.current?.abort();
    setEngineState("idle");
    setIsDone(true);
  }

  function reset() {
    setChunks([]);
    setIsDone(false);
    setRunError(null);
    setEngineState("idle");
    setPhase(0);
    setPrompt("");
    setSavedToMemory(false);
    setStepsPopupOpen(false);
    setGeneratedImage(null);
    setGeneratedAudio(null);
    setMediaFile(null);
    setMediaContext("");
    setToolEvents([]);
  }

  function handleMediaFile(file: File) {
    setMediaFile(file);
    setMediaContext(`[Attached file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB, type: ${file.type})]`);
  }

  const isRunning = engineState === "running" || engineState === "thinking";
  const fullOutput = chunks.join("");
  const outputLines = parseOutputLines(fullOutput);
  const stepsDone = outputLines.filter((l) => l.type === "step").length;

  return (
    <div className="min-h-screen bg-[#07070f] text-white flex flex-col overflow-hidden">
      {/* Save Memory Modal */}
      <SaveMemoryModal
        isOpen={saveModalOpen}
        output={fullOutput}
        prompt={prompt}
        onClose={() => setSaveModalOpen(false)}
        onSaved={() => {
          setSavedToMemory(true);
          setSaveModalOpen(false);
        }}
      />

      {/* ── Top Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#e91e8c", textShadow: "0 0 30px rgba(233,30,140,0.45)" }}>
            ENGINE ROOM
          </h1>
          <p className="text-white/30 text-xs mt-0.5 tracking-widest uppercase">Fuel it. Prime it. Ignite.</p>
        </div>

        <PhaseTracker phase={phase} />

        <div className="flex items-center gap-2">
          {isDone && (
            <button
              onClick={reset}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
            >
              New run
            </button>
          )}
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background:
                engineState === "running"
                  ? "#f97316"
                  : engineState === "success"
                    ? "#22c55e"
                    : engineState === "error"
                      ? "#ef4444"
                      : "#6366f1",
              boxShadow: `0 0 8px currentColor`,
            }}
          />
        </div>
      </div>

      {/* ── 3-Panel Cockpit ── */}
      <div className="flex-1 grid grid-cols-[480px_1fr_480px] gap-4 p-4 overflow-hidden">

        {/* ════ LEFT COLUMN ════ */}
        <div className="flex flex-col gap-4 overflow-hidden">

          {/* OUTPUT TYPE SELECTOR */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/3 border border-white/8">
            {([
              { t: "text" as OutputType, label: "Text", icon: "⌨️", desc: "LLM reasoning" },
              { t: "image" as OutputType, label: "Image", icon: "🎨", desc: "AI generation" },
              { t: "audio" as OutputType, label: "Audio", icon: "🎵", desc: "Text-to-speech" },
            ] as { t: OutputType; label: string; icon: string; desc: string }[]).map((opt) => (
              <button
                key={opt.t}
                onClick={() => !isRunning && setOutputType(opt.t)}
                disabled={isRunning}
                className="flex-1 flex flex-col items-center gap-0.5 py-2 px-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
                style={outputType === opt.t ? {
                  background: "rgba(168,85,247,0.15)",
                  borderColor: "rgba(168,85,247,0.5)",
                  color: "#c084fc",
                  boxShadow: "0 0 12px rgba(168,85,247,0.15)",
                  border: "1px solid rgba(168,85,247,0.4)",
                } : {
                  border: "1px solid transparent",
                  color: "rgba(255,255,255,0.3)",
                }}
              >
                <span className="text-base">{opt.icon}</span>
                <span>{opt.label}</span>
                <span className="text-[9px] text-white/25">{opt.desc}</span>
              </button>
            ))}
          </div>

          {/* FUEL INPUT */}
          <div
            className="rounded-2xl border p-4 flex flex-col gap-3 shrink-0"
            style={{
              background: "linear-gradient(145deg, #0e0b22 0%, #0b0918 100%)",
              borderColor: prompt.trim() ? "rgba(147,51,234,0.55)" : "rgba(120,50,255,0.22)",
              boxShadow: prompt.trim()
                ? "0 0 28px rgba(147,51,234,0.18), inset 0 0 20px rgba(147,51,234,0.06)"
                : "0 0 0px transparent",
              transition: "all 0.3s ease",
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: "#a855f7", boxShadow: "0 0 6px #a855f7" }} />
              <span className="text-xs font-bold text-white/60 uppercase tracking-[0.2em]">
                {outputType === "text" ? "Fuel Input" : outputType === "image" ? "Image Prompt" : "TTS Input"}
              </span>
              <span className="ml-auto text-xs text-white/20">{prompt.length > 0 ? `${prompt.length} chars` : "⌘+Enter to run"}</span>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ignite(); }}
              placeholder={
                outputType === "image"
                  ? "Describe the image to generate...\n\nExample: A futuristic city at night with neon lights reflecting on wet streets, cinematic, 8K"
                  : outputType === "audio"
                    ? "Enter the text to convert to speech...\n\nExample: Welcome to AutoFlow. Your AI automation engine is ready."
                    : "Describe what you want the engine to do...\n\nExample: Find trending AI videos on YouTube and write a 60-second script."
              }
              rows={6}
              disabled={isRunning}
              className="w-full bg-transparent text-white placeholder-white/15 text-sm leading-relaxed resize-none focus:outline-none disabled:opacity-40"
            />

            {/* Audio options */}
            {outputType === "audio" && (
              <div className="flex items-center gap-3 pt-1 border-t border-white/5">
                <span className="text-xs text-white/30">Voice:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {["alloy", "echo", "fable", "onyx", "nova", "shimmer"].map((v) => (
                    <button
                      key={v}
                      onClick={() => setTtsVoice(v)}
                      className="px-2 py-1 rounded-lg text-[10px] border transition-all"
                      style={ttsVoice === v ? {
                        background: "rgba(168,85,247,0.15)",
                        borderColor: "rgba(168,85,247,0.5)",
                        color: "#c084fc",
                      } : {
                        background: "transparent",
                        borderColor: "rgba(255,255,255,0.1)",
                        color: "rgba(255,255,255,0.3)",
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Image size options */}
            {outputType === "image" && (
              <div className="flex items-center gap-3 pt-1 border-t border-white/5">
                <span className="text-xs text-white/30">Size:</span>
                <div className="flex gap-1.5">
                  {[["1024x1024", "Square"], ["1792x1024", "Wide"], ["1024x1792", "Portrait"]].map(([size, label]) => (
                    <button
                      key={size}
                      onClick={() => setImageSize(size)}
                      className="px-2 py-1 rounded-lg text-[10px] border transition-all"
                      style={imageSize === size ? {
                        background: "rgba(168,85,247,0.15)",
                        borderColor: "rgba(168,85,247,0.5)",
                        color: "#c084fc",
                      } : {
                        background: "transparent",
                        borderColor: "rgba(255,255,255,0.1)",
                        color: "rgba(255,255,255,0.3)",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Media upload (text mode) */}
            {outputType === "text" && (
              <div
                className="rounded-xl border border-dashed border-white/10 p-3 flex items-center gap-3 cursor-pointer hover:border-white/20 transition-all"
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleMediaFile(file);
                }}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => document.getElementById("media-upload")?.click()}
              >
                <input
                  id="media-upload"
                  type="file"
                  accept="video/*,audio/*,image/*"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleMediaFile(e.target.files[0]); }}
                />
                {mediaFile ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-base">{mediaFile.type.startsWith("video") ? "🎬" : mediaFile.type.startsWith("audio") ? "🎵" : "🖼️"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/60 truncate">{mediaFile.name}</p>
                      <p className="text-[10px] text-white/25">{(mediaFile.size / 1024 / 1024).toFixed(2)}MB — as context</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMediaFile(null); setMediaContext(""); }}
                      className="text-white/30 hover:text-white/60 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-lg bg-white/4 border border-white/8 flex items-center justify-center text-sm shrink-0">
                      📎
                    </div>
                    <div>
                      <p className="text-xs text-white/30">Attach media as context</p>
                      <p className="text-[10px] text-white/15">Video, audio, or image • drag & drop or click</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Quick start chips */}
            {!isRunning && !isDone && prompt.length === 0 && outputType === "text" && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/5">
                {[
                  { l: "YouTube script", p: "Find 3 trending YouTube topics about AI this week and write a 60-second script." },
                  { l: "Cold email", p: "Write a compelling cold email for a SaaS product with subject line and CTA." },
                  { l: "Market research", p: "Research top 5 competitors in the AI automation space and summarize differentiators." },
                  { l: "Social post", p: "Create 3 LinkedIn posts about AI automation for small businesses under 200 words each." },
                  { l: "YouTube upload", p: "I have a video about AI automation for small businesses. Generate an optimized YouTube title, description (with timestamps), tags (30), and thumbnail concept." },
                  { l: "LinkedIn post", p: "Create a professional LinkedIn post about launching an AI product, with hook, story, CTA, and 5 relevant hashtags." },
                ].map((s) => (
                  <button
                    key={s.l}
                    onClick={() => setPrompt(s.p)}
                    className="px-2.5 py-1 rounded-full text-[10px] border border-purple-500/25 text-purple-300/60 hover:border-purple-400/60 hover:text-purple-200 hover:bg-purple-500/15 transition-all"
                  >
                    {s.l}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1 border-t border-white/5">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border font-medium transition-all ${loadedMemoryIds.length > 0
                ? "border-purple-500/50 bg-purple-500/15 text-purple-200"
                : "border-white/8 text-white/25"
                }`}>
                <span>🧠</span>
                {loadedMemoryIds.length > 0 ? `${loadedMemoryIds.length} Memories Loaded` : "No memory"}
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${activeMods.length > 0
                ? "text-white"
                : "border-white/8 text-white/25"
                }`} style={activeMods.length > 0 ? {
                  background: "linear-gradient(90deg, #ea580c, #f97316)",
                  borderColor: "transparent",
                  boxShadow: "0 0 14px rgba(249,115,22,0.35)",
                } : undefined}>
                <span>⚡</span>
                {activeMods.length > 0 ? `${activeMods.length} Mods Active` : "No mods"}
              </div>
            </div>
          </div>

          {/* MEMORY TANK */}
          <div
            className="rounded-2xl border flex flex-col gap-3 flex-1 overflow-hidden"
            style={{ background: "linear-gradient(145deg, #0e0b22 0%, #0b0918 100%)", borderColor: "rgba(120,50,255,0.28)", boxShadow: "0 0 20px rgba(100,30,255,0.06)" }}
          >
            <div className="flex items-center gap-2 px-4 pt-4">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#a855f7", boxShadow: "0 0 4px #a855f7" }} />
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#7c3aed", boxShadow: "0 0 4px #7c3aed" }} />
              </div>
              <span className="text-xs font-bold text-white/60 uppercase tracking-[0.2em]">Memory Tank</span>
              {loadedMemoryIds.length > 0 && (
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
                  {loadedMemoryIds.length} loaded
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-3 scrollbar-hide">
              {memories.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6">
                  <div className="w-10 h-10 rounded-xl bg-white/3 border border-white/8 flex items-center justify-center text-xl">🧠</div>
                  <p className="text-xs text-white/25 text-center">No memories yet.<br />Save engine output to build your memory bank.</p>
                </div>
              ) : (
                memories.map((mem) => {
                  const isLoaded = loadedMemoryIds.includes(mem.id);
                  return (
                    <button
                      key={mem.id}
                      onClick={() => toggleMemory(mem.id)}
                      className="w-full text-left rounded-xl border p-3 flex flex-col gap-1.5 transition-all duration-200 group"
                      style={{
                        background: isLoaded ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.018)",
                        borderColor: isLoaded ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.07)",
                        boxShadow: isLoaded ? "0 0 12px rgba(99,102,241,0.1)" : "none",
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm"
                          style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)" }}
                        >
                          {mem.pinned ? "📌" : "💡"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white/80 truncate">{mem.title}</p>
                          {mem.tags.length > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400/80 border border-indigo-500/20">
                              {mem.tags[0]}
                            </span>
                          )}
                        </div>
                        <div
                          className="w-4 h-4 rounded-full border shrink-0 flex items-center justify-center transition-all"
                          style={{
                            borderColor: isLoaded ? "#6366f1" : "rgba(255,255,255,0.15)",
                            background: isLoaded ? "#6366f1" : "transparent",
                          }}
                        >
                          {isLoaded && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-white/25 line-clamp-1 pl-9">{mem.content.slice(0, 60)}…</p>
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-4 pb-4">
              <a
                href="/dashboard/settings"
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/8 text-xs text-white/30 hover:text-white/60 hover:border-white/15 transition-all"
              >
                <span>🗂️</span> Manage Memory
              </a>
            </div>
          </div>
        </div>

        {/* ════ CENTER COLUMN ════ */}
        <div className="flex flex-col items-center gap-4 py-4">
          <p
            className="text-xs font-extrabold uppercase tracking-[0.3em]"
            style={{ color: "#22d3ee", textShadow: "0 0 20px rgba(34,211,238,0.5)" }}
          >
            Engine Chamber
          </p>

          {/* Mascot */}
          <AgentMascot state={engineState} />

          {/* ── Power gauge + status bars ── */}
          <div
            className="w-full max-w-75 rounded-2xl border p-4 space-y-3"
            style={{
              background: "linear-gradient(145deg, #0d0b1e 0%, #080614 100%)",
              borderColor: "rgba(120,50,255,0.2)",
              boxShadow: "0 0 20px rgba(100,20,255,0.08)",
            }}
          >
            {/* Arc gauge */}
            <div className="flex items-center justify-center">
              <PowerGauge
                power={gaugePower}
                color={
                  engineState === "success" ? "#22c55e"
                    : engineState === "error" ? "#ef4444"
                      : engineState === "running" ? "#f97316"
                        : "#7c3aed"
                }
              />
            </div>

            {/* Status bars */}
            <div className="space-y-1.5">
              <StatusBar label="PWR" value={gaugePower}
                color={engineState === "running" ? "#f97316" : engineState === "success" ? "#22c55e" : "#7c3aed"} />
              <StatusBar label="TEMP" value={gaugeTemp} color="#a855f7" />
              <StatusBar label="LOAD" value={gaugeLoad}
                color={engineState === "running" ? "#f97316" : "#6366f1"} />
            </div>
          </div>

          {/* ── Model selector ── */}
          <div className="w-full max-w-75 relative" ref={modelDropdownRef}>
            <button
              onClick={() => !isRunning && setModelDropdownOpen((v) => !v)}
              disabled={isRunning}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all disabled:opacity-40"
              style={{
                background: modelDropdownOpen ? "rgba(168,85,247,0.08)" : "rgba(255,255,255,0.03)",
                borderColor: modelDropdownOpen ? "rgba(168,85,247,0.55)" : "rgba(120,50,255,0.25)",
                boxShadow: modelDropdownOpen ? "0 0 16px rgba(168,85,247,0.15)" : "none",
              }}
            >
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0"
                style={{
                  background: availableModels.find((m) => m.id === selectedModel)?.provider === "anthropic"
                    ? "rgba(212,167,106,0.2)" : "rgba(99,179,237,0.2)",
                  color: availableModels.find((m) => m.id === selectedModel)?.provider === "anthropic"
                    ? "#d4a76a" : "#63b3ed",
                }}
              >
                {availableModels.find((m) => m.id === selectedModel)?.provider === "anthropic" ? "A" : "G"}
              </div>
              <span className="flex-1 text-xs font-medium text-left truncate" style={{ color: "#a855f7" }}>
                {availableModels.find((m) => m.id === selectedModel)?.name ?? selectedModel}
              </span>
              <svg
                className={`w-3 h-3 shrink-0 transition-transform duration-200 ${modelDropdownOpen ? "rotate-180" : ""}`}
                fill="none" stroke="#a855f7" strokeWidth={2.5} viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown panel */}
            {modelDropdownOpen && (
              <div
                className="absolute top-full mt-1.5 left-0 right-0 z-50 rounded-xl border overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, #0f0d24, #0b0918)",
                  borderColor: "rgba(168,85,247,0.3)",
                  boxShadow: "0 0 40px rgba(168,85,247,0.12), 0 20px 40px rgba(0,0,0,0.7)",
                }}
              >
                <div className="max-h-60 overflow-y-auto scrollbar-hide">
                  {/* Gemini group */}
                  {availableModels.filter((m) => m.provider === "google").length > 0 && (
                    <>
                      <div className="px-3 py-1.5 border-b border-white/6 sticky top-0" style={{ background: "#0f0d24" }}>
                        <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Gemini · Google</span>
                      </div>
                      {availableModels.filter((m) => m.provider === "google").map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            if (m.available) {
                              setSelectedModel(m.id);
                              localStorage.setItem("autoflow-model", m.id);
                              setModelDropdownOpen(false);
                              if (m.cap?.includes("image") && !m.cap?.includes("text")) setOutputType("image");
                            }
                          }}
                          disabled={!m.available}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors disabled:opacity-30 hover:bg-purple-500/8"
                          style={{ background: selectedModel === m.id ? "rgba(168,85,247,0.12)" : undefined }}
                        >
                          <div className="w-4 h-4 rounded shrink-0 flex items-center justify-center text-[8px] font-bold" style={{ background: "rgba(99,179,237,0.15)", color: "#63b3ed" }}>G</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: selectedModel === m.id ? "#a855f7" : "rgba(255,255,255,0.75)" }}>{m.name}</p>
                            {m.cap?.includes("image") && !m.cap?.includes("text") && (
                              <span className="text-[8px] px-1 rounded bg-purple-500/10 text-purple-400/70">image</span>
                            )}
                          </div>
                          {selectedModel === m.id && (
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "#a855f7", boxShadow: "0 0 6px #a855f7" }} />
                          )}
                        </button>
                      ))}
                    </>
                  )}
                  {/* Claude group */}
                  {availableModels.filter((m) => m.provider === "anthropic").length > 0 && (
                    <>
                      <div className="px-3 py-1.5 border-b border-white/6 border-t border-t-white/4 sticky top-0" style={{ background: "#0f0d24" }}>
                        <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Claude · Anthropic</span>
                      </div>
                      {availableModels.filter((m) => m.provider === "anthropic").map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { if (m.available) { setSelectedModel(m.id); localStorage.setItem("autoflow-model", m.id); setModelDropdownOpen(false); } }}
                          disabled={!m.available}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors disabled:opacity-30 hover:bg-purple-500/8"
                          style={{ background: selectedModel === m.id ? "rgba(168,85,247,0.12)" : undefined }}
                        >
                          <div className="w-4 h-4 rounded shrink-0 flex items-center justify-center text-[8px] font-bold" style={{ background: "rgba(212,167,106,0.15)", color: "#d4a76a" }}>A</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: selectedModel === m.id ? "#a855f7" : "rgba(255,255,255,0.75)" }}>{m.name}</p>
                          </div>
                          {!m.available && <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-white/25 shrink-0">no key</span>}
                          {selectedModel === m.id && m.available && (
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "#a855f7", boxShadow: "0 0 6px #a855f7" }} />
                          )}
                        </button>
                      ))}
                    </>
                  )}
                  {/* OpenAI group */}
                  {availableModels.filter((m) => m.provider === "openai").length > 0 && (
                    <>
                      <div className="px-3 py-1.5 border-b border-white/6 border-t border-t-white/4 sticky top-0" style={{ background: "#0f0d24" }}>
                        <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">GPT · OpenAI</span>
                      </div>
                      {availableModels.filter((m) => m.provider === "openai").map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            if (m.available) {
                              setSelectedModel(m.id);
                              localStorage.setItem("autoflow-model", m.id);
                              setModelDropdownOpen(false);
                              // Auto-switch output type if model only supports image/audio
                              if (m.cap?.includes("image") && !m.cap?.includes("text")) setOutputType("image");
                              if (m.cap?.includes("audio") && !m.cap?.includes("text")) setOutputType("audio");
                            }
                          }}
                          disabled={!m.available}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors disabled:opacity-30 hover:bg-purple-500/8"
                          style={{ background: selectedModel === m.id ? "rgba(168,85,247,0.12)" : undefined }}
                        >
                          <div className="w-4 h-4 rounded shrink-0 flex items-center justify-center text-[8px] font-bold" style={{ background: "rgba(16,163,127,0.15)", color: "#10a37f" }}>O</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: selectedModel === m.id ? "#a855f7" : "rgba(255,255,255,0.75)" }}>{m.name}</p>
                            <div className="flex gap-0.5 mt-0.5">
                              {m.cap?.map((c) => <span key={c} className="text-[8px] px-1 rounded bg-white/4 text-white/25">{c}</span>)}
                            </div>
                          </div>
                          {selectedModel === m.id && m.available && (
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "#a855f7", boxShadow: "0 0 6px #a855f7" }} />
                          )}
                        </button>
                      ))}
                    </>
                  )}
                  {/* Groq group */}
                  {availableModels.filter((m) => m.provider === "groq").length > 0 && (
                    <>
                      <div className="px-3 py-1.5 border-b border-white/6 border-t border-t-white/4 sticky top-0" style={{ background: "#0f0d24" }}>
                        <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Llama · Groq</span>
                      </div>
                      {availableModels.filter((m) => m.provider === "groq").map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { if (m.available) { setSelectedModel(m.id); localStorage.setItem("autoflow-model", m.id); setModelDropdownOpen(false); } }}
                          disabled={!m.available}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors disabled:opacity-30 hover:bg-purple-500/8"
                          style={{ background: selectedModel === m.id ? "rgba(168,85,247,0.12)" : undefined }}
                        >
                          <div className="w-4 h-4 rounded shrink-0 flex items-center justify-center text-[8px] font-bold" style={{ background: "rgba(245,80,54,0.15)", color: "#f55036" }}>⚡</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: selectedModel === m.id ? "#a855f7" : "rgba(255,255,255,0.75)" }}>{m.name}</p>
                          </div>
                          {selectedModel === m.id && m.available && (
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "#a855f7", boxShadow: "0 0 6px #a855f7" }} />
                          )}
                        </button>
                      ))}
                    </>
                  )}
                  {availableModels.length === 0 && (
                    <div className="px-3 py-4 text-xs text-white/30 text-center">Loading models…
                      <div className="mt-1"><a href="/dashboard/settings/ai-keys" className="text-purple-400 hover:underline text-[10px]">Add API keys →</a></div>
                    </div>
                  )}
                </div>
                {/* Add keys shortcut */}
                <div className="p-2 border-t border-white/6">
                  <a href="/dashboard/settings/ai-keys" className="flex items-center justify-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition-colors py-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    Add AI provider keys
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* ── Ignite / Stop button ── */}
          <div className="w-full max-w-75 space-y-2.5">
            <AnimatePresence mode="wait">
              {isRunning ? (
                <motion.button
                  key="stop"
                  onClick={stop}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full py-4 rounded-2xl text-sm font-bold text-white border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                >
                  ■ &nbsp;Stop Engine
                </motion.button>
              ) : (
                <motion.button
                  key="ignite"
                  onClick={ignite}
                  disabled={!prompt.trim()}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  whileHover={prompt.trim() ? { scale: 1.03 } : {}}
                  whileTap={prompt.trim() ? { scale: 0.97 } : {}}
                  className="relative w-full py-4 rounded-2xl text-base font-extrabold text-white disabled:opacity-25 disabled:cursor-not-allowed overflow-hidden"
                  style={{
                    background: prompt.trim()
                      ? "linear-gradient(135deg, #ea580c 0%, #f97316 60%, #fb923c 100%)"
                      : "linear-gradient(135deg, #78350f 0%, #92400e 100%)",
                    boxShadow: prompt.trim() ? "0 0 24px rgba(249,115,22,0.4), 0 4px 20px rgba(234,88,12,0.3)" : "none",
                  }}
                >
                  {/* Pulse ring on hover */}
                  {prompt.trim() && (
                    <motion.span
                      className="absolute inset-0 rounded-2xl"
                      animate={{
                        boxShadow: [
                          "0 0 0px rgba(249,115,22,0)",
                          "0 0 40px rgba(249,115,22,0.6), 0 0 80px rgba(234,88,12,0.3)",
                          "0 0 0px rgba(249,115,22,0)",
                        ]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <motion.span
                      className="text-xl"
                      animate={prompt.trim() ? { rotate: [0, 15, -10, 0] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                    >
                      ⚡
                    </motion.span>
                    IGNITE ENGINE
                  </span>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Run stats */}
            {(isRunning || isDone) && (
              <motion.div
                className="flex gap-2 text-center"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex-1 rounded-xl border border-white/8 bg-white/2 py-2">
                  <p className="text-lg font-bold text-orange-400">{stepsDone}</p>
                  <p className="text-[9px] text-white/25 uppercase tracking-wider">Steps</p>
                </div>
                <div className="flex-1 rounded-xl border border-white/8 bg-white/2 py-2">
                  <p className="text-lg font-bold text-indigo-400">{Math.floor(fullOutput.length / 5)}</p>
                  <p className="text-[9px] text-white/25 uppercase tracking-wider">Words</p>
                </div>
                <div className="flex-1 rounded-xl border border-white/8 bg-white/2 py-2">
                  <p className="text-lg font-bold" style={{
                    color: !isRunning && isDone ? (!runError ? "#22c55e" : "#ef4444") : "#f97316",
                  }}>
                    {!isRunning && isDone ? (!runError ? "✓" : "✗") : "…"}
                  </p>
                  <p className="text-[9px] text-white/25 uppercase tracking-wider">Status</p>
                </div>
              </motion.div>
            )}

            {/* Save to memory */}
            {isDone && !runError && !savedToMemory && fullOutput && (
              <motion.button
                onClick={() => setSaveModalOpen(true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 transition-all"
              >
                🧠 Save to Memory
              </motion.button>
            )}
            {savedToMemory && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center text-xs text-emerald-400 py-1"
              >
                ✓ Saved to memory
              </motion.div>
            )}
          </div>
        </div>

        {/* ════ RIGHT COLUMN ════ */}
        <div className="flex flex-col gap-4 overflow-hidden">

          {/* LIVE OUTPUT */}
          <div
            className="rounded-2xl border flex flex-col overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #07060f 0%, #0b0918 100%)",
              borderColor: "rgba(120,50,255,0.25)",
              boxShadow: "0 0 20px rgba(100,30,255,0.05)",
              height: "420px",
              flexShrink: 0,
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 shrink-0">
              <div className="flex gap-1">
                <div
                  className="w-1.5 h-1.5 rounded-full transition-all"
                  style={{ background: isRunning ? "#f97316" : "rgba(255,255,255,0.15)", boxShadow: isRunning ? "0 0 5px #f97316" : "none" }}
                />
                <div
                  className="w-1.5 h-1.5 rounded-full transition-all"
                  style={{ background: isRunning ? "#a855f7" : "rgba(255,255,255,0.07)", boxShadow: isRunning ? "0 0 5px #a855f7" : "none" }}
                />
              </div>
              <span className="text-xs font-bold text-white/60 uppercase tracking-[0.2em]">
                Live Output / Exhaust
              </span>

              <div className="ml-auto flex items-center gap-2">
                {/* Steps popup badge */}
                {stepsDone > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setStepsPopupOpen((v) => !v)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border"
                      style={{
                        background: stepsPopupOpen ? "rgba(249,115,22,0.2)" : "rgba(249,115,22,0.1)",
                        borderColor: "rgba(249,115,22,0.35)",
                        color: "#f97316",
                        boxShadow: stepsPopupOpen ? "0 0 12px rgba(249,115,22,0.3)" : "none",
                      }}
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {stepsDone} step{stepsDone !== 1 ? "s" : ""}
                    </button>

                    {/* Steps popup */}
                    {stepsPopupOpen && (
                      <>
                        {/* Backdrop */}
                        <div className="fixed inset-0 z-40" onClick={() => setStepsPopupOpen(false)} />
                        <div
                          className="absolute right-0 top-8 z-50 w-72 rounded-xl border shadow-2xl overflow-hidden"
                          style={{
                            background: "linear-gradient(145deg, #0f0d24, #0b0918)",
                            borderColor: "rgba(249,115,22,0.3)",
                            boxShadow: "0 0 40px rgba(249,115,22,0.1), 0 20px 40px rgba(0,0,0,0.6)",
                          }}
                        >
                          {/* Popup header */}
                          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.07]">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-orange-400" style={{ boxShadow: "0 0 5px #f97316" }} />
                              <span className="text-[10px] font-bold text-white/60 uppercase tracking-[0.15em]">Execution Steps</span>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                              style={{ background: "rgba(249,115,22,0.15)", color: "#f97316" }}>
                              {stepsDone} / {stepsDone}
                            </span>
                          </div>

                          {/* Steps list */}
                          <div className="max-h-60 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                            {outputLines.filter((l) => l.type === "step").map((step, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-all"
                                style={{ background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.1)" }}
                              >
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                                  style={{ background: "rgba(34,197,94,0.15)", border: "1.5px solid #22c55e", color: "#22c55e" }}
                                >
                                  {step.stepNum}
                                </div>
                                <p className="text-[10px] text-white/60 leading-snug">{step.content}</p>
                              </div>
                            ))}
                            {isRunning && (
                              <div className="flex items-center gap-2 px-2.5 py-2">
                                <div className="flex gap-0.5">
                                  {[0, 1, 2].map((i) => (
                                    <div key={i} className="w-1 h-1 rounded-full bg-orange-400/50 animate-bounce"
                                      style={{ animationDelay: `${i * 0.1}s` }} />
                                  ))}
                                </div>
                                <span className="text-[9px] text-white/25">Running…</span>
                              </div>
                            )}
                          </div>

                          {/* Popup footer */}
                          <div className="px-3 py-2 border-t border-white/5">
                            <p className="text-[9px] text-white/20">
                              {Math.floor(fullOutput.length / 5)} words · {outputLines.filter(l => l.type === "result").length > 0 ? "✓ Result received" : isRunning ? "Streaming…" : "Done"}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {isRunning && stepsDone === 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                    <span className="text-[10px] text-orange-400/70">streaming</span>
                  </div>
                )}

                {isDone && fullOutput && (
                  <button
                    onClick={() => navigator.clipboard.writeText(fullOutput)}
                    className="text-[10px] text-white/25 hover:text-white/60 transition-colors px-2 py-0.5 rounded border border-white/8 hover:border-white/15"
                  >
                    copy
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable output body */}
            <div
              ref={outputRef}
              className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1.5"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {outputLines.length === 0 && !isRunning ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="w-12 h-12 rounded-xl bg-white/3 border border-white/8 flex items-center justify-center text-2xl">
                    📡
                  </div>
                  <p className="text-xs text-white/20 text-center">
                    Output will stream here<br />when you ignite the engine.
                  </p>
                </div>
              ) : isRunning && outputLines.length === 0 ? (
                <div className="flex items-center gap-2 py-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-white/30 text-xs">Priming engine…</span>
                </div>
              ) : (
                <>
                  {/* Tool call / result cards */}
                  {toolEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className={`mb-2 rounded-xl border text-xs overflow-hidden ${ev.type === "call"
                        ? "border-blue-500/30 bg-blue-500/5"
                        : "border-green-500/30 bg-green-500/5"
                        }`}
                    >
                      <div className={`flex items-center gap-2 px-3 py-1.5 border-b ${ev.type === "call" ? "border-blue-500/20 text-blue-400" : "border-green-500/20 text-green-400"}`}>
                        <span>{ev.type === "call" ? "🔧" : "✅"}</span>
                        <span className="font-mono font-medium">{ev.name}</span>
                        <span className="ml-auto text-[10px] opacity-60">{ev.type === "call" ? "calling…" : "done"}</span>
                      </div>
                      <details className="cursor-pointer">
                        <summary className="px-3 py-1 text-[10px] text-white/30 select-none">
                          {ev.type === "call" ? "View args" : "View result"}
                        </summary>
                        <pre className="px-3 pb-2 text-[10px] text-white/50 whitespace-pre-wrap break-all overflow-auto max-h-48">
                          {JSON.stringify(ev.payload, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                  {outputLines.map((line, i) => (
                    <div key={i} className="leading-relaxed flex gap-2">
                      {line.type === "step" && (
                        <>
                          <span className="font-bold shrink-0" style={{ color: "#f97316" }}>
                            STEP {line.stepNum}:
                          </span>
                          <span className="text-white/70">{line.content}</span>
                        </>
                      )}
                      {line.type === "result" && (
                        <>
                          <span className="font-bold shrink-0" style={{ color: "#22c55e" }}>
                            RESULT:
                          </span>
                          <span className="text-emerald-100/80">{line.content}</span>
                        </>
                      )}
                      {line.type === "error" && (
                        <>
                          <span className="font-bold shrink-0" style={{ color: "#ef4444" }}>
                            ERROR:
                          </span>
                          <span className="text-red-300/80">{line.content}</span>
                        </>
                      )}
                      {line.type === "text" && (
                        <span className="text-white/50">{line.content}</span>
                      )}
                    </div>
                  ))}
                </>
              )}
              {runError && (
                <div className="flex flex-col gap-2 mt-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 font-bold text-xs shrink-0">ERR</span>
                    <span className="text-red-300/80 text-xs">{runError}</span>
                  </div>
                  {(runError.toLowerCase().includes("api key") || runError.toLowerCase().includes("archived") || runError.toLowerCase().includes("no api key") || runError.toLowerCase().includes("unauthorized") || runError.toLowerCase().includes("invalid_api_key")) && (
                    <a
                      href="/dashboard/settings/ai-keys"
                      className="self-start text-[10px] px-2.5 py-1 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-all"
                    >
                      🔑 Update API Key →
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* MODS / NITRO */}
          <div
            className="rounded-2xl border shrink-0"
            style={{ background: "linear-gradient(145deg, #0e0b22 0%, #0b0918 100%)", borderColor: "rgba(120,50,255,0.28)", boxShadow: "0 0 20px rgba(100,30,255,0.06)" }}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#f97316", boxShadow: "0 0 5px #f97316" }} />
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#fbbf24", boxShadow: "0 0 5px #fbbf24" }} />
              </div>
              <span className="text-xs font-bold text-white/60 uppercase tracking-[0.2em]">Mods / Nitro</span>
              <span className="ml-auto text-[10px] text-white/25">
                {activeMods.length}/{connectedIntegrations.length} active
              </span>
            </div>

            <div className="p-3 space-y-1.5 max-h-52 overflow-y-auto scrollbar-hide">
              {connectedIntegrations.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <p className="text-xs text-white/20 text-center">No integrations connected.</p>
                  <a
                    href="/dashboard/integrations"
                    className="text-xs text-indigo-400/70 hover:text-indigo-400 transition-colors"
                  >
                    Connect integrations →
                  </a>
                </div>
              ) : (
                connectedIntegrations.map((conn) => {
                  const config = INTEGRATIONS.find((i) => i.service === conn.service);
                  const isActive = activeMods.includes(conn.service);
                  return (
                    <div
                      key={conn.service}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl border transition-all"
                      style={{
                        background: isActive ? `${config?.color ?? "#6366f1"}0d` : "rgba(255,255,255,0.02)",
                        borderColor: isActive ? `${config?.color ?? "#6366f1"}33` : "rgba(255,255,255,0.06)",
                      }}
                    >
                      {/* Icon */}
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          background: `${config?.color ?? "#6366f1"}22`,
                          border: `1.5px solid ${config?.color ?? "#6366f1"}44`,
                          color: config?.color ?? "#6366f1",
                        }}
                      >
                        {(config?.name ?? conn.service).slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs text-white/60 flex-1 truncate">
                        {config?.name ?? conn.service}
                      </span>
                      {/* Toggle + label */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider"
                          style={{ color: isActive ? (config?.color ?? "#a855f7") : "rgba(255,255,255,0.2)" }}
                        >
                          {isActive ? "ON" : "OFF"}
                        </span>
                        <button
                          onClick={() => toggleMod(conn.service)}
                          className="shrink-0 relative w-9 h-5 rounded-full transition-all duration-300"
                          style={{
                            background: isActive ? (config?.color ?? "#a855f7") : "rgba(255,255,255,0.08)",
                            boxShadow: isActive ? `0 0 10px ${config?.color ?? "#a855f7"}66` : "none",
                          }}
                        >
                          <div
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-300"
                            style={{ left: isActive ? "calc(100% - 18px)" : "2px" }}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {connectedIntegrations.length > 0 && (
              <div className="px-3 pb-3">
                <a
                  href="/dashboard/integrations"
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-white/8 text-[10px] text-white/25 hover:text-white/50 hover:border-white/15 transition-all"
                >
                  + Add more mods
                </a>
              </div>
            )}
          </div>

          {/* PUBLISH TARGETS */}
          <div
            className="rounded-2xl border shrink-0"
            style={{ background: "linear-gradient(145deg, #0f0d1e 0%, #0b0918 100%)", borderColor: "rgba(99,102,241,0.25)" }}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <span className="text-xs font-bold text-white/60 uppercase tracking-[0.2em]">🚀 Publish</span>
              <span className="ml-auto text-[10px] text-white/25">{publishPlatforms.length} selected</span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-1.5">
              {[
                { id: "youtube", label: "YouTube", emoji: "📺", color: "#FF0000", desc: "Upload video / metadata" },
                { id: "linkedin", label: "LinkedIn", emoji: "💼", color: "#0A66C2", desc: "Post text + image" },
                { id: "telegram", label: "Telegram", emoji: "✈️", color: "#2CA5E0", desc: "Send result" },
                { id: "whatsapp", label: "WhatsApp", emoji: "💬", color: "#25D366", desc: "Send audio/text" },
                { id: "twitter", label: "Twitter/X", emoji: "🐦", color: "#1DA1F2", desc: "Post thread" },
                { id: "instagram", label: "Instagram", emoji: "📸", color: "#E1306C", desc: "Post image" },
              ].map((p) => {
                const isActive = publishPlatforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => setPublishPlatforms((arr) => isActive ? arr.filter((x) => x !== p.id) : [...arr, p.id])}
                    className="flex items-center gap-2 p-2 rounded-xl border text-left transition-all"
                    style={{
                      background: isActive ? `${p.color}12` : "rgba(255,255,255,0.02)",
                      borderColor: isActive ? `${p.color}50` : "rgba(255,255,255,0.06)",
                    }}
                  >
                    <span className="text-sm">{p.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold" style={{ color: isActive ? p.color : "rgba(255,255,255,0.45)" }}>{p.label}</p>
                      <p className="text-[8px] text-white/20 truncate">{p.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {publishPlatforms.length > 0 && (
              <div className="px-3 pb-3">
                <p className="text-[9px] text-white/20 text-center">
                  Selected platforms will auto-receive result via connected integrations
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════ FULL-WIDTH RESULT PANEL ════ */}
      {(isRunning || isDone || chunks.length > 0 || generatedImage || generatedAudio) && (
        <div className="mx-4 mb-4 rounded-2xl border overflow-hidden transition-all duration-500"
          style={{
            background: "#09091a",
            borderColor: isDone
              ? !runError ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"
              : "rgba(249,115,22,0.2)",
            boxShadow: isDone
              ? !runError ? "0 0 30px rgba(34,197,94,0.06)" : "0 0 30px rgba(239,68,68,0.06)"
              : "0 0 30px rgba(249,115,22,0.06)",
          }}
        >
          {/* Panel header */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5">
            <div
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                  <span className="text-sm font-semibold text-orange-300">Engine Running…</span>
                </>
              ) : !runError ? (
                <>
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                    <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-emerald-300">Run Complete</span>
                </>
              ) : (
                <>
                  <div className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                    <span className="text-red-400 text-xs font-bold">✗</span>
                  </div>
                  <span className="text-sm font-semibold text-red-300">Run Failed</span>
                </>
              )}
            </div>

            {/* Prompt recap */}
            <div className="flex-1 min-w-0 mx-4">
              <p className="text-xs text-white/30 truncate">
                <span className="text-white/20 mr-1">prompt:</span>
                {prompt}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {isDone && fullOutput && (
                <button
                  onClick={() => navigator.clipboard.writeText(fullOutput)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </button>
              )}
              {isDone && !runError && !savedToMemory && fullOutput && (
                <button
                  onClick={() => setSaveModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-xs text-indigo-300 hover:bg-indigo-500/20 transition-all"
                >
                  🧠 Save
                </button>
              )}
              {savedToMemory && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <span>✓</span> Saved
                </span>
              )}
              {isDone && (
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
                >
                  + New Run
                </button>
              )}
            </div>
          </div>

          {/* Panel body — step timeline + output */}
          <div className="flex gap-0 min-h-50">

            {/* LEFT: Step timeline */}
            <div className="w-56 shrink-0 border-r border-white/5 p-4 space-y-1">
              <p className="text-[9px] font-semibold text-white/20 uppercase tracking-widest mb-3">Execution Steps</p>
              {outputLines.filter((l) => l.type === "step").length === 0 && isRunning && (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-5 rounded bg-white/3 animate-pulse" style={{ width: `${70 + i * 8}%` }} />
                  ))}
                </div>
              )}
              {outputLines.filter((l) => l.type === "step").map((line, i) => {
                const isLast = i === outputLines.filter((l) => l.type === "step").length - 1;
                const stillRunning = isLast && isRunning;
                return (
                  <div key={i} className="flex items-start gap-2 group">
                    {/* Step dot */}
                    <div className="flex flex-col items-center mt-0.5 shrink-0">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                        style={{
                          background: stillRunning ? "rgba(249,115,22,0.2)" : "rgba(34,197,94,0.15)",
                          border: `1.5px solid ${stillRunning ? "#f97316" : "#22c55e"}`,
                          color: stillRunning ? "#f97316" : "#22c55e",
                        }}
                      >
                        {stillRunning ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                        ) : (
                          <svg className="w-2 h-2" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      {/* Connector */}
                      {i < outputLines.filter((l) => l.type === "step").length - 1 && (
                        <div className="w-px h-3 bg-white/10 mt-0.5" />
                      )}
                    </div>
                    <p className="text-[10px] text-white/45 leading-tight pt-0.5 line-clamp-2">
                      {line.content}
                    </p>
                  </div>
                );
              })}
              {isDone && outputLines.filter((l) => l.type === "step").length > 0 && (
                <div className="pt-2 border-t border-white/5 mt-2">
                  <p className="text-[9px] text-white/20">
                    {outputLines.filter((l) => l.type === "step").length} steps · {Math.floor(fullOutput.length / 5)} words
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT: Main output */}
            <div className="flex-1 p-5 overflow-y-auto max-h-125 scrollbar-hide space-y-4">

              {/* ─── IMAGE RESULT ─── */}
              {generatedImage && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    <span className="text-xs font-semibold text-purple-400 uppercase tracking-widest">Generated Image</span>
                    <button
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = `data:image/png;base64,${generatedImage}`;
                        a.download = `autoflow-${Date.now()}.png`;
                        a.click();
                      }}
                      className="ml-auto text-xs px-2.5 py-1 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
                    >
                      ↓ Download
                    </button>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${generatedImage}`}
                    alt="Generated by AutoFlow"
                    className="w-full max-w-lg rounded-xl border border-white/10"
                    style={{ boxShadow: "0 0 40px rgba(168,85,247,0.15)" }}
                  />
                </div>
              )}

              {/* ─── AUDIO RESULT ─── */}
              {generatedAudio && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">Generated Audio</span>
                    <button
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = `data:audio/mpeg;base64,${generatedAudio}`;
                        a.download = `autoflow-tts-${Date.now()}.mp3`;
                        a.click();
                      }}
                      className="ml-auto text-xs px-2.5 py-1 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
                    >
                      ↓ Download MP3
                    </button>
                  </div>
                  <div
                    className="rounded-xl border border-white/10 p-4"
                    style={{ background: "rgba(34,211,238,0.04)" }}
                  >
                    <audio
                      controls
                      src={`data:audio/mpeg;base64,${generatedAudio}`}
                      className="w-full"
                      style={{ filter: "invert(1) hue-rotate(180deg)" }}
                    />
                    <p className="text-xs text-white/30 mt-2 italic">&quot;{prompt.slice(0, 120)}{prompt.length > 120 ? "…" : ""}&quot;</p>
                  </div>
                </div>
              )}

              {/* Streaming raw text (non-step, non-result lines) */}
              {outputLines.filter((l) => l.type === "text").length > 0 && (
                <div className="font-mono text-sm text-white/40 space-y-1 leading-relaxed">
                  {outputLines.filter((l) => l.type === "text").map((line, i) => (
                    <p key={i}>{line.content}</p>
                  ))}
                </div>
              )}

              {/* RESULT block — the main output */}
              {outputLines.filter((l) => l.type === "result").map((line, i) => (
                <div
                  key={i}
                  className="rounded-xl border p-4 space-y-2"
                  style={{
                    background: "rgba(34,197,94,0.05)",
                    borderColor: "rgba(34,197,94,0.2)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Result</span>
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{line.content}</p>
                </div>
              ))}

              {/* Full raw output as a fallback when RESULT not parsed yet but running */}
              {isRunning && outputLines.filter((l) => l.type === "result").length === 0 && (
                <div className="font-mono text-xs text-white/30 leading-relaxed whitespace-pre-wrap">
                  {fullOutput.split("\n").filter((l) => !l.startsWith("STEP:")).join("\n")}
                </div>
              )}

              {/* Show full raw output (collapsible) when done and has content */}
              {isDone && fullOutput && (
                <details className="group">
                  <summary className="text-[10px] text-white/20 cursor-pointer hover:text-white/40 transition-colors list-none flex items-center gap-1.5 select-none">
                    <svg className="w-3 h-3 group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    View raw output
                  </summary>
                  <pre className="mt-3 p-3 rounded-xl bg-white/2 border border-white/5 text-[10px] text-white/30 font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">
                    {fullOutput}
                  </pre>
                </details>
              )}

              {/* Error state */}
              {runError && (
                <div className="rounded-xl border border-red-500/25 bg-red-500/8 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-xs font-semibold text-red-400 uppercase tracking-widest">Error</span>
                  </div>
                  <p className="text-sm text-red-300/80">{runError}</p>
                  {(runError.toLowerCase().includes("api key") || runError.toLowerCase().includes("archived") || runError.toLowerCase().includes("no api key") || runError.toLowerCase().includes("unauthorized") || runError.toLowerCase().includes("invalid_api_key")) && (
                    <a
                      href="/dashboard/settings/ai-keys"
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-all"
                    >
                      🔑 Update API Key in Settings →
                    </a>
                  )}
                </div>
              )}

              {/* Still streaming hint */}
              {isRunning && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1 h-1 rounded-full bg-orange-400/60 animate-bounce"
                        style={{ animationDelay: `${i * 0.12}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-white/20">streaming…</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
