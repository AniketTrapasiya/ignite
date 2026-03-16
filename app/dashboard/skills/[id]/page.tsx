"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ────────────────────────────────────────────────────────────────────

interface Challenge {
  id: string;
  goalId: string;
  day: number;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  hints: string[] | null;
  status: string;
  submission?: string | null;
  feedback?: string | null;
  score?: number | null;
  xpEarned: number;
  completedAt?: string | null;
}

interface CurriculumDay { day: number; title: string; focus: string }
interface CurriculumWeek { week: number; topic: string; description: string; days: CurriculumDay[] }
interface Curriculum { curriculum: CurriculumWeek[] }

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
  curriculum: Curriculum | null;
  challenges: Challenge[];
}

interface SubmitResult {
  challenge: Challenge;
  review: {
    score: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
    nextStepHint: string;
    xpEarned: number;
  };
  newDay: number;
  newXp: number;
  newStreak: number;
  isCompleted: boolean;
}

// ── Helper components ────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  code: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  practice: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
  quiz: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  reflect: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  project: "bg-orange-500/15 text-orange-400 border-orange-500/25",
};

const DIFF_COLORS: Record<string, string> = {
  easy: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  hard: "bg-red-500/15 text-red-400 border-red-500/25",
};

const WEEK_COLORS = [
  { border: "rgba(99,102,241,0.4)", dot: "#6366f1", label: "text-indigo-400" },
  { border: "rgba(168,85,247,0.4)", dot: "#a855f7", label: "text-purple-400" },
  { border: "rgba(217,70,239,0.4)", dot: "#d946ef", label: "text-fuchsia-400" },
  { border: "rgba(245,158,11,0.4)", dot: "#f59e0b", label: "text-amber-400" },
];

function ScoreRing({ score }: { score: number }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="flex-shrink-0">
      <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
      <circle
        cx="40" cy="40" r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
        style={{ transition: "stroke-dashoffset 1.2s ease" }}
      />
      <text x="40" y="44" textAnchor="middle" fill="white" fontSize="17" fontWeight="bold">{score}</text>
    </svg>
  );
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${colorClass}`}>
      {label}
    </span>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SkillDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const goalId = params.id;

  const [goal, setGoal] = useState<SkillGoal | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loadingGoal, setLoadingGoal] = useState(true);
  const [loadingChallenge, setLoadingChallenge] = useState(true);
  const [submission, setSubmission] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));
  const [submitError, setSubmitError] = useState("");

  // Load goal
  useEffect(() => {
    fetch(`/api/skills/${goalId}`)
      .then((r) => r.json())
      .then((d) => {
        setGoal(d.goal ?? null);
        setLoadingGoal(false);
      })
      .catch(() => setLoadingGoal(false));
  }, [goalId]);

  // Load today's challenge (auto-generates if missing)
  useEffect(() => {
    if (!goal) return;
    setLoadingChallenge(true);
    fetch(`/api/skills/${goalId}/challenge`)
      .then((r) => r.json())
      .then((d) => {
        setChallenge(d.challenge ?? null);
        setLoadingChallenge(false);
      })
      .catch(() => setLoadingChallenge(false));
  }, [goal, goalId]);

  async function handleSubmit() {
    if (!challenge || !submission.trim()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const r = await fetch(`/api/skills/${goalId}/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id, submission }),
      });
      const d = await r.json();
      if (!r.ok) {
        setSubmitError(d.error || "Submission failed");
        return;
      }
      setSubmitResult(d);
      setChallenge(d.challenge);
      // Update goal stats in state
      setGoal((prev) =>
        prev
          ? {
            ...prev,
            totalXp: d.newXp,
            currentDay: d.newDay,
            streakDays: d.newStreak,
            status: d.isCompleted ? "completed" : "active",
          }
          : prev
      );
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleWeek(week: number) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      next.has(week) ? next.delete(week) : next.add(week);
      return next;
    });
  }

  function getChallengeForDay(day: number): Challenge | undefined {
    return goal?.challenges.find((c) => c.day === day);
  }

  if (loadingGoal) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080810" }}>
        <div className="flex items-center gap-3 text-neutral-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 010 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
          </svg>
          Loading your skill journey...
        </div>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#080810" }}>
        <p className="text-neutral-400">Skill goal not found.</p>
        <Link href="/dashboard/skills" className="text-sm text-indigo-400 hover:text-indigo-300 underline">
          Back to Skills
        </Link>
      </div>
    );
  }

  const pct = Math.round(((goal.currentDay - 1) / goal.totalDays) * 100);
  const weeks = goal.curriculum?.curriculum ?? [];
  const todayAlreadyDone = challenge?.status === "completed";

  return (
    <div className="min-h-screen pb-12" style={{ background: "#080810" }}>
      {/* ── Top header ────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 px-6 py-4"
        style={{
          background: "rgba(8,8,16,0.92)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard/skills"
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors flex-shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Skills
            </Link>
            <span className="text-neutral-700">/</span>
            <h1 className="font-bold text-white text-sm truncate">{goal.title}</h1>
            <span
              className="text-xs px-2 py-0.5 rounded-full border capitalize flex-shrink-0"
              style={{
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.25)",
                color: "#a78bfa",
              }}
            >
              {goal.level}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs flex-shrink-0">
            {goal.streakDays > 0 && (
              <span className="text-orange-400 font-semibold">🔥 {goal.streakDays}d</span>
            )}
            <span className="text-amber-400 font-semibold">✦ {goal.totalXp.toLocaleString()} XP</span>
            <span className="text-neutral-500">Day {goal.currentDay}/{goal.totalDays}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="max-w-4xl mx-auto mt-3">
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #6366f1, #a855f7)" }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-8 space-y-8">

        {/* ── Completed state ────────────────────────────────────────────── */}
        {goal.status === "completed" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-8 text-center"
            style={{
              background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(16,185,129,0.1))",
              border: "1px solid rgba(34,197,94,0.25)",
            }}
          >
            <span className="text-5xl mb-4 block">🏆</span>
            <h2 className="text-2xl font-bold text-white mb-2">Journey Complete!</h2>
            <p className="text-sm text-neutral-400 mb-2">
              You&apos;ve completed all 30 days of your {goal.title} journey.
            </p>
            <p className="text-sm text-emerald-400 font-medium">
              Total XP earned: ✦ {goal.totalXp.toLocaleString()} · Best streak: 🔥 {goal.longestStreak}d
            </p>
          </motion.div>
        )}

        {/* ── Today's Challenge ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
              {todayAlreadyDone ? "Today's Challenge — Completed" : "⚡ Today's Challenge"}
            </h2>
            {goal.status !== "completed" && (
              <span
                className="text-xs px-2.5 py-1 rounded-full"
                style={{
                  background: "rgba(99,102,241,0.12)",
                  border: "1px solid rgba(99,102,241,0.25)",
                  color: "#818cf8",
                }}
              >
                Day {goal.currentDay} of {goal.totalDays}
              </span>
            )}
          </div>

          {loadingChallenge ? (
            <div
              className="rounded-2xl p-8 flex flex-col items-center gap-3 text-neutral-400"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 010 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
              </svg>
              <span className="text-sm">Generating your challenge...</span>
            </div>
          ) : challenge ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: todayAlreadyDone
                  ? "1px solid rgba(34,197,94,0.2)"
                  : "1px solid rgba(99,102,241,0.25)",
                boxShadow: todayAlreadyDone
                  ? "0 0 32px rgba(34,197,94,0.08)"
                  : "0 0 40px rgba(99,102,241,0.12)",
              }}
            >
              {/* Challenge header */}
              <div
                className="px-6 py-5"
                style={{
                  background: todayAlreadyDone
                    ? "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(16,185,129,0.08))"
                    : "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-white text-lg leading-tight">{challenge.title}</h3>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge
                      label={challenge.type}
                      colorClass={TYPE_COLORS[challenge.type] || TYPE_COLORS.practice}
                    />
                    <Badge
                      label={challenge.difficulty}
                      colorClass={DIFF_COLORS[challenge.difficulty] || DIFF_COLORS.medium}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-amber-400 font-semibold">
                    +{challenge.difficulty === "easy" ? "50–100" : challenge.difficulty === "hard" ? "150–200" : "100–150"} XP
                  </span>
                  {todayAlreadyDone && (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      ✓ +{challenge.xpEarned} XP earned
                    </span>
                  )}
                </div>
              </div>

              {/* Challenge body */}
              <div className="px-6 py-5 space-y-5">
                <p className="text-sm text-neutral-300 leading-relaxed">{challenge.description}</p>

                {/* Hints toggle */}
                {challenge.hints && challenge.hints.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowHints((h) => !h)}
                      className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <span>💡</span>
                      <span>{showHints ? "Hide" : "Show"} {challenge.hints.length} hints</span>
                      <svg
                        className={`w-3 h-3 transition-transform ${showHints ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    <AnimatePresence>
                      {showHints && (
                        <motion.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-2 space-y-1.5 overflow-hidden"
                        >
                          {challenge.hints.map((h, i) => (
                            <li
                              key={i}
                              className="text-xs text-neutral-400 flex items-start gap-2 px-3 py-1.5 rounded-lg"
                              style={{ background: "rgba(99,102,241,0.08)" }}
                            >
                              <span className="text-indigo-500 flex-shrink-0 mt-0.5">→</span>
                              {h}
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Submission or Feedback */}
                <AnimatePresence mode="wait">
                  {!todayAlreadyDone && !submitResult ? (
                    <motion.div
                      key="submission"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      <label className="block text-xs font-medium text-neutral-400">
                        Your Work
                      </label>
                      <textarea
                        value={submission}
                        onChange={(e) => setSubmission(e.target.value)}
                        placeholder="Write your code, solution, notes, or reflection here. There are no wrong answers — be honest about what you tried and learned."
                        rows={6}
                        className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-neutral-600 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          fontFamily: challenge.type === "code" ? "monospace" : "inherit",
                        }}
                        disabled={submitting}
                      />
                      {submitError && (
                        <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                          {submitError}
                        </p>
                      )}
                      <button
                        onClick={handleSubmit}
                        disabled={submitting || !submission.trim()}
                        className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{
                          background: "linear-gradient(135deg, #6366f1, #a855f7)",
                          boxShadow: submitting ? "none" : "0 0 24px rgba(99,102,241,0.3)",
                        }}
                      >
                        {submitting ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 010 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                            </svg>
                            Getting AI feedback...
                          </>
                        ) : (
                          <>
                            Submit & Get AI Feedback
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                            </svg>
                          </>
                        )}
                      </button>
                    </motion.div>
                  ) : todayAlreadyDone || submitResult ? (
                    <motion.div
                      key="feedback"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-5"
                    >
                      {/* Score + overview */}
                      {challenge.score !== null && challenge.score !== undefined && (
                        <div
                          className="flex gap-5 p-4 rounded-xl"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                        >
                          <ScoreRing score={challenge.score} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-neutral-300 leading-relaxed">
                              {challenge.feedback}
                            </p>
                            <p className="text-xs text-amber-400 font-semibold mt-2">
                              ✦ {challenge.xpEarned} XP earned
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Strengths + Improvements */}
                      {submitResult && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div
                            className="p-3 rounded-xl space-y-1.5"
                            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}
                          >
                            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Strengths</p>
                            {submitResult.review.strengths.map((s, i) => (
                              <p key={i} className="text-xs text-neutral-300 flex items-start gap-1.5">
                                <span className="text-emerald-400 flex-shrink-0">✓</span> {s}
                              </p>
                            ))}
                          </div>
                          <div
                            className="p-3 rounded-xl space-y-1.5"
                            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}
                          >
                            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Improve</p>
                            {submitResult.review.improvements.map((s, i) => (
                              <p key={i} className="text-xs text-neutral-300 flex items-start gap-1.5">
                                <span className="text-amber-400 flex-shrink-0">↑</span> {s}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Next step hint */}
                      {submitResult?.review.nextStepHint && (
                        <div
                          className="flex items-start gap-2.5 p-3 rounded-xl"
                          style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}
                        >
                          <span className="text-indigo-400 flex-shrink-0 mt-0.5">💡</span>
                          <p className="text-xs text-neutral-300">
                            <span className="font-semibold text-indigo-400">Tomorrow: </span>
                            {submitResult.review.nextStepHint}
                          </p>
                        </div>
                      )}

                      {submitResult?.isCompleted ? (
                        <div className="text-center py-4">
                          <p className="text-lg font-bold text-white mb-1">🏆 Journey Complete!</p>
                          <p className="text-sm text-neutral-400">You&apos;ve finished all 30 days. Amazing!</p>
                        </div>
                      ) : (
                        <div
                          className="flex items-center justify-between p-3 rounded-xl text-sm"
                          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}
                        >
                          <span className="text-emerald-400 font-medium">
                            ✓ Day {challenge.day} complete · Day {submitResult?.newDay ?? goal.currentDay} unlocked
                          </span>
                          <button
                            onClick={() => {
                              setSubmitResult(null);
                              setChallenge(null);
                              setSubmission("");
                              setLoadingChallenge(true);
                              fetch(`/api/skills/${goalId}/challenge`)
                                .then((r) => r.json())
                                .then((d) => {
                                  setChallenge(d.challenge ?? null);
                                  setLoadingChallenge(false);
                                })
                                .catch(() => setLoadingChallenge(false));
                            }}
                            className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-all"
                            style={{ background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.4)" }}
                          >
                            Next Challenge →
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-8 text-neutral-500 text-sm">
              Unable to load challenge. Please refresh the page.
            </div>
          )}
        </section>

        {/* ── 30-Day Curriculum ──────────────────────────────────────────── */}
        {weeks.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">
              30-Day Curriculum
            </h2>
            <div className="space-y-2">
              {weeks.map((week, wi) => {
                const wColor = WEEK_COLORS[wi % WEEK_COLORS.length];
                const completedInWeek = week.days.filter((d) => {
                  const c = getChallengeForDay(d.day);
                  return c?.status === "completed";
                }).length;
                const isExpanded = expandedWeeks.has(week.week);
                return (
                  <div
                    key={week.week}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid rgba(255,255,255,0.07)`,
                    }}
                  >
                    <button
                      onClick={() => toggleWeek(week.week)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: wColor.dot }}
                        />
                        <span className={`text-sm font-semibold ${wColor.label}`}>
                          Week {week.week}
                        </span>
                        <span className="text-sm text-neutral-400">{week.topic}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-neutral-600">
                          {completedInWeek}/{week.days.length}
                        </span>
                        <svg
                          className={`w-3.5 h-3.5 text-neutral-600 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div
                            className="px-4 pb-3 space-y-0.5"
                            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                          >
                            {week.days.map((d) => {
                              const dayChallenge = getChallengeForDay(d.day);
                              const isCurrentDay = d.day === goal.currentDay;
                              const isDone = dayChallenge?.status === "completed";
                              const isPast = d.day < goal.currentDay && !isDone;
                              return (
                                <div
                                  key={d.day}
                                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isCurrentDay ? "bg-indigo-500/10" : "hover:bg-white/[0.02]"}`}
                                >
                                  <div className="w-5 flex-shrink-0 flex items-center justify-center">
                                    {isDone ? (
                                      <span className="text-sm text-emerald-400">✓</span>
                                    ) : isCurrentDay ? (
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ background: "#6366f1", boxShadow: "0 0 6px #6366f1" }}
                                      />
                                    ) : (
                                      <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2">
                                      <span
                                        className={`text-xs font-medium ${isDone ? "text-emerald-400" : isCurrentDay ? "text-indigo-400" : "text-neutral-500"
                                          }`}
                                      >
                                        Day {d.day}
                                      </span>
                                      <span
                                        className={`text-xs truncate ${isDone ? "text-neutral-400" : isCurrentDay ? "text-white" : "text-neutral-600"
                                          }`}
                                      >
                                        {d.title}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex-shrink-0">
                                    {isDone && dayChallenge?.score !== null && dayChallenge?.score !== undefined && (
                                      <span className="text-xs text-emerald-600">{dayChallenge.score}%</span>
                                    )}
                                    {isCurrentDay && !isDone && (
                                      <span className="text-xs text-indigo-400 font-semibold">Today</span>
                                    )}
                                    {isPast && (
                                      <span className="text-xs text-neutral-700">Skipped</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Past Submissions ───────────────────────────────────────────── */}
        {goal.challenges.filter((c) => c.status === "completed" && c.day !== goal.currentDay).length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">
              Completed Challenges
            </h2>
            <div className="space-y-2">
              {goal.challenges
                .filter((c) => c.status === "completed")
                .sort((a, b) => b.day - a.day)
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl text-sm"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-neutral-600 w-10">Day {c.day}</span>
                      <span className="text-neutral-300 truncate">{c.title}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {c.score !== null && c.score !== undefined && (
                        <span
                          className={`text-xs font-medium ${c.score >= 80 ? "text-emerald-400" : c.score >= 60 ? "text-amber-400" : "text-red-400"
                            }`}
                        >
                          {c.score}%
                        </span>
                      )}
                      <span className="text-xs text-amber-500">+{c.xpEarned} XP</span>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
