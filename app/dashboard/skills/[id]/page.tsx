"use client";

import { useEffect, useRef, useState } from "react";
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

interface Resource {
  title: string;
  url: string;
  type: "youtube" | "article" | "docs" | "course";
  description: string;
}

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Analytics {
  totalCompleted: number;
  completionRate: number;
  avgScore: number;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  xpLast7: number;
  xpVelocityDelta: number;
  scoreTrend: { day: number; score: number; xp: number }[];
  weeklyBreakdown: { week: number; topic: string; completedDays: number; totalDays: number; avgScore: number | null; totalXp: number }[];
  byDifficulty: { difficulty: string; count: number; avgScore: number }[];
  bestDay: { day: number; score: number } | null;
  currentDay: number;
  totalDays: number;
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

const RESOURCE_ICONS: Record<string, string> = {
  youtube: "▶",
  article: "📄",
  docs: "📚",
  course: "🎓",
};

const RESOURCE_COLORS: Record<string, string> = {
  youtube: "text-red-400 bg-red-500/10 border-red-500/20",
  article: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  docs: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  course: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

function ScoreRing({ score }: { score: number }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="shrink-0">
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

// Mini bar for score chart
function MiniScoreBar({ score, day, maxScore = 100 }: { score: number; day: number; maxScore?: number }) {
  const height = Math.max(4, Math.round((score / maxScore) * 60));
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1" style={{ width: 20 }}>
      <div className="flex items-end" style={{ height: 60 }}>
        <div className="rounded-t-sm transition-all duration-700" style={{ width: 12, height, background: color, opacity: 0.85 }} />
      </div>
      <span className="text-neutral-700" style={{ fontSize: 9 }}>{day}</span>
    </div>
  );
}

// ── Chat Panel ─────────────────────────────────────────────────────────────

interface ChatMessage { role: "user" | "assistant"; content: string; }

function ChatPanel({ goalId }: { goalId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! I'm your RAG-powered learning coach. Ask me anything about your learning journey — I can reference your past work and submissions to give personalized answers." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim() || sending) return;
    const message = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setSending(true);
    try {
      const r = await fetch(`/api/skills/${goalId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const d = await r.json();
      setMessages((prev) => [...prev, { role: "assistant", content: d.reply || d.error || "Sorry, I couldn't respond right now." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Network error. Please try again." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", height: 480 }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.08))", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ background: "rgba(99,102,241,0.25)" }}>🧠</div>
        <div>
          <p className="text-xs font-bold text-white">AI Learning Coach</p>
          <p className="text-xs text-neutral-500">RAG-powered · references your past work</p>
        </div>
        <div className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)" }}>● live</div>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed"
              style={m.role === "user"
                ? { background: "linear-gradient(135deg, #6366f1, #a855f7)", color: "white" }
                : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#e5e7eb" }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="text-neutral-400 animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {/* Input */}
      <div className="px-3 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex gap-2">
          <input
            type="text" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask about today's topic, your progress, concepts..."
            className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            disabled={sending}
          />
          <button onClick={send} disabled={sending || !input.trim()} className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40" style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>↑</button>
        </div>
      </div>
    </div>
  );
}

// ── Resources Panel ──────────────────────────────────────────────────────────

function ResourcesPanel({ goalId, weeks }: { goalId: string; weeks: CurriculumWeek[] }) {
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState<Set<number>>(new Set());
  const [topic, setTopic] = useState("");

  useEffect(() => {
    if (loaded.has(selectedWeek)) return;
    setLoading(true);
    fetch(`/api/skills/${goalId}/resources?week=${selectedWeek}`)
      .then((r) => r.json())
      .then((d) => {
        setResources(d.resources ?? []);
        setTopic(d.topic ?? "");
        setLoaded((prev) => new Set(prev).add(selectedWeek));
        setLoading(false);
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek, goalId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {weeks.map((w) => (
          <button key={w.week} onClick={() => { setSelectedWeek(w.week); setResources([]); setLoaded(new Set()); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={selectedWeek === w.week
              ? { background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.5)", color: "#a78bfa" }
              : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280" }}
          >
            Week {w.week}: {w.topic}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-3 text-neutral-500 text-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 010 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
          </svg>
          Finding the best resources for {topic}...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {resources.map((res, i) => (
            <a key={i} href={res.url} target="_blank" rel="noopener noreferrer"
              className="group block rounded-xl p-4 transition-all hover:scale-[1.01]"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-start gap-3">
                <span className={`flex items-center justify-center text-sm w-8 h-8 rounded-lg border shrink-0 ${RESOURCE_COLORS[res.type] ?? RESOURCE_COLORS.article}`}>
                  {RESOURCE_ICONS[res.type] ?? "🔗"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">{res.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{res.description}</p>
                  <span className={`inline-block mt-1.5 text-xs px-1.5 py-0.5 rounded capitalize border ${RESOURCE_COLORS[res.type] ?? RESOURCE_COLORS.article}`}>{res.type}</span>
                </div>
                <svg className="w-3.5 h-3.5 text-neutral-600 group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Analytics Panel ──────────────────────────────────────────────────────────

function AnalyticsPanel({ goalId }: { goalId: string }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/skills/${goalId}/analytics`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [goalId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-neutral-500 text-sm">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 010 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
        </svg>
        Crunching your learning data...
      </div>
    );
  }

  if (!data || data.totalCompleted === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-neutral-500">
        <span className="text-3xl">📊</span>
        <p className="text-sm">Complete your first challenge to see analytics.</p>
      </div>
    );
  }

  const statCards = [
    { label: "Days Done", value: `${data.totalCompleted}/${data.totalDays}`, color: "#6366f1" },
    { label: "Avg Score", value: `${data.avgScore}%`, color: data.avgScore >= 80 ? "#22c55e" : data.avgScore >= 60 ? "#f59e0b" : "#ef4444" },
    { label: "Total XP", value: `${data.totalXp.toLocaleString()}`, color: "#f59e0b" },
    { label: "Best Streak", value: `${data.longestStreak}d`, color: "#fb923c" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-neutral-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {data.xpVelocityDelta !== 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: data.xpVelocityDelta > 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${data.xpVelocityDelta > 0 ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}` }}>
          <span>{data.xpVelocityDelta > 0 ? "🚀" : "📉"}</span>
          <p className="text-sm text-neutral-300">
            XP velocity <span style={{ color: data.xpVelocityDelta > 0 ? "#4ade80" : "#f87171" }}>{data.xpVelocityDelta > 0 ? "+" : ""}{data.xpVelocityDelta}%</span> vs prev 7 days · Last 7 days: <span className="text-amber-400 font-semibold">{data.xpLast7} XP</span>
          </p>
        </div>
      )}

      {data.scoreTrend.length > 1 && (
        <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Score per Day</p>
          <div className="flex items-end gap-1 overflow-x-auto pb-2">
            {data.scoreTrend.map((s) => <MiniScoreBar key={s.day} score={s.score} day={s.day} />)}
          </div>
          <div className="flex items-center gap-4 mt-3">
            {[{ label: "≥80 Excellent", color: "#22c55e" }, { label: "60–79 Good", color: "#f59e0b" }, { label: "<60 Needs work", color: "#ef4444" }].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                <span className="text-xs text-neutral-600">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.weeklyBreakdown.length > 0 && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Weekly Progress</p>
          {data.weeklyBreakdown.map((w, i) => {
            const pct = Math.round((w.completedDays / w.totalDays) * 100);
            const color = WEEK_COLORS[i % WEEK_COLORS.length].dot;
            return (
              <div key={w.week}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-400"><span style={{ color }}>●</span> Week {w.week}: {w.topic}</span>
                  <div className="flex items-center gap-3">
                    {w.avgScore !== null && <span className="text-neutral-500">{w.avgScore}% avg</span>}
                    <span className="text-amber-500 font-semibold">+{w.totalXp} XP</span>
                    <span className="text-neutral-600">{w.completedDays}/{w.totalDays}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.byDifficulty.some((d) => d.count > 0) && (
        <div className="grid grid-cols-3 gap-3">
          {data.byDifficulty.filter((d) => d.count > 0).map((d) => (
            <div key={d.difficulty} className="rounded-xl p-4 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <Badge label={d.difficulty} colorClass={DIFF_COLORS[d.difficulty] ?? DIFF_COLORS.medium} />
              <p className="text-xl font-bold text-white mt-2">{d.avgScore}%</p>
              <p className="text-xs text-neutral-600 mt-0.5">{d.count} done</p>
            </div>
          ))}
        </div>
      )}

      {data.bestDay && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
          <span>🏅</span>
          <p className="text-sm text-neutral-300">
            Best performance on <span className="text-amber-400 font-semibold">Day {data.bestDay.day}</span> with a score of <span className="text-emerald-400 font-semibold">{data.bestDay.score}/100</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Quiz Panel ───────────────────────────────────────────────────────────────

function QuizPanel({ goalId, weeks, currentDay }: { goalId: string; weeks: CurriculumWeek[]; currentDay: number }) {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{
    score: number; correctCount: number; total: number; passed: boolean;
    results: { questionId: number; correct: boolean; explanation: string; userAnswer: number; correctAnswer: number; options: string[] }[];
  } | null>(null);

  const availableWeeks = weeks.filter((w) => {
    const lastDay = w.days[w.days.length - 1]?.day ?? 0;
    return currentDay > lastDay;
  });

  async function loadQuiz(week: number) {
    setSelectedWeek(week); setQuestions([]); setAnswers({}); setSubmitted(false); setResult(null); setLoading(true);
    const r = await fetch(`/api/skills/${goalId}/quiz?week=${week}`);
    const d = await r.json();
    setQuestions(d.questions ?? []); setLoading(false);
  }

  async function submitQuiz() {
    if (!selectedWeek || questions.length === 0) return;
    const answerArr = questions.map((q) => answers[q.id] ?? -1);
    const r = await fetch(`/api/skills/${goalId}/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week: selectedWeek, answers: answerArr, questions }),
    });
    const d = await r.json();
    setResult(d); setSubmitted(true);
  }

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] !== undefined);

  if (availableWeeks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-500">
        <span className="text-3xl">🔒</span>
        <p className="text-sm text-center">Complete a full week to unlock its quiz.<br /><span className="text-xs text-neutral-600">Quizzes unlock after all 7 days of a week.</span></p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!selectedWeek && (
        <>
          <p className="text-sm text-neutral-400">Choose a completed week to test your knowledge:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableWeeks.map((w, i) => (
              <button key={w.week} onClick={() => loadQuiz(w.week)}
                className="group rounded-xl p-4 text-left transition-all hover:scale-[1.01]"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: WEEK_COLORS[i % WEEK_COLORS.length].dot }}>W{w.week}</div>
                  <div>
                    <p className="text-sm font-semibold text-white">{w.topic}</p>
                    <p className="text-xs text-neutral-500">{w.days.length} days · 5 questions</p>
                  </div>
                  <svg className="w-4 h-4 text-neutral-600 group-hover:text-indigo-400 ml-auto transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 gap-3 text-neutral-500 text-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 010 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
          </svg>
          Generating your quiz...
        </div>
      )}

      {!loading && questions.length > 0 && !submitted && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Week {selectedWeek} Quiz — {weeks.find((w) => w.week === selectedWeek)?.topic}</h3>
            <button onClick={() => { setSelectedWeek(null); setQuestions([]); }} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">← Back</button>
          </div>
          {questions.map((q, qi) => (
            <motion.div key={q.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: qi * 0.08 }}
              className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <p className="text-sm font-medium text-white"><span className="text-neutral-500 mr-2">{qi + 1}.</span>{q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <button key={oi} onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all"
                    style={answers[q.id] === oi
                      ? { background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.5)", color: "#a78bfa" }
                      : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#9ca3af" }}
                  >
                    <span className="text-neutral-600 mr-2">{String.fromCharCode(65 + oi)}.</span>{opt}
                  </button>
                ))}
              </div>
            </motion.div>
          ))}
          <button onClick={submitQuiz} disabled={!allAnswered}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", boxShadow: allAnswered ? "0 0 24px rgba(99,102,241,0.3)" : "none" }}
          >
            Submit Quiz
          </button>
        </div>
      )}

      {submitted && result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="rounded-2xl p-6 text-center" style={{
            background: result.passed ? "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(16,185,129,0.08))" : "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.08))",
            border: `1px solid ${result.passed ? "rgba(34,197,94,0.25)" : "rgba(245,158,11,0.25)"}`,
          }}>
            <span className="text-4xl block mb-3">{result.passed ? "🎉" : "📚"}</span>
            <h3 className="text-2xl font-bold text-white mb-1">{result.score}%</h3>
            <p className="text-sm text-neutral-400">{result.correctCount}/{result.total} correct · <span style={{ color: result.passed ? "#4ade80" : "#fbbf24" }}>{result.passed ? "Passed!" : "Keep studying!"}</span></p>
          </div>

          <div className="space-y-3">
            {result.results.map((r, i) => (
              <div key={r.questionId} className="rounded-xl p-4 space-y-2" style={{ background: r.correct ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${r.correct ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}` }}>
                <div className="flex items-start gap-2">
                  <span className={r.correct ? "text-emerald-400" : "text-red-400"}>{r.correct ? "✓" : "✗"}</span>
                  <p className="text-sm text-white flex-1">{questions[i]?.question}</p>
                </div>
                {!r.correct && (
                  <p className="text-xs text-neutral-400 ml-5">
                    Your answer: <span className="text-red-400">{r.options[r.userAnswer] ?? "Not answered"}</span> · Correct: <span className="text-emerald-400">{r.options[r.correctAnswer]}</span>
                  </p>
                )}
                <p className="text-xs text-neutral-500 ml-5 italic">{r.explanation}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setSubmitted(false); setAnswers({}); }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#d1d5db" }}>Retry Quiz</button>
            <button onClick={() => { setSelectedWeek(null); setQuestions([]); setSubmitted(false); setResult(null); }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>Try Another Week</button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

type Tab = "challenge" | "resources" | "analytics" | "quiz" | "chat";

export default function SkillDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const goalId = params.id;
  void router;

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
  const [activeTab, setActiveTab] = useState<Tab>("challenge");

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
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Skills
            </Link>
            <span className="text-neutral-700">/</span>
            <h1 className="font-bold text-white text-sm truncate">{goal.title}</h1>
            <span
              className="text-xs px-2 py-0.5 rounded-full border capitalize shrink-0"
              style={{
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.25)",
                color: "#a78bfa",
              }}
            >
              {goal.level}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs shrink-0">
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

      <div className="max-w-4xl mx-auto px-6 pt-6">

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-1 p-1 rounded-2xl mb-6 overflow-x-auto"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {([{ id: "challenge", label: "Challenge", icon: "⚡" }, { id: "chat", label: "AI Coach", icon: "🧠" }, { id: "resources", label: "Resources", icon: "📚" }, { id: "analytics", label: "Analytics", icon: "📊" }, { id: "quiz", label: "Quiz", icon: "🎯" }] as { id: Tab; label: string; icon: string }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
              style={activeTab === tab.id
                ? { background: "rgba(99,102,241,0.25)", color: "#a78bfa", border: "1px solid rgba(99,102,241,0.35)" }
                : { color: "#6b7280", border: "1px solid transparent" }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.id === "challenge" && !todayAlreadyDone && goal.status !== "completed" && (
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#6366f1", boxShadow: "0 0 4px #6366f1" }} />
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Challenge Tab ──────────────────────────────────────────────── */}
          {activeTab === "challenge" && (
            <motion.div key="challenge" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-8 pb-8">

              {/* Completed state */}
              {goal.status === "completed" && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-8 text-center"
                  style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(16,185,129,0.1))", border: "1px solid rgba(34,197,94,0.25)" }}
                >
                  <span className="text-5xl mb-4 block">🏆</span>
                  <h2 className="text-2xl font-bold text-white mb-2">Journey Complete!</h2>
                  <p className="text-sm text-neutral-400 mb-2">You&apos;ve completed all 30 days of your {goal.title} journey.</p>
                  <p className="text-sm text-emerald-400 font-medium">Total XP earned: ✦ {goal.totalXp.toLocaleString()} · Best streak: 🔥 {goal.longestStreak}d</p>
                </motion.div>
              )}

              {/* Today's Challenge */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                    {todayAlreadyDone ? "Today's Challenge — Completed" : "⚡ Today's Challenge"}
                  </h2>
                  {goal.status !== "completed" && (
                    <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", color: "#818cf8" }}>
                      Day {goal.currentDay} of {goal.totalDays}
                    </span>
                  )}
                </div>

                {loadingChallenge ? (
                  <div className="rounded-2xl p-8 flex flex-col items-center gap-3 text-neutral-400" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 010 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                    </svg>
                    <span className="text-sm">Generating your challenge...</span>
                  </div>
                ) : challenge ? (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl overflow-hidden"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: todayAlreadyDone ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(99,102,241,0.25)",
                      boxShadow: todayAlreadyDone ? "0 0 32px rgba(34,197,94,0.08)" : "0 0 40px rgba(99,102,241,0.12)",
                    }}
                  >
                    <div className="px-6 py-5" style={{ background: todayAlreadyDone ? "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(16,185,129,0.08))" : "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold text-white text-lg leading-tight">{challenge.title}</h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge label={challenge.type} colorClass={TYPE_COLORS[challenge.type] || TYPE_COLORS.practice} />
                          <Badge label={challenge.difficulty} colorClass={DIFF_COLORS[challenge.difficulty] || DIFF_COLORS.medium} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-amber-400 font-semibold">+{challenge.difficulty === "easy" ? "50–100" : challenge.difficulty === "hard" ? "150–200" : "100–150"} XP</span>
                        {todayAlreadyDone && <span className="text-xs text-emerald-400 font-semibold">✓ +{challenge.xpEarned} XP earned</span>}
                      </div>
                    </div>

                    <div className="px-6 py-5 space-y-5">
                      <p className="text-sm text-neutral-300 leading-relaxed">{challenge.description}</p>

                      {challenge.hints && challenge.hints.length > 0 && (
                        <div>
                          <button onClick={() => setShowHints((h) => !h)} className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                            <span>💡</span>
                            <span>{showHints ? "Hide" : "Show"} {challenge.hints.length} hints</span>
                            <svg className={`w-3 h-3 transition-transform ${showHints ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                          <AnimatePresence>
                            {showHints && (
                              <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 space-y-1.5 overflow-hidden">
                                {challenge.hints.map((h, i) => (
                                  <li key={i} className="text-xs text-neutral-400 flex items-start gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(99,102,241,0.08)" }}>
                                    <span className="text-indigo-500 shrink-0 mt-0.5">→</span>{h}
                                  </li>
                                ))}
                              </motion.ul>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      <AnimatePresence mode="wait">
                        {!todayAlreadyDone && !submitResult ? (
                          <motion.div key="submission" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                            <label className="block text-xs font-medium text-neutral-400">Your Work</label>
                            <textarea
                              value={submission} onChange={(e) => setSubmission(e.target.value)}
                              placeholder="Write your code, solution, notes, or reflection here. There are no wrong answers — be honest about what you tried and learned."
                              rows={6}
                              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-neutral-600 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: challenge.type === "code" ? "monospace" : "inherit" }}
                              disabled={submitting}
                            />
                            {submitError && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{submitError}</p>}
                            <button onClick={handleSubmit} disabled={submitting || !submission.trim()}
                              className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                              style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", boxShadow: submitting ? "none" : "0 0 24px rgba(99,102,241,0.3)" }}
                            >
                              {submitting ? (
                                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 010 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" /></svg>Getting AI feedback...</>
                              ) : (
                                <>Submit & Get AI Feedback<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg></>
                              )}
                            </button>
                          </motion.div>
                        ) : todayAlreadyDone || submitResult ? (
                          <motion.div key="feedback" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                            {challenge.score !== null && challenge.score !== undefined && (
                              <div className="flex gap-5 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <ScoreRing score={challenge.score} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-neutral-300 leading-relaxed">{challenge.feedback}</p>
                                  <p className="text-xs text-amber-400 font-semibold mt-2">✦ {challenge.xpEarned} XP earned</p>
                                </div>
                              </div>
                            )}

                            {submitResult && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-3 rounded-xl space-y-1.5" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Strengths</p>
                                  {submitResult.review.strengths.map((s, i) => <p key={i} className="text-xs text-neutral-300 flex items-start gap-1.5"><span className="text-emerald-400 shrink-0">✓</span> {s}</p>)}
                                </div>
                                <div className="p-3 rounded-xl space-y-1.5" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
                                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Improve</p>
                                  {submitResult.review.improvements.map((s, i) => <p key={i} className="text-xs text-neutral-300 flex items-start gap-1.5"><span className="text-amber-400 shrink-0">↑</span> {s}</p>)}
                                </div>
                              </div>
                            )}

                            {submitResult?.review.nextStepHint && (
                              <div className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                                <span className="text-indigo-400 shrink-0 mt-0.5">💡</span>
                                <p className="text-xs text-neutral-300"><span className="font-semibold text-indigo-400">Tomorrow: </span>{submitResult.review.nextStepHint}</p>
                              </div>
                            )}

                            {submitResult?.isCompleted ? (
                              <div className="text-center py-4">
                                <p className="text-lg font-bold text-white mb-1">🏆 Journey Complete!</p>
                                <p className="text-sm text-neutral-400">You&apos;ve finished all 30 days. Amazing!</p>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between p-3 rounded-xl text-sm" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                                <span className="text-emerald-400 font-medium">✓ Day {challenge.day} complete · Day {submitResult?.newDay ?? goal.currentDay} unlocked</span>
                                <button
                                  onClick={() => {
                                    setSubmitResult(null); setChallenge(null); setSubmission(""); setLoadingChallenge(true);
                                    fetch(`/api/skills/${goalId}/challenge`).then((r) => r.json()).then((d) => { setChallenge(d.challenge ?? null); setLoadingChallenge(false); }).catch(() => setLoadingChallenge(false));
                                  }}
                                  className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-all"
                                  style={{ background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.4)" }}
                                >Next Challenge →</button>
                              </div>
                            )}

                            <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
                              <p className="text-xs text-neutral-400">Have questions about today&apos;s topic?</p>
                              <button onClick={() => setActiveTab("chat")} className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">Ask AI Coach →</button>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ) : (
                  <div className="text-center py-8 text-neutral-500 text-sm">Unable to load challenge. Please refresh the page.</div>
                )}
              </section>

              {/* 30-Day Curriculum */}
              {weeks.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">30-Day Curriculum</h2>
                  <div className="space-y-2">
                    {weeks.map((week, wi) => {
                      const wColor = WEEK_COLORS[wi % WEEK_COLORS.length];
                      const completedInWeek = week.days.filter((d) => getChallengeForDay(d.day)?.status === "completed").length;
                      const isExpanded = expandedWeeks.has(week.week);
                      return (
                        <div key={week.week} className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                          <button onClick={() => toggleWeek(week.week)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/2 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: wColor.dot }} />
                              <span className={`text-sm font-semibold ${wColor.label}`}>Week {week.week}</span>
                              <span className="text-sm text-neutral-400">{week.topic}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-neutral-600">{completedInWeek}/{week.days.length}</span>
                              <svg className={`w-3.5 h-3.5 text-neutral-600 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                              </svg>
                            </div>
                          </button>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                                <div className="px-4 pb-3 space-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                  {week.days.map((d) => {
                                    const dayChallenge = getChallengeForDay(d.day);
                                    const isCurrentDay = d.day === goal.currentDay;
                                    const isDone = dayChallenge?.status === "completed";
                                    const isPast = d.day < goal.currentDay && !isDone;
                                    return (
                                      <div key={d.day} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isCurrentDay ? "bg-indigo-500/10" : "hover:bg-white/2"}`}>
                                        <div className="w-5 shrink-0 flex items-center justify-center">
                                          {isDone ? <span className="text-sm text-emerald-400">✓</span>
                                            : isCurrentDay ? <div className="w-2 h-2 rounded-full" style={{ background: "#6366f1", boxShadow: "0 0 6px #6366f1" }} />
                                              : <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-baseline gap-2">
                                            <span className={`text-xs font-medium ${isDone ? "text-emerald-400" : isCurrentDay ? "text-indigo-400" : "text-neutral-500"}`}>Day {d.day}</span>
                                            <span className={`text-xs truncate ${isDone ? "text-neutral-400" : isCurrentDay ? "text-white" : "text-neutral-600"}`}>{d.title}</span>
                                          </div>
                                        </div>
                                        <div className="shrink-0">
                                          {isDone && dayChallenge?.score !== null && dayChallenge?.score !== undefined && <span className="text-xs text-emerald-600">{dayChallenge.score}%</span>}
                                          {isCurrentDay && !isDone && <span className="text-xs text-indigo-400 font-semibold">Today</span>}
                                          {isPast && <span className="text-xs text-neutral-700">Skipped</span>}
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

              {/* Past Submissions */}
              {goal.challenges.filter((c) => c.status === "completed" && c.day !== goal.currentDay).length > 0 && (
                <section>
                  <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Completed Challenges</h2>
                  <div className="space-y-2">
                    {goal.challenges.filter((c) => c.status === "completed").sort((a, b) => b.day - a.day).map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-neutral-600 w-10">Day {c.day}</span>
                          <span className="text-neutral-300 truncate">{c.title}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {c.score !== null && c.score !== undefined && <span className={`text-xs font-medium ${c.score >= 80 ? "text-emerald-400" : c.score >= 60 ? "text-amber-400" : "text-red-400"}`}>{c.score}%</span>}
                          <span className="text-xs text-amber-500">+{c.xpEarned} XP</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          )}

          {/* ── AI Coach Tab ────────────────────────────────────────────────── */}
          {activeTab === "chat" && (
            <motion.div key="chat" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="pb-8">
              <div className="mb-4">
                <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">AI Learning Coach</h2>
                <p className="text-xs text-neutral-600">Powered by RAG — your learning history is stored in a Pinecone namespace and retrieved to give personalized answers.</p>
              </div>
              <ChatPanel goalId={goalId} />
            </motion.div>
          )}

          {/* ── Resources Tab ───────────────────────────────────────────────── */}
          {activeTab === "resources" && (
            <motion.div key="resources" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="pb-8">
              <div className="mb-5">
                <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Learning Resources</h2>
                <p className="text-xs text-neutral-600">AI-curated YouTube videos, articles, and docs for each week&apos;s topic.</p>
              </div>
              {weeks.length > 0 ? <ResourcesPanel goalId={goalId} weeks={weeks} /> : <p className="text-sm text-neutral-500 py-8 text-center">No curriculum available.</p>}
            </motion.div>
          )}

          {/* ── Analytics Tab ───────────────────────────────────────────────── */}
          {activeTab === "analytics" && (
            <motion.div key="analytics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="pb-8">
              <div className="mb-5">
                <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Learning Analytics</h2>
                <p className="text-xs text-neutral-600">Your progress, scores, XP velocity, and performance breakdown.</p>
              </div>
              <AnalyticsPanel goalId={goalId} />
            </motion.div>
          )}

          {/* ── Quiz Tab ────────────────────────────────────────────────────── */}
          {activeTab === "quiz" && (
            <motion.div key="quiz" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="pb-8">
              <div className="mb-5">
                <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Weekly Quiz</h2>
                <p className="text-xs text-neutral-600">Test your knowledge after each week. Quizzes unlock when you complete all days in a week.</p>
              </div>
              <QuizPanel goalId={goalId} weeks={weeks} currentDay={goal.currentDay} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

