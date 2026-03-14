"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

export type EngineState = "idle" | "thinking" | "running" | "success" | "error";

interface AgentMascotProps {
  state: EngineState;
}

// ── State config ────────────────────────────────────────────────────────────
const STATE_CONFIG = {
  idle:     { color: "#7c3aed", glow: "#7c3aed", label: "READY" },
  thinking: { color: "#a855f7", glow: "#a855f7", label: "THINKING" },
  running:  { color: "#f97316", glow: "#f97316", label: "RUNNING" },
  success:  { color: "#22c55e", glow: "#22c55e", label: "DONE" },
  error:    { color: "#ef4444", glow: "#ef4444", label: "ERROR" },
};

// ── Rotating speech messages per state ─────────────────────────────────────
const SPEECH: Record<EngineState, string[]> = {
  idle:     ["Ready to ignite…", "Waiting for fuel…", "Systems nominal.", "Standing by…"],
  thinking: ["Analyzing prompt…", "Loading context…", "Processing…", "Preparing engine…"],
  running:  ["Executing task…", "Fetching data…", "Almost there…", "Generating output…"],
  success:  ["Task complete! 🎉", "Results ready!", "Engine ran clean.", "Done! ✓"],
  error:    ["Something failed…", "Error detected!", "Check the logs.", "Engine faulted."],
};

// ── Sparkle positions ────────────────────────────────────────────────────────
const SPARKLES = [
  { x: -55, y: -60, delay: 0 },
  { x: 55, y: -55, delay: 0.08 },
  { x: -65, y: 5, delay: 0.16 },
  { x: 65, y: 10, delay: 0.24 },
  { x: -40, y: 65, delay: 0.12 },
  { x: 45, y: 62, delay: 0.2 },
];

// ── Body animation variants ──────────────────────────────────────────────────
type BodyAnim = {
  animate: Record<string, unknown>;
  transition: Record<string, unknown>;
};

function getBodyAnim(state: EngineState): BodyAnim {
  switch (state) {
    case "idle":
      return {
        animate: { y: [0, -8, 0], scale: [1, 1.02, 1] },
        transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
      };
    case "thinking":
      return {
        animate: { rotate: [0, -4, 4, -3, 3, -2, 2, 0], scale: [1, 1.04, 1] },
        transition: { duration: 0.6, repeat: Infinity, ease: "easeInOut" },
      };
    case "running":
      return {
        animate: { x: [0, -3, 3, -2, 2, -3, 3, 0], y: [0, -2, 2, -1, 1, 0] },
        transition: { duration: 0.18, repeat: Infinity },
      };
    case "success":
      return {
        animate: { y: [0, -32, -6, -20, 0, -8, 0], scale: [1, 1.12, 0.95, 1.08, 1, 1.03, 1] },
        transition: { duration: 0.8, times: [0, 0.25, 0.4, 0.55, 0.75, 0.88, 1], repeat: 2, repeatDelay: 1.5 },
      };
    case "error":
      return {
        animate: { x: [0, -10, 10, -8, 8, -5, 5, -3, 3, 0] },
        transition: { duration: 0.45, repeat: 4, repeatDelay: 1 },
      };
    default:
      return { animate: {}, transition: {} };
  }
}

// ── Outer ring anim ──────────────────────────────────────────────────────────
type RingAnim = {
  animate: Record<string, unknown>;
  transition: Record<string, unknown>;
};

function getRingAnim(state: EngineState): RingAnim {
  if (state === "running")  return { animate: { rotate: 360 }, transition: { duration: 2, repeat: Infinity, ease: "linear" } };
  if (state === "thinking") return { animate: { rotate: -360 }, transition: { duration: 3, repeat: Infinity, ease: "linear" } };
  return { animate: { rotate: 0 }, transition: {} };
}

export default function AgentMascot({ state }: AgentMascotProps) {
  const cfg = STATE_CONFIG[state];
  const [speechIndex, setSpeechIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const bodyAnim = getBodyAnim(state);
  const ringAnim = getRingAnim(state);

  // Rotate speech messages
  useEffect(() => {
    setSpeechIndex(0);
    const messages = SPEECH[state];
    if (messages.length <= 1) return;
    const interval = setInterval(() => {
      setSpeechIndex((i) => (i + 1) % messages.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [state]);

  return (
    <div
      className="flex flex-col items-center gap-3 select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Speech bubble ── */}
      <div className="h-7 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${state}-${speechIndex}`}
            initial={{ opacity: 0, y: -6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="px-3 py-1 rounded-full border text-[10px] font-medium"
            style={{
              background: `${cfg.glow}12`,
              borderColor: `${cfg.glow}30`,
              color: cfg.color,
            }}
          >
            💭 {SPEECH[state][speechIndex]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Main chamber ── */}
      <div className="relative flex items-center justify-center" style={{ width: 210, height: 210 }}>

        {/* Ambient background glow */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 210, height: 210,
            background: `radial-gradient(circle, ${cfg.glow}20 0%, transparent 65%)`,
          }}
          animate={{
            opacity: state === "running" ? [0.6, 1, 0.6] : state === "thinking" ? [0.4, 0.8, 0.4] : [0.3, 0.5, 0.3],
          }}
          transition={{ duration: state === "running" ? 0.5 : 2, repeat: Infinity }}
        />

        {/* Ring 3 — outermost, dashed, slow rotate */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 200, height: 200,
            border: `1px dashed ${cfg.glow}25`,
          }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />

        {/* Ring 2 — solid, counter-rotate */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 170, height: 170,
            border: `1.5px solid ${cfg.glow}40`,
            boxShadow: `0 0 10px ${cfg.glow}20`,
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          animate={ringAnim.animate as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          transition={ringAnim.transition as any}
        />

        {/* Ring 1 — glowing inner ring */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 142, height: 142,
            border: `2px solid ${cfg.glow}60`,
            background: `radial-gradient(circle, ${cfg.glow}10 0%, transparent 70%)`,
          }}
          animate={{
            boxShadow: [
              `0 0 15px ${cfg.glow}30, inset 0 0 15px ${cfg.glow}08`,
              `0 0 30px ${cfg.glow}60, inset 0 0 20px ${cfg.glow}15`,
              `0 0 15px ${cfg.glow}30, inset 0 0 15px ${cfg.glow}08`,
            ],
          }}
          transition={{ duration: state === "running" ? 0.4 : 2, repeat: Infinity }}
        />

        {/* ── Inner chamber ── */}
        <motion.div
          className="relative flex items-center justify-center rounded-full z-10"
          style={{
            width: 114, height: 114,
            background: `radial-gradient(circle at 38% 33%, ${cfg.glow}28, #080614 68%)`,
            border: `2px solid ${cfg.glow}70`,
          }}
          animate={{
            boxShadow: [
              `0 0 20px ${cfg.glow}35, inset 0 0 15px ${cfg.glow}12`,
              `0 0 40px ${cfg.glow}65, inset 0 0 25px ${cfg.glow}22`,
              `0 0 20px ${cfg.glow}35, inset 0 0 15px ${cfg.glow}12`,
            ],
            scale: isHovered ? 1.06 : 1,
          }}
          transition={{ duration: state === "running" ? 0.35 : 1.8, repeat: Infinity }}
        >
          {/* ── Slime body (SVG + Framer) ── */}
          <motion.svg
            width="76"
            height="76"
            viewBox="0 0 80 80"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          animate={bodyAnim.animate as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          transition={bodyAnim.transition as any}
          whileHover={{ scale: 1.08 }}
          >
            <defs>
              <filter id={`slime-glow-${state}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Body */}
            <path
              d="M13 48 Q13 26 40 22 Q67 26 67 48 Q67 63 40 67 Q13 63 13 48"
              fill={cfg.color}
              opacity="0.92"
              filter={`url(#slime-glow-${state})`}
            />
            <ellipse cx="40" cy="52" rx="27" ry="16" fill={cfg.color} opacity="0.92" />

            {/* Shine */}
            <ellipse cx="30" cy="32" rx="7.5" ry="4.5" fill="white" opacity="0.26" />

            {/* Eyes by state */}
            {state === "error" && (
              <>
                <line x1="29" y1="41" x2="36" y2="48" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="36" y1="41" x2="29" y2="48" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="44" y1="41" x2="51" y2="48" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="51" y1="41" x2="44" y2="48" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M33 56 Q40 51 47 56" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
              </>
            )}
            {state === "success" && (
              <>
                <path d="M28 44 Q32 40 36 44" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M44 44 Q48 40 52 44" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M31 53 Q40 61 49 53" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                {/* Stars */}
                <text x="14" y="28" fontSize="8" fill="white" opacity="0.7">✦</text>
                <text x="61" y="24" fontSize="7" fill="white" opacity="0.65">✦</text>
              </>
            )}
            {state === "thinking" && (
              <>
                <path d="M29 44 Q33 41 37 44" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M43 44 Q47 41 51 44" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                {/* Thought dots */}
                <circle cx="56" cy="27" r="2.2" fill="white" opacity="0.55" />
                <circle cx="62" cy="20" r="2.8" fill="white" opacity="0.6" />
                <circle cx="68" cy="13" r="3.2" fill="white" opacity="0.65" />
              </>
            )}
            {state === "running" && (
              <>
                <circle cx="32" cy="43" r="5" fill="white" />
                <circle cx="48" cy="43" r="5" fill="white" />
                <circle cx="33" cy="43" r="2.5" fill="#100820" />
                <circle cx="49" cy="43" r="2.5" fill="#100820" />
                {/* energy arcs */}
                <path d="M11 38 Q5 40 11 42" stroke={cfg.color} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6" />
                <path d="M69 38 Q75 40 69 42" stroke={cfg.color} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6" />
              </>
            )}
            {state === "idle" && (
              <>
                {/* Soft calm eyes */}
                <circle cx="32" cy="43" r="4.5" fill="white" opacity="0.9" />
                <circle cx="48" cy="43" r="4.5" fill="white" opacity="0.9" />
                <circle cx="33" cy="43" r="2" fill="#100820" />
                <circle cx="49" cy="43" r="2" fill="#100820" />
                {/* micro smile */}
                <path d="M36 52 Q40 55 44 52" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6" />
              </>
            )}

            {/* Drip */}
            <path d="M37 64 Q37 72 40 75 Q43 72 43 64" fill={cfg.color} opacity="0.5" />
          </motion.svg>

          {/* Core inner glow pulse */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: cfg.glow }}
            animate={{ opacity: state === "running" ? [0.06, 0.14, 0.06] : [0.03, 0.07, 0.03] }}
            transition={{ duration: state === "running" ? 0.3 : 1.8, repeat: Infinity }}
          />
        </motion.div>

        {/* ── Orbiting energy dots (running) ── */}
        <AnimatePresence>
          {state === "running" && [0, 120, 240].map((startDeg, i) => (
            <motion.div
              key={`orbit-${i}`}
              className="absolute rounded-full"
              style={{
                width: 7, height: 7,
                background: cfg.color,
                boxShadow: `0 0 10px ${cfg.color}, 0 0 4px ${cfg.color}`,
                top: "50%", left: "50%",
                marginTop: -3.5, marginLeft: -3.5,
              }}
              initial={{ opacity: 0 }}
              animate={{
                rotate: [startDeg, startDeg + 360],
                x: [82 * Math.cos((startDeg * Math.PI) / 180),
                    82 * Math.cos(((startDeg + 360) * Math.PI) / 180)],
                y: [82 * Math.sin((startDeg * Math.PI) / 180),
                    82 * Math.sin(((startDeg + 360) * Math.PI) / 180)],
                opacity: [0.9, 0.9],
              }}
              transition={{ duration: 1.5 + i * 0.2, repeat: Infinity, ease: "linear" }}
            />
          ))}
        </AnimatePresence>

        {/* ── Sparkle burst (success) ── */}
        <AnimatePresence>
          {state === "success" && SPARKLES.map((sp, i) => (
            <motion.div
              key={`sparkle-${i}`}
              className="absolute rounded-full"
              style={{
                width: 6, height: 6,
                background: cfg.color,
                boxShadow: `0 0 8px ${cfg.color}`,
                top: "50%", left: "50%",
              }}
              initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
              animate={{
                scale: [0, 1.4, 0],
                x: [0, sp.x],
                y: [0, sp.y],
                opacity: [1, 1, 0],
              }}
              transition={{ duration: 0.7, delay: sp.delay, repeat: Infinity, repeatDelay: 2 }}
            />
          ))}
        </AnimatePresence>

        {/* ── Thinking dots above (thinking) ── */}
        <AnimatePresence>
          {state === "thinking" && [0, 1, 2].map((i) => (
            <motion.div
              key={`think-${i}`}
              className="absolute rounded-full"
              style={{
                width: 6 + i * 2, height: 6 + i * 2,
                background: `${cfg.color}80`,
                top: `${28 - i * 7}%`,
                right: `${15 + i * 0}%`,
              }}
              animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.8, 1.1, 0.8] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </AnimatePresence>

        {/* ── Hover ripple ── */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              className="absolute rounded-full border"
              style={{ borderColor: `${cfg.glow}40` }}
              initial={{ width: 100, height: 100, opacity: 0.8 }}
              animate={{ width: 220, height: 220, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── State label ── */}
      <motion.div
        className="flex items-center gap-2"
        animate={{ opacity: 1 }}
        key={state}
        initial={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        {(state === "running" || state === "thinking") && (
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: cfg.color }}
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: state === "running" ? 0.4 : 0.8, repeat: Infinity }}
          />
        )}
        <span
          className="text-xs font-bold tracking-[0.25em] uppercase"
          style={{ color: cfg.color }}
        >
          {cfg.label}
        </span>
        {(state === "running" || state === "thinking") && (
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: cfg.color }}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: state === "running" ? 0.4 : 0.8, repeat: Infinity }}
          />
        )}
      </motion.div>
    </div>
  );
}
