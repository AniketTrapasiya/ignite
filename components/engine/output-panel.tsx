"use client";

import { useRef, useEffect, useState } from "react";

interface OutputPanelProps {
  chunks: string[];
  isDone: boolean;
  error?: string | null;
  onSaveToMemory?: () => void;
}

export default function OutputPanel({ chunks, isDone, error, onSaveToMemory }: OutputPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const full = chunks.join("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chunks]);

  if (chunks.length === 0 && !error) return null;

  const lines = full.split("\n");

  function copyOutput() {
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="w-full rounded-xl border border-white/10 bg-[#0a0a14] overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/2">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-xs text-white/30 font-mono ml-2">engine.output</span>
        {isDone && !error && (
          <span className="ml-auto text-xs text-emerald-400 font-mono">● completed</span>
        )}
        {error && (
          <span className="ml-auto text-xs text-red-400 font-mono">● error</span>
        )}
        {!isDone && !error && (
          <span className="ml-auto text-xs text-orange-400 font-mono animate-pulse">● running</span>
        )}
      </div>

      {/* Output content */}
      <div className="p-4 font-mono text-sm leading-relaxed max-h-96 overflow-y-auto">
        {error ? (
          <p className="text-red-400">ERROR: {error}</p>
        ) : (
          lines.map((line, i) => {
            if (line.startsWith("STEP:")) {
              return (
                <p key={i} className="text-indigo-300">
                  <span className="text-indigo-500 mr-1">▶</span>
                  {line.replace("STEP:", "").trim()}
                </p>
              );
            }
            if (line.startsWith("RESULT:")) {
              return (
                <p key={i} className="text-emerald-400 font-semibold mt-2">
                  <span className="mr-1">✓</span>
                  {line.replace("RESULT:", "").trim()}
                </p>
              );
            }
            if (line.startsWith("ERROR:")) {
              return (
                <p key={i} className="text-red-400">
                  <span className="mr-1">✗</span>
                  {line.replace("ERROR:", "").trim()}
                </p>
              );
            }
            if (line === "") return <br key={i} />;
            return (
              <p key={i} className="text-white/70">
                {line}
              </p>
            );
          })
        )}
        {!isDone && !error && (
          <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-0.5 align-text-bottom" />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Action bar when done */}
      {isDone && !error && (
        <div className="flex gap-2 px-4 pb-4 border-t border-white/5 pt-3">
          <button
            onClick={copyOutput}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors border border-white/10"
          >
            {copied ? (
              <><span className="text-emerald-400">✓</span> Copied</>
            ) : (
              <>📋 Copy output</>
            )}
          </button>
          {onSaveToMemory && (
            <button
              onClick={onSaveToMemory}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 hover:text-indigo-200 transition-colors border border-indigo-500/20"
            >
              🧠 Save to Memory
            </button>
          )}
        </div>
      )}
    </div>
  );
}
