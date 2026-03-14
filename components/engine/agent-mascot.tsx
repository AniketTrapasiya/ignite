"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import Image from "next/image";

export type EngineState = "idle" | "thinking" | "running" | "success" | "error";

interface AgentMascotProps {
  state: EngineState;
}

// ── State config ────────────────────────────────────────────────────────────
const STATE_CONFIG = {
  idle:     { color: "#7c3aed", glow: "#7c3aed", label: "READY"    },
  thinking: { color: "#a855f7", glow: "#a855f7", label: "THINKING" },
  running:  { color: "#f97316", glow: "#f97316", label: "RUNNING"  },
  success:  { color: "#22c55e", glow: "#22c55e", label: "DONE"     },
  error:    { color: "#ef4444", glow: "#ef4444", label: "ERROR"    },
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
  { x: -70, y: -75, delay: 0    },
  { x:  70, y: -70, delay: 0.08 },
  { x: -85, y:   5, delay: 0.16 },
  { x:  85, y:  10, delay: 0.24 },
  { x: -55, y:  80, delay: 0.12 },
  { x:  58, y:  78, delay: 0.2  },
];

// ── Body animation variants ──────────────────────────────────────────────────
type BodyAnim = {
  animate:    Record<string, unknown>;
  transition: Record<string, unknown>;
};

function getBodyAnim(state: EngineState): BodyAnim {
  switch (state) {
    case "idle":
      return {
        animate:    { y: [0, -10, 0], scale: [1, 1.02, 1] },
        transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
      };
    case "thinking":
      return {
        animate:    { rotate: [0, -5, 5, -4, 4, -2, 2, 0], scale: [1, 1.04, 1] },
        transition: { duration: 0.7, repeat: Infinity, ease: "easeInOut" },
      };
    case "running":
      return {
        animate:    { x: [0, -4, 4, -3, 3, -4, 4, 0], y: [0, -3, 3, -2, 2, 0] },
        transition: { duration: 0.2, repeat: Infinity },
      };
    case "success":
      return {
        animate:    { y: [0, -40, -8, -25, 0, -10, 0], scale: [1, 1.15, 0.94, 1.1, 1, 1.04, 1] },
        transition: { duration: 0.9, times: [0, 0.25, 0.4, 0.55, 0.75, 0.88, 1], repeat: 2, repeatDelay: 1.5 },
      };
    case "error":
      return {
        animate:    { x: [0, -12, 12, -9, 9, -6, 6, -3, 3, 0] },
        transition: { duration: 0.5, repeat: 4, repeatDelay: 1 },
      };
    default:
      return { animate: {}, transition: {} };
  }
}

// ── Image glow / filter animation per state ──────────────────────────────────
type FilterAnim = {
  animate:    Record<string, unknown>;
  transition: Record<string, unknown>;
};

function getFilterAnim(state: EngineState): FilterAnim {
  switch (state) {
    case "thinking":
      return {
        animate: {
          filter: [
            "drop-shadow(0 0 18px #a855f780) brightness(1.05)",
            "drop-shadow(0 0 34px #a855f7cc) brightness(1.2)",
            "drop-shadow(0 0 18px #a855f780) brightness(1.05)",
          ],
        },
        transition: { duration: 1.8, repeat: Infinity },
      };
    case "running":
      return {
        animate: {
          filter: [
            "drop-shadow(0 0 20px #f9731680) hue-rotate(200deg) brightness(1.1)",
            "drop-shadow(0 0 42px #f97316cc) hue-rotate(200deg) brightness(1.28)",
            "drop-shadow(0 0 20px #f9731680) hue-rotate(200deg) brightness(1.1)",
          ],
        },
        transition: { duration: 0.4, repeat: Infinity },
      };
    case "success":
      return {
        animate: {
          filter: [
            "drop-shadow(0 0 24px #22c55e80) hue-rotate(120deg) brightness(1.12)",
            "drop-shadow(0 0 50px #22c55ecc) hue-rotate(120deg) brightness(1.38)",
            "drop-shadow(0 0 24px #22c55e80) hue-rotate(120deg) brightness(1.12)",
          ],
        },
        transition: { duration: 0.7, repeat: Infinity },
      };
    case "error":
      return {
        animate:    { filter: "drop-shadow(0 0 28px #ef444499) hue-rotate(300deg) brightness(0.9)" },
        transition: {},
      };
    default: // idle
      return {
        animate:    { filter: "drop-shadow(0 0 22px #7c3aed99)" },
        transition: {},
      };
  }
}

export default function AgentMascot({ state }: AgentMascotProps) {
  const cfg = STATE_CONFIG[state];
  const [speechIndex, setSpeechIndex]   = useState(0);
  const [isHovered,   setIsHovered]     = useState(false);
  const bodyAnim   = getBodyAnim(state);
  const filterAnim = getFilterAnim(state);

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
              background:   `${cfg.glow}12`,
              borderColor:  `${cfg.glow}30`,
              color:         cfg.color,
            }}
          >
            💭 {SPEECH[state][speechIndex]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Main chamber ── */}
      <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>

        {/* Ambient background glow */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle, ${cfg.glow}25 0%, transparent 70%)` }}
          animate={{
            opacity: state === "running" ? [0.6, 1, 0.6] : state === "thinking" ? [0.4, 0.85, 0.4] : [0.3, 0.55, 0.3],
          }}
          transition={{ duration: state === "running" ? 0.5 : 2, repeat: Infinity }}
        />

        {/* ── PNG slime chamber with state animations ── */}
        <motion.div
          className="relative z-10"
          style={{ width: 210, height: 210 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          animate={bodyAnim.animate as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          transition={bodyAnim.transition as any}
          whileHover={{ scale: 1.06 }}
        >
          {/* Behind-image glow pulse */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle, ${cfg.glow}35 0%, transparent 65%)`,
              filter:      "blur(14px)",
            }}
            animate={{
              opacity: state === "running" ? [0.5, 1, 0.5] : state === "success" ? [0.7, 1, 0.7] : [0.3, 0.65, 0.3],
              scale:   state === "running" ? [0.9, 1.1, 0.9] : state === "success" ? [1, 1.14, 1] : [0.95, 1.05, 0.95],
            }}
            transition={{
              duration: state === "running" ? 0.45 : state === "success" ? 0.7 : 2,
              repeat:   Infinity,
            }}
          />

          {/* PNG image with filter animation */}
          <motion.div
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            animate={filterAnim.animate as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            transition={filterAnim.transition as any}
          >
            <Image
              src="/cental_chamber.png"
              alt="AutoFlow Engine"
              width={210}
              height={210}
              priority
              style={{ objectFit: "contain" }}
            />
          </motion.div>

          {/* Error red flash overlay */}
          <AnimatePresence>
            {state === "error" && (
              <motion.div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, #ef444435 0%, transparent 65%)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.9, 0, 0.7, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, repeat: 3 }}
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Orbiting energy dots (running) ── */}
        <AnimatePresence>
          {state === "running" && [0, 120, 240].map((startDeg, i) => (
            <motion.div
              key={`orbit-${i}`}
              className="absolute rounded-full"
              style={{
                width: 8, height: 8,
                background:  cfg.color,
                boxShadow:  `0 0 12px ${cfg.color}, 0 0 5px ${cfg.color}`,
                top: "50%", left: "50%",
                marginTop: -4, marginLeft: -4,
              }}
              initial={{ opacity: 0 }}
              animate={{
                rotate: [startDeg, startDeg + 360],
                x: [
                  95 * Math.cos((startDeg * Math.PI) / 180),
                  95 * Math.cos(((startDeg + 360) * Math.PI) / 180),
                ],
                y: [
                  95 * Math.sin((startDeg * Math.PI) / 180),
                  95 * Math.sin(((startDeg + 360) * Math.PI) / 180),
                ],
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
                width: 7, height: 7,
                background: cfg.color,
                boxShadow:  `0 0 10px ${cfg.color}`,
                top: "50%", left: "50%",
              }}
              initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
              animate={{
                scale:   [0, 1.6, 0],
                x:       [0, sp.x],
                y:       [0, sp.y],
                opacity: [1, 1, 0],
              }}
              transition={{ duration: 0.8, delay: sp.delay, repeat: Infinity, repeatDelay: 2 }}
            />
          ))}
        </AnimatePresence>

        {/* ── Thinking dots (thinking) ── */}
        <AnimatePresence>
          {state === "thinking" && [0, 1, 2].map((i) => (
            <motion.div
              key={`think-${i}`}
              className="absolute rounded-full"
              style={{
                width:  7 + i * 2, height: 7 + i * 2,
                background: `${cfg.color}90`,
                top:   `${20 - i * 7}%`,
                right: "12%",
              }}
              animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.8, 1.15, 0.8] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18 }}
            />
          ))}
        </AnimatePresence>

        {/* ── Hover ripple ── */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              className="absolute rounded-full border"
              style={{ borderColor: `${cfg.glow}50` }}
              initial={{ width: 120, height: 120, opacity: 0.9 }}
              animate={{ width: 240, height: 240, opacity: 0 }}
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
