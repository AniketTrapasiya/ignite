"use client";

import { useState } from "react";

interface SaveMemoryModalProps {
  isOpen: boolean;
  output: string;
  prompt: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function SaveMemoryModal({
  isOpen,
  output,
  prompt,
  onClose,
  onSaved,
}: SaveMemoryModalProps) {
  const [title, setTitle] = useState(() =>
    prompt.length > 50 ? prompt.slice(0, 50).trim() + "..." : prompt.trim()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function save() {
    if (!title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError("");

    const res = await fetch("/api/engine/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        content: output,
        tags: ["engine-output"],
      }),
    });

    if (res.ok) {
      onSaved();
      onClose();
    } else {
      setError("Failed to save. Try again.");
    }
    setSaving(false);
  }

  // Show preview of output (first 300 chars)
  const preview = output.length > 300 ? output.slice(0, 300) + "..." : output;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f1a] p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧠</span>
            <h2 className="font-semibold text-white">Save to Memory</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">×</button>
        </div>

        <p className="text-xs text-white/30">
          This output will be stored as a memory and automatically retrieved in future runs.
        </p>

        {/* Output preview */}
        <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3">
          <p className="text-xs text-white/20 uppercase tracking-widest mb-1.5">Output preview</p>
          <p className="text-xs text-white/50 font-mono leading-relaxed whitespace-pre-wrap line-clamp-5">
            {preview}
          </p>
        </div>

        {/* Title input */}
        <div className="space-y-1.5">
          <label className="text-xs text-white/40">Memory name</label>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(""); }}
            placeholder="Give this memory a name..."
            maxLength={100}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50"
            autoFocus
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm font-medium text-white transition-colors"
          >
            {saving ? "Saving..." : "Save to Memory"}
          </button>
        </div>
      </div>
    </div>
  );
}
