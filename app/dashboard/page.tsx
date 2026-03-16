import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getCurrentUser();

  const user = await prisma.user.findUnique({
    where: { id: session!.userId },
    select: { name: true },
  });

  const [runCount, memoryCount, integrationCount, agentCount, activeAgentCount] = await Promise.all([
    prisma.engineRun.count({ where: { userId: session!.userId } }),
    prisma.engineMemory.count({ where: { userId: session!.userId } }),
    prisma.integration.count({ where: { userId: session!.userId } }),
    prisma.agent.count({ where: { userId: session!.userId } }),
    prisma.agent.count({ where: { userId: session!.userId, status: "ACTIVE" } }),
  ]);

  // Skills stats
  const skillGoals = await prisma.skillGoal.findMany({
    where: { userId: session!.userId },
    select: {
      id: true,
      title: true,
      totalXp: true,
      streakDays: true,
      currentDay: true,
      totalDays: true,
      status: true,
      lastActiveAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 3,
  });
  const totalXp = skillGoals.reduce((a, g) => a + g.totalXp, 0);
  const activeSkills = skillGoals.filter((g) => g.status === "active").length;
  const topStreak = skillGoals.reduce((a, g) => Math.max(a, g.streakDays), 0);

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
          Your AI automation platform is ready.
        </p>
      </div>

      {/* Hero CTAs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Engine CTA */}
        <Link href="/dashboard/engine" className="block rounded-2xl overflow-hidden group relative">
          <div
            className="px-6 py-6 flex items-center justify-between h-full"
            style={{ background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)" }}
          >
            <div className="relative z-10">
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">AI Engine</p>
              <h3 className="text-xl font-bold text-white mb-1">Ignite Engine</h3>
              <p className="text-white/60 text-xs">One-shot AI tasks</p>
            </div>
            <div className="text-4xl group-hover:scale-110 transition-transform duration-300">⚡</div>
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-all duration-300" />
          </div>
        </Link>

        {/* Agents CTA */}
        <Link href="/dashboard/agents" className="block rounded-2xl overflow-hidden group relative">
          <div
            className="px-6 py-6 flex items-center justify-between h-full"
            style={{ background: "linear-gradient(135deg, #0f172a, #1e1040)" }}
          >
            <div
              className="absolute inset-0 rounded-2xl"
              style={{ border: "1px solid rgba(168,85,247,0.3)", boxShadow: "inset 0 0 40px rgba(168,85,247,0.05)" }}
            />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Agents</p>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(168,85,247,0.2)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.3)" }}
                >NEW</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Auto Agents</h3>
              <p className="text-white/50 text-xs">Event-driven 24/7 AI</p>
              {activeAgentCount > 0 && (
                <p className="text-emerald-400 text-xs mt-1 font-medium">
                  {activeAgentCount} active
                </p>
              )}
            </div>
            <div className="text-4xl group-hover:scale-110 transition-transform duration-300 relative z-10">🤖</div>
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/3 transition-all duration-300 rounded-2xl" />
          </div>
        </Link>

        {/* Skills CTA */}
        <Link href="/dashboard/skills" className="block rounded-2xl overflow-hidden group relative">
          <div
            className="px-6 py-6 flex items-center justify-between h-full"
            style={{ background: "linear-gradient(135deg, #0a1628, #0e1a20)" }}
          >
            <div
              className="absolute inset-0 rounded-2xl"
              style={{ border: "1px solid rgba(16,185,129,0.25)", boxShadow: "inset 0 0 40px rgba(16,185,129,0.04)" }}
            />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Skills</p>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }}
                >NEW</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Skill Up</h3>
              <p className="text-white/50 text-xs">AI-coached daily practice</p>
              {totalXp > 0 && (
                <p className="text-amber-400 text-xs mt-1 font-medium">
                  ✦ {totalXp.toLocaleString()} XP earned
                </p>
              )}
            </div>
            <div className="text-4xl group-hover:scale-110 transition-transform duration-300 relative z-10">🎓</div>
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/3 transition-all duration-300 rounded-2xl" />
          </div>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Engine Runs", value: runCount, icon: "⚡", color: "#6366f1", href: "/dashboard/engine" },
          { label: "AI Agents", value: agentCount, icon: "🤖", color: "#a855f7", href: "/dashboard/agents" },
          { label: "Memories", value: memoryCount, icon: "🧠", color: "#ec4899", href: "/dashboard/engine" },
          { label: "Integrations", value: integrationCount, icon: "🔌", color: "#f97316", href: "/dashboard/integrations" },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-2xl border border-white/8 bg-white/3 p-5 hover:bg-white/5 transition-colors"
          >
            <p className="text-2xl mb-2">{stat.icon}</p>
            <p className="text-3xl font-bold text-white">{stat.value}</p>
            <p className="text-sm text-white/40 mt-0.5">{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Skills spotlight */}
      {skillGoals.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest">
              Active Skills
            </h3>
            <div className="flex items-center gap-4">
              {topStreak > 0 && (
                <span className="text-xs text-orange-400 font-semibold">🔥 {topStreak}d streak</span>
              )}
              <span className="text-xs text-amber-400 font-semibold">✦ {totalXp.toLocaleString()} XP</span>
              <Link href="/dashboard/skills" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                View all
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {skillGoals.map((g) => {
              const pct = Math.round(((g.currentDay - 1) / g.totalDays) * 100);
              return (
                <Link
                  key={g.id}
                  href={`/dashboard/skills/${g.id}`}
                  className="flex flex-col gap-2 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white truncate">{g.title}</span>
                    {g.streakDays > 0 && (
                      <span className="text-xs text-orange-400 shrink-0">ðŸ”¥{g.streakDays}</span>
                    )}
                  </div>
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: "linear-gradient(90deg, #10b981, #34d399)" }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-white/30">
                    <span>Day {g.currentDay}/{g.totalDays}</span>
                    <span className="text-amber-500">✦ {g.totalXp} XP</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          href="/dashboard/agents/new"
          className="flex items-center gap-4 p-4 rounded-2xl border border-purple-500/20 bg-purple-500/3 hover:bg-purple-500/7 hover:border-purple-500/30 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
            🤖
          </div>
          <div>
            <p className="font-medium text-white text-sm">Create an Agent</p>
            <p className="text-xs text-white/35 mt-0.5">Facebook Lead â†’ AI research â†’ Email + Sheets in one pipeline</p>
          </div>
        </Link>
        <Link
          href="/dashboard/skills"
          className="flex items-center gap-4 p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/3 hover:bg-emerald-500/7 hover:border-emerald-500/30 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
            🎓
          </div>
          <div>
            <p className="font-medium text-white text-sm">Start a Skill Journey</p>
            <p className="text-xs text-white/35 mt-0.5">AI builds a 30-day plan, generates daily challenges, reviews your work</p>
          </div>
          <svg className="w-4 h-4 text-white/20 ml-auto shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
        <Link
          href="/dashboard/integrations"
          className="flex items-center gap-4 p-4 rounded-2xl border border-white/8 bg-white/2 hover:bg-white/5 hover:border-white/15 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
            🔌
          </div>
          <div>
            <p className="font-medium text-white text-sm">Connect Integrations</p>
            <p className="text-xs text-white/35 mt-0.5">Add YouTube, Slack, Stripe, GitHub and more as engine mods</p>
          </div>
          <svg className="w-4 h-4 text-white/20 ml-auto shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
        <Link
          href="/dashboard/workflows"
          className="flex items-center gap-4 p-4 rounded-2xl border border-white/8 bg-white/2 hover:bg-white/5 hover:border-white/15 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
            🔄
          </div>
          <div>
            <p className="font-medium text-white text-sm">Saved Workflows</p>
            <p className="text-xs text-white/35 mt-0.5">View and manage your automation workflows and run history</p>
          </div>
          <svg className="w-4 h-4 text-white/20 ml-auto shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/6 bg-white/2 hover:bg-white/4 transition-colors"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${run.status === "COMPLETED" ? "bg-emerald-400" :
                    run.status === "FAILED" ? "bg-red-400" :
                      run.status === "RUNNING" ? "bg-orange-400 animate-pulse" :
                        "bg-white/20"
                    }`}
                />
                <p className="text-sm text-white/60 flex-1 truncate">{run.prompt}</p>
                <span className="text-xs text-white/25 shrink-0">
                  {new Date(run.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state for new users */}
      {runCount === 0 && skillGoals.length === 0 && (
        <div className="text-center py-12 rounded-2xl border border-dashed border-white/8">
          <p className="text-4xl mb-3">🚀</p>
          <p className="text-white/50 text-sm font-medium">Nothing here yet</p>
          <p className="text-white/25 text-xs mt-1">Fire up the engine or start a skill journey to get going</p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <Link
              href="/dashboard/engine"
              className="inline-block px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
              style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
            >
              Open Engine
            </Link>
            <Link
              href="/dashboard/skills"
              className="inline-block px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
              style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
            >
              Start Learning
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
