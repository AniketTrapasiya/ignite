import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function WorkflowsPage() {
  const session = await getCurrentUser();

  const [runs, memoryCount] = await Promise.all([
    prisma.engineRun.findMany({
      where: { userId: session!.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        prompt: true,
        status: true,
        output: true,
        mods: true,
        createdAt: true,
      },
    }),
    prisma.engineMemory.count({ where: { userId: session!.userId } }),
  ]);

  const completed = runs.filter((r) => r.status === "COMPLETED").length;
  const failed = runs.filter((r) => r.status === "FAILED").length;
  const successRate = runs.length > 0 ? Math.round((completed / runs.length) * 100) : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Workflows</h1>
          <p className="text-white/40 text-sm mt-1">All engine runs and automation results</p>
        </div>
        <Link
          href="/dashboard/engine"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
        >
          <span>⚡</span> New Run
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Runs", value: runs.length, color: "text-white" },
          { label: "Completed", value: completed, color: "text-emerald-400" },
          { label: "Failed", value: failed, color: "text-red-400" },
          { label: "Success Rate", value: `${successRate}%`, color: "text-indigo-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/35 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Memories quick-link */}
      {memoryCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06]">
          <span className="text-2xl">🧠</span>
          <div>
            <p className="text-sm font-medium text-white">{memoryCount} memories saved</p>
            <p className="text-xs text-white/40">The engine automatically loads relevant memories in future runs.</p>
          </div>
          <Link
            href="/dashboard/engine"
            className="ml-auto text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex-shrink-0"
          >
            Open engine →
          </Link>
        </div>
      )}

      {/* Runs list */}
      {runs.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-white/[0.08]">
          <p className="text-5xl mb-4">⚡</p>
          <p className="text-white/50 font-medium mb-1">No runs yet</p>
          <p className="text-white/25 text-sm mb-6">
            Head to the Engine Room, describe a task, and fire it up.
          </p>
          <Link
            href="/dashboard/engine"
            className="inline-block px-6 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
          >
            Open Engine Room
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white/25 uppercase tracking-widest mb-3">
            Run History
          </p>
          {runs.map((run) => (
            <div
              key={run.id}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] transition-colors overflow-hidden"
            >
              {/* Run header */}
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="mt-0.5 flex-shrink-0">
                  {run.status === "COMPLETED" && (
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400 text-xs">✓</span>
                  )}
                  {run.status === "FAILED" && (
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/15 text-red-400 text-xs">✗</span>
                  )}
                  {run.status === "RUNNING" && (
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500/15 text-orange-400 text-xs animate-pulse">●</span>
                  )}
                  {run.status === "CANCELLED" && (
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/[0.08] text-white/30 text-xs">■</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 leading-snug line-clamp-2">{run.prompt}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-white/25">
                      {new Date(run.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    {run.mods.length > 0 && (
                      <span className="text-xs text-white/25">
                        {run.mods.length} mod{run.mods.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Replay button */}
                <Link
                  href={`/dashboard/engine`}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs text-white/30 hover:text-indigo-300 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 transition-all"
                >
                  ↺ Replay
                </Link>
              </div>

              {/* Output preview */}
              {run.output && (
                <div className="px-4 pb-3.5 ml-9">
                  <p className="text-xs text-white/25 font-mono leading-relaxed line-clamp-3 bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.05]">
                    {run.output}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
