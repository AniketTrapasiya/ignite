"use client";

import { useState, useEffect } from "react";
import type { MemoryItem } from "@/lib/memory";

interface MemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export default function MemoryPanel({ isOpen, onClose, selectedIds, onToggle }: MemoryPanelProps) {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isOpen) loadMemories();
  }, [isOpen]);

  async function loadMemories() {
    setLoading(true);
    const res = await fetch("/api/engine/memory");
    if (res.ok) {
      const data = await res.json();
      setMemories(data.memories);
    }
    setLoading(false);
  }

  async function addMemory() {
    if (!title.trim() || !content.trim()) return;
    setAdding(true);
    await fetch("/api/engine/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), content: content.trim() }),
    });
    setTitle("");
    setContent("");
    await loadMemories();
    setAdding(false);
  }

  async function deleteMemory(id: string) {
    await fetch(`/api/engine/memory/${id}`, { method: "DELETE" });
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-[#0f0f1a] border-r border-white/10 z-50 flex flex-col transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧠</span>
            <h2 className="font-semibold text-white">Memory Tank</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-white/30 text-sm">Loading memories...</p>
          ) : memories.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-2">🫙</p>
              <p className="text-white/30 text-sm">No memories yet.<br />Add one below.</p>
            </div>
          ) : (
            memories.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl p-3 border transition-all cursor-pointer group ${selectedIds.includes(m.id)
                    ? "bg-indigo-500/20 border-indigo-500/50"
                    : "bg-white/[0.03] border-white/10 hover:border-white/20"
                  }`}
                onClick={() => onToggle(m.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{m.title}</p>
                    <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{m.content}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {selectedIds.includes(m.id) && (
                      <span className="text-indigo-400 text-xs">✓</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMemory(m.id); }}
                      className="text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add memory form */}
        <div className="p-4 border-t border-white/10 space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Memory title..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What should the engine remember?"
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 resize-none"
          />
          <button
            onClick={addMemory}
            disabled={adding || !title.trim() || !content.trim()}
            className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm font-medium text-white transition-colors"
          >
            {adding ? "Saving..." : "Save Memory"}
          </button>
        </div>
      </div>
    </>
  );
}
