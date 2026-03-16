"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface Challenge {
  id: string;
  day: number;
  status: string;
  xpEarned: number;
  score?: number;
}

interface SkillGoal {
  id: string;
  title: string;
  description?: string;
  level: string;
  currentDay: number;
  totalDays: number;
  streakDays: number;
  longestStreak: number;
  totalXp: number;
  status: string;
  lastActiveAt?: string;
  challenges: Challenge[];
}

const LEVEL_COLORS: Record<string, string> = {
  beginner: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  intermediate: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  advanced: "bg-red-500/15 text-red-400 border-red-500/25",
};

const LEVEL_GLOW: Record<string, string> = {
  beginner: "rgba(34,197,94,0.12)",
  intermediate: "rgba(245,158,11,0.12)",
  advanced: "rgba(239,68,68,0.12)",
};

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <span className="text-xs text-neutral-500 uppercase tracking-wider font-medium">{label}</span>
      <span className="text-2xl font-bold" style={{ color: color || "white" }}>{value}</span>
      {sub && <span className="text-xs text-neutral-500">{sub}</span>}
    </div>
  );
}

function GoalCard({ goal, onDelete }: { goal: SkillGoal; onDelete: (id: string) => void }) {
  const pct = Math.round(((goal.currentDay - 1) / goal.totalDays) * 100);
  const completedToday = goal.lastActiveAt && isToday(goal.lastActiveAt);
  const completedCount = goal.challenges.filter((c) => c.status === "completed").length;
  const glow = LEVEL_GLOW[goal.level] || "rgba(99,102,241,0.12)";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: `0 4px 32px ${glow}`,
      }}
    >
      {/* Card header */}
      <div
        className="px-5 py-4"
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.1) 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-base leading-tight truncate">{goal.title}</h3>
            {goal.description && (
              <p className="text-xs text-neutral-500 mt-0.5 truncate">{goal.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${LEVEL_COLORS[goal.level] || "bg-indigo-500/15 text-indigo-400 border-indigo-500/25"}`}
            >
              {goal.level}
            </span>
            {goal.status === "completed" && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                ✓ Done
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="px-5 py-4 space-y-3 flex-1">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-neutral-400">
            <span>Day {goal.currentDay} / {goal.totalDays}</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #6366f1, #a855f7)" }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Today status */}
        <div className="flex items-center justify-between">
          {goal.status === "completed" ? (
            <span className="text-xs text-emerald-400 flex items-center gap-1.5">
              <span className="text-sm">🏆</span> 30-day journey complete!
            </span>
          ) : completedToday ? (
            <span className="text-xs text-emerald-400 flex items-center gap-1.5">
              <span className="text-sm">✅</span> Challenge done today
            </span>
          ) : (
            <span className="text-xs text-amber-400 flex items-center gap-1.5">
              <span className="text-sm">🔥</span> Challenge waiting
            </span>
          )}
          {goal.streakDays > 0 && (
            <span className="text-xs text-orange-400 font-semibold flex items-center gap-1">
              🔥 {goal.streakDays}d
            </span>
          )}
        </div>

        {/* XP */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-amber-400 font-semibold flex items-center gap-1">
            ✦ {goal.totalXp.toLocaleString()} XP
          </span>
          <span className="text-neutral-500">{completedCount} challenges done</span>
        </div>
      </div>

      {/* Actions */}
      <div
        className="px-5 py-3 flex items-center justify-between gap-2"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={() => onDelete(goal.id)}
          className="text-xs text-neutral-600 hover:text-red-400 transition-colors"
          title="Delete goal"
        >
          Delete
        </button>
        <Link
          href={`/dashboard/skills/${goal.id}`}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
          style={{
            background: goal.status === "completed"
              ? "rgba(34,197,94,0.12)"
              : "rgba(99,102,241,0.2)",
            color: goal.status === "completed" ? "#22c55e" : "#a78bfa",
            border: `1px solid ${goal.status === "completed" ? "rgba(34,197,94,0.25)" : "rgba(99,102,241,0.3)"}`,
          }}
        >
          {goal.status === "completed" ? "Review" : "Practice Now"}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    </motion.div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="col-span-full flex flex-col items-center justify-center py-24 text-center"
    >
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center text-3xl mb-6"
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))",
          border: "1px solid rgba(99,102,241,0.25)",
        }}
      >
        🎯
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Start Your First Skill Journey</h3>
      <p className="text-sm text-neutral-400 max-w-sm mb-8 leading-relaxed">
        Tell AI what you want to learn. It will build a personalized 30-day curriculum, generate daily challenges, and review your progress — so you focus on growing, not planning.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all"
        style={{
          background: "linear-gradient(135deg, #6366f1, #a855f7)",
          boxShadow: "0 0 24px rgba(99,102,241,0.3)",
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Your First Skill
      </button>
    </motion.div>
  );
}

export default function SkillsPage() {
  const [goals, setGoals] = useState<SkillGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState({ title: "", level: "beginner", description: "" });

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => {
        setGoals(d.goals ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const r = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) {
        setCreateError(d.error || "Failed to create goal");
        return;
      }
      setGoals((prev) => [d.goal, ...prev]);
      setShowModal(false);
      setForm({ title: "", level: "beginner", description: "" });
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this skill goal? This cannot be undone.")) return;
    await fetch(`/api/skills/${id}`, { method: "DELETE" });
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  // Aggregate stats
  const totalXp = goals.reduce((a, g) => a + g.totalXp, 0);
  const activeGoals = goals.filter((g) => g.status === "active").length;
  const maxStreak = goals.reduce((a, g) => Math.max(a, g.streakDays), 0);
  const completedChallenges = goals.reduce(
    (a, g) => a + g.challenges.filter((c) => c.status === "completed").length,
    0
  );

  return (
    <div className="min-h-screen p-6" style={{ background: "#080810" }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
              style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
            >
              🎓
            </span>
            Skill Accelerator
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            AI-generated daily challenges. Build real expertise through consistent practice.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-white transition-all"
          style={{
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            boxShadow: "0 0 20px rgba(99,102,241,0.3)",
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Skill
        </button>
      </div>

      {/* Stats bar */}
      {goals.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total XP" value={`✦ ${totalXp.toLocaleString()}`} color="#f59e0b" />
          <StatCard label="Active Goals" value={activeGoals} sub={`${goals.length} total`} />
          <StatCard label="Best Streak" value={`🔥 ${maxStreak}d`} color="#f97316" />
          <StatCard label="Challenges Done" value={completedChallenges} color="#22c55e" />
        </div>
      )}

      {/* Goals grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl h-52 animate-pulse"
              style={{ background: "rgba(255,255,255,0.04)" }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {goals.length === 0 ? (
              <EmptyState onAdd={() => setShowModal(true)} />
            ) : (
              goals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} onDelete={handleDelete} />
              ))
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Add Skill Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !creating && setShowModal(false)}
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
            />
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md p-6 rounded-2xl"
              style={{
                background: "#0d0d1a",
                border: "1px solid rgba(99,102,241,0.25)",
                boxShadow: "0 0 60px rgba(99,102,241,0.15)",
              }}
            >
              <h2 className="text-lg font-bold text-white mb-1">Add a New Skill Goal</h2>
              <p className="text-xs text-neutral-500 mb-5">
                AI will generate a personalized 30-day curriculum with daily challenges tailored to your level.
              </p>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                    What do you want to learn? *
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Python programming, Digital marketing, Public speaking..."
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-neutral-600 focus:outline-none"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                    disabled={creating}
                    autoFocus
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                    Your current level
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["beginner", "intermediate", "advanced"] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, level: lvl }))}
                        className="py-2 rounded-xl text-xs font-semibold capitalize transition-all"
                        style={{
                          background:
                            form.level === lvl ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)",
                          border:
                            form.level === lvl
                              ? "1px solid rgba(99,102,241,0.5)"
                              : "1px solid rgba(255,255,255,0.08)",
                          color: form.level === lvl ? "#a78bfa" : "#737373",
                        }}
                        disabled={creating}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                    Why do you want to learn this? <span className="text-neutral-600">(optional)</span>
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="e.g. I want to automate my data analysis work..."
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-neutral-600 resize-none focus:outline-none"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                    disabled={creating}
                  />
                </div>

                {createError && (
                  <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                    {createError}
                  </p>
                )}

                {creating && (
                  <div className="flex items-center gap-2 text-xs text-indigo-400 bg-indigo-500/10 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 010 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                    </svg>
                    Generating your 30-day curriculum...
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    disabled={creating}
                    className="flex-1 py-2.5 rounded-xl text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !form.title.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg, #6366f1, #a855f7)",
                      boxShadow: creating ? "none" : "0 0 20px rgba(99,102,241,0.3)",
                    }}
                  >
                    {creating ? "Creating..." : "Generate Curriculum ✦"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
