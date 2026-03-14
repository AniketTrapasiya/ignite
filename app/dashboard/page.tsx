import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getCurrentUser();

  const user = await prisma.user.findUnique({
    where: { id: session!.userId },
    select: { name: true },
  });

  const [runCount, memoryCount, integrationCount] = await Promise.all([
    prisma.engineRun.count({ where: { userId: session!.userId } }),
    prisma.engineMemory.count({ where: { userId: session!.userId } }),
    prisma.integration.count({ where: { userId: session!.userId } }),
  ]);

  const recentRuns = await prisma.engineRun.findMany({
    where: { userId: session!.userId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, prompt: true, status: true, createdAt: true },
  });

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Welcome */}
      <div className="pt-2">
        <h2 className="text-2xl font-bold text-white">
          Hey, {firstName} 👋
        </h2>
        <p className="text-white/40 text-sm mt-1">
          Your AI automation engine is ready.
        </p>
      </div>

      {/* Engine CTA */}
      <Link
        href="/dashboard/engine"
        className="block rounded-2xl overflow-hidden group relative"
      >
        <div
          className="px-8 py-7 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #f97316 100%)" }}
        >
          <div className="relative z-10">
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
              AI Engine Room
            </p>
            <h3 className="text-2xl font-bold text-white mb-2">
              Ignite the Engine
            </h3>
            <p className="text-white/60 text-sm max-w-xs">
              Describe any task. Load memories. Select mods. Fire.
            </p>
          </div>
          <div className="hidden md:flex flex-col items-center gap-2 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-4xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              ⚡
            </div>
            <span className="text-white/40 text-xs">Click to launch</span>
          </div>
          {/* Glow overlay */}
          <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-all duration-300" />
        </div>
      </Link>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Engine Runs", value: runCount, icon: "⚡", color: "#6366f1" },
          { label: "Memories", value: memoryCount, icon: "🧠", color: "#a855f7" },
          { label: "Integrations", value: integrationCount, icon: "🔌", color: "#f97316" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 hover:bg-white/[0.05] transition-colors"
          >
            <p className="text-2xl mb-2">{stat.icon}</p>
            <p className="text-3xl font-bold text-white">{stat.value}</p>
            <p className="text-sm text-white/40 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          href="/dashboard/integrations"
          className="flex items-center gap-4 p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
            🔌
          </div>
          <div>
            <p className="font-medium text-white text-sm">Connect Integrations</p>
            <p className="text-xs text-white/35 mt-0.5">Add YouTube, Slack, Stripe, GitHub and more as engine mods</p>
          </div>
          <svg className="w-4 h-4 text-white/20 ml-auto flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
        <Link
          href="/dashboard/workflows"
          className="flex items-center gap-4 p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
            🔄
          </div>
          <div>
            <p className="font-medium text-white text-sm">Saved Workflows</p>
            <p className="text-xs text-white/35 mt-0.5">View and manage your automation workflows and run history</p>
          </div>
          <svg className="w-4 h-4 text-white/20 ml-auto flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>

      {/* Recent runs */}
      {recentRuns.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest">
              Recent Runs
            </h3>
            <Link href="/dashboard/workflows" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    run.status === "COMPLETED" ? "bg-emerald-400" :
                    run.status === "FAILED" ? "bg-red-400" :
                    run.status === "RUNNING" ? "bg-orange-400 animate-pulse" :
                    "bg-white/20"
                  }`}
                />
                <p className="text-sm text-white/60 flex-1 truncate">{run.prompt}</p>
                <span className="text-xs text-white/25 flex-shrink-0">
                  {new Date(run.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state for new users */}
      {runCount === 0 && (
        <div className="text-center py-12 rounded-2xl border border-dashed border-white/[0.08]">
          <p className="text-4xl mb-3">🚀</p>
          <p className="text-white/50 text-sm font-medium">No runs yet</p>
          <p className="text-white/25 text-xs mt-1">Fire up the engine to get started</p>
          <Link
            href="/dashboard/engine"
            className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
            style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
          >
            Open Engine Room
          </Link>
        </div>
      )}
    </div>
  );
}
