"use client";

import { useEffect, useState } from "react";
import { INTEGRATIONS } from "@/lib/integrations-config";
import Link from "next/link";

interface ModsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMods: string[];
  onToggle: (service: string) => void;
}

export default function ModsPanel({ isOpen, onClose, selectedMods, onToggle }: ModsPanelProps) {
  const [connected, setConnected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) loadIntegrations();
  }, [isOpen]);

  async function loadIntegrations() {
    setLoading(true);
    const res = await fetch("/api/integrations");
    if (res.ok) {
      const data = await res.json();
      setConnected(data.integrations.map((i: { service: string }) => i.service));
    }
    setLoading(false);
  }

  const connectedIntegrations = INTEGRATIONS.filter((i) => connected.includes(i.service));
  const availableIntegrations = INTEGRATIONS.filter((i) => !connected.includes(i.service));

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-80 bg-[#0f0f1a] border-l border-white/10 z-50 flex flex-col transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"
          }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚙️</span>
            <h2 className="font-semibold text-white">Engine Mods</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <p className="text-white/30 text-sm">Loading mods...</p>
          ) : (
            <>
              {connectedIntegrations.length > 0 && (
                <div>
                  <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Active Mods</p>
                  <div className="space-y-2">
                    {connectedIntegrations.map((integration) => (
                      <div
                        key={integration.service}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedMods.includes(integration.service)
                          ? "border-orange-500/50 bg-orange-500/10"
                          : "border-white/10 bg-white/3 hover:border-white/20"
                          }`}
                        onClick={() => onToggle(integration.service)}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: integration.color + "33", border: `1px solid ${integration.color}44` }}
                        >
                          {integration.name.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{integration.name}</p>
                          <p className="text-xs text-white/40 truncate">{integration.capabilities[0]}</p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${selectedMods.includes(integration.service)
                            ? "bg-orange-500 border-orange-500"
                            : "border-white/20"
                            }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {availableIntegrations.length > 0 && (
                <div>
                  <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Available — Not Connected</p>
                  <div className="space-y-1.5">
                    {availableIntegrations.map((integration) => (
                      <div
                        key={integration.service}
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-white/5 opacity-40"
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: integration.color + "22" }}
                        >
                          {integration.name.slice(0, 2)}
                        </div>
                        <p className="text-sm text-white/50">{integration.name}</p>
                      </div>
                    ))}
                  </div>

                  <Link
                    href="/dashboard/integrations"
                    className="flex items-center justify-center gap-2 mt-3 py-2 rounded-xl border border-dashed border-white/10 text-xs text-white/30 hover:text-white/60 hover:border-white/20 transition-colors"
                    onClick={onClose}
                  >
                    + Connect more mods
                  </Link>
                </div>
              )}

              {connectedIntegrations.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-4xl mb-2">🔌</p>
                  <p className="text-white/30 text-sm mb-3">No mods installed yet.</p>
                  <Link
                    href="/dashboard/integrations"
                    onClick={onClose}
                    className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                  >
                    Install mods
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
