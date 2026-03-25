"use client";

import { useEffect, useState } from 'react';

/**
 * Month 6 - Week 22: AG-UI Command Center
 * A futuristic command center UI for an AI Agent.
 * Dark mode with neon cyan and soft violet accents. 8k Unreal Engine 5 aesthetic.
 */
export default function AgentDashboard() {
  const [vitals, setVitals] = useState<any>(null);

  useEffect(() => {
    // Fetch live agent internal state
    const fetchVitals = async () => {
      try {
        const res = await fetch('/api/agent/vitals');
        const data = await res.json();
        setVitals(data);
      } catch (err) {
        console.error("Failed to fetch agent vitals:", err);
      }
    };
    fetchVitals();
    // Poll every 10 seconds to simulate real-time updates
    const interval = setInterval(fetchVitals, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!vitals) return <div className="min-h-screen bg-[#06080F] flex items-center justify-center text-cyan-400">Initializing Digital Twin Core...</div>;

  return (
    <div className="min-h-screen bg-[#06080F] text-white p-8 font-mono select-none">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Title */}
        <header className="border-b border-cyan-500/30 pb-4">
          <h1 className="text-4xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-500 uppercase flex items-center gap-4">
            <span className="w-4 h-4 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_15px_rgba(34,211,238,0.8)]"></span>
            Life-Agent Command Center
          </h1>
          <p className="text-violet-300/60 mt-2 text-sm">AUTONOMOUS AGENTIC OS // 24-7 CHRON-LOOP ACTIVE</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main Avatar / Holograph Simulator */}
          <div className="md:col-span-1 rounded-2xl bg-black/40 border border-violet-500/20 backdrop-blur-md p-6 flex flex-col items-center justify-center relative overflow-hidden shadow-[inset_0_0_30px_rgba(139,92,246,0.1)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
            <div className="w-32 h-32 rounded-full border border-cyan-400/50 flex items-center justify-center relative shadow-[0_0_40px_rgba(34,211,238,0.2)]">
              {/* Simulated Hologram Ring */}
              <div className="absolute w-full h-full rounded-full border-t-2 border-r-2 border-violet-500 animate-[spin_4s_linear_infinite]"></div>
              <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-cyan-600/20 to-violet-600/20 flex items-center justify-center backdrop-blur-xl">
                 <span className="text-3xl">🤖</span>
              </div>
            </div>
            <h2 className="mt-6 text-xl font-bold text-cyan-50">{vitals.name}</h2>
            <p className="text-cyan-400/80 text-sm">{vitals.status}</p>
          </div>

          {/* Vitals Telemetry */}
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            
            <VitalCard title="Simulated Age" value={`${vitals.currentAge} Years`} color="from-cyan-400 to-cyan-600" />
            <VitalCard title="Energy Level" value={`${vitals.energyLevel}%`} color="from-green-400 to-emerald-600" />
            
            <VitalCard title="Lives Impacted" value={vitals.livesImpacted} subtitle="Positivity Empathy Engine" color="from-violet-400 to-purple-600" />
            <VitalCard title="Social Visibility" value={vitals.socialVisibility} subtitle="Trending Trajectory" color="from-rose-400 to-pink-600" />
            
            {/* Live Action Log */}
            <div className="col-span-2 rounded-xl bg-black/40 border border-cyan-900/40 p-5 mt-2 shadow-lg">
              <h3 className="text-xs text-cyan-500 uppercase tracking-widest mb-3">Latest Autonomous Action</h3>
              <p className="text-gray-300 font-sans tracking-wide border-l-2 border-cyan-400 pl-3">
                {vitals.lastAction}
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function VitalCard({ title, value, subtitle, color }: { title: string, value: string | number, subtitle?: string, color: string }) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-5 backdrop-blur-lg hover:border-cyan-500/30 transition-colors duration-300">
      <h3 className="text-gray-400 text-xs uppercase tracking-widest mb-1">{title}</h3>
      <div className={`text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${color}`}>
        {value}
      </div>
      {subtitle && <p className="text-gray-500 text-xs mt-2">{subtitle}</p>}
    </div>
  );
}
