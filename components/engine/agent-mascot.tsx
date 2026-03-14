"use client";

export type EngineState = "idle" | "thinking" | "running" | "success" | "error";

interface AgentMascotProps {
  state: EngineState;
}

const STATE_CONFIG = {
  idle: {
    label: "READY",
    color: "#7c3aed",
    glow: "#7c3aed",
    animation: "animate-[float_3s_ease-in-out_infinite]",
  },
  thinking: {
    label: "THINKING",
    color: "#a855f7",
    glow: "#a855f7",
    animation: "animate-[spin_3s_linear_infinite]",
  },
  running: {
    label: "RUNNING",
    color: "#f97316",
    glow: "#f97316",
    animation: "animate-[shake_0.3s_ease-in-out_infinite]",
  },
  success: {
    label: "DONE",
    color: "#22c55e",
    glow: "#22c55e",
    animation: "animate-[bounce_0.8s_ease-in-out_3]",
  },
  error: {
    label: "ERROR",
    color: "#ef4444",
    glow: "#ef4444",
    animation: "animate-[shake_0.4s_ease-in-out_5]",
  },
};

export default function AgentMascot({ state }: AgentMascotProps) {
  const cfg = STATE_CONFIG[state];

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      {/* Multi-ring chamber */}
      <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>

        {/* Outermost ambient glow */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-700"
          style={{
            background: `radial-gradient(circle, ${cfg.glow}18 0%, transparent 65%)`,
          }}
        />

        {/* Ring 3 — outermost dashed ring */}
        <div
          className={`absolute rounded-full border transition-all duration-700 ${
            state === "running" ? "animate-spin" : ""
          }`}
          style={{
            width: 190,
            height: 190,
            borderColor: `${cfg.glow}20`,
            borderWidth: "1px",
            borderStyle: state === "running" ? "dashed" : "solid",
            animationDuration: "4s",
          }}
        />

        {/* Ring 2 */}
        <div
          className={`absolute rounded-full border transition-all duration-700 ${
            state === "thinking" ? "animate-[spin_2s_linear_infinite_reverse]" : ""
          }`}
          style={{
            width: 162,
            height: 162,
            borderColor: `${cfg.glow}35`,
            borderWidth: "1.5px",
            borderStyle: "solid",
            boxShadow: `0 0 12px ${cfg.glow}20`,
          }}
        />

        {/* Ring 1 — inner glow ring */}
        <div
          className={`absolute rounded-full border transition-all duration-700 ${
            state === "running" || state === "thinking" ? "animate-pulse" : ""
          }`}
          style={{
            width: 138,
            height: 138,
            borderColor: `${cfg.glow}55`,
            borderWidth: "1.5px",
            background: `radial-gradient(circle, ${cfg.glow}12 0%, transparent 70%)`,
            boxShadow: `0 0 20px ${cfg.glow}30, inset 0 0 20px ${cfg.glow}10`,
          }}
        />

        {/* Inner chamber */}
        <div
          className="relative flex items-center justify-center rounded-full transition-all duration-500 z-10"
          style={{
            width: 110,
            height: 110,
            background: `radial-gradient(circle at 40% 35%, ${cfg.glow}25, #0a0818 70%)`,
            border: `2px solid ${cfg.glow}60`,
            boxShadow: `0 0 30px ${cfg.glow}40, inset 0 0 20px ${cfg.glow}15`,
          }}
        >
          {/* Slime character */}
          <svg
            width="72"
            height="72"
            viewBox="0 0 80 80"
            className={`transition-all duration-300 ${cfg.animation}`}
          >
            {/* Glow filter */}
            <defs>
              <filter id={`glow-${state}`}>
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Body blob */}
            <path
              d="M14 48 Q14 28 40 24 Q66 28 66 48 Q66 62 40 66 Q14 62 14 48"
              fill={cfg.color}
              opacity="0.93"
              filter={`url(#glow-${state})`}
            />
            <ellipse cx="40" cy="50" rx="26" ry="18" fill={cfg.color} opacity="0.93" />

            {/* Body highlight */}
            <ellipse cx="31" cy="33" rx="7" ry="4.5" fill="white" opacity="0.22" />

            {/* Eyes */}
            {state === "error" ? (
              <>
                <line x1="30" y1="41" x2="36" y2="47" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="36" y1="41" x2="30" y2="47" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="44" y1="41" x2="50" y2="47" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="50" y1="41" x2="44" y2="47" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
              </>
            ) : state === "success" ? (
              <>
                <path d="M28 44 Q32 40 36 44" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M44 44 Q48 40 52 44" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M31 53 Q40 60 49 53" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
                {/* Sparkles */}
                <circle cx="18" cy="24" r="2" fill="white" opacity="0.8" />
                <circle cx="62" cy="22" r="2.5" fill="white" opacity="0.7" />
                <circle cx="14" cy="38" r="1.5" fill="white" opacity="0.6" />
              </>
            ) : state === "thinking" ? (
              <>
                <path d="M28 44 Q32 41 36 44" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M44 44 Q48 41 52 44" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <circle cx="55" cy="28" r="2" fill="white" opacity="0.6" />
                <circle cx="61" cy="22" r="2.5" fill="white" opacity="0.65" />
                <circle cx="67" cy="15" r="3" fill="white" opacity="0.7" />
              </>
            ) : state === "running" ? (
              <>
                <circle cx="32" cy="43" r="4.5" fill="white" />
                <circle cx="48" cy="43" r="4.5" fill="white" />
                <circle cx="33" cy="43" r="2.5" fill="#120c24" />
                <circle cx="49" cy="43" r="2.5" fill="#120c24" />
                {/* Energy lines */}
                <line x1="14" y1="40" x2="10" y2="38" stroke="white" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
                <line x1="66" y1="40" x2="70" y2="38" stroke="white" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
              </>
            ) : (
              <>
                <circle cx="32" cy="43" r="4" fill="white" opacity="0.9" />
                <circle cx="48" cy="43" r="4" fill="white" opacity="0.9" />
                <circle cx="33" cy="43" r="2" fill="#120c24" />
                <circle cx="49" cy="43" r="2" fill="#120c24" />
              </>
            )}

            {/* Drip */}
            <path
              d="M37 64 Q37.5 70 40 73 Q42.5 70 43 64"
              fill={cfg.color}
              opacity="0.55"
            />
          </svg>

          {/* Inner core pulse */}
          <div
            className={`absolute inset-0 rounded-full ${state === "running" ? "animate-ping" : "animate-pulse"}`}
            style={{
              background: cfg.glow,
              opacity: state === "running" ? 0.08 : 0.04,
            }}
          />
        </div>

        {/* Orbiting particles (running state) */}
        {state === "running" && (
          <>
            {[0, 120, 240].map((startDeg, i) => (
              <div
                key={i}
                className="absolute rounded-full animate-spin"
                style={{
                  width: 7,
                  height: 7,
                  background: cfg.color,
                  top: "50%",
                  left: "50%",
                  marginTop: -3.5,
                  marginLeft: -3.5,
                  transformOrigin: "0 0",
                  transform: `rotate(${startDeg}deg) translateX(82px)`,
                  animationDuration: `${1.8 + i * 0.3}s`,
                  opacity: 0.75,
                  boxShadow: `0 0 8px ${cfg.color}`,
                }}
              />
            ))}
          </>
        )}

        {/* Success sparkles */}
        {state === "success" && (
          <>
            {[45, 135, 225, 315].map((deg, i) => (
              <div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full animate-ping"
                style={{
                  background: cfg.color,
                  top: `${50 + 45 * Math.sin((deg * Math.PI) / 180)}%`,
                  left: `${50 + 45 * Math.cos((deg * Math.PI) / 180)}%`,
                  animationDuration: `${0.8 + i * 0.1}s`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </>
        )}
      </div>

      {/* State label */}
      <div className="flex items-center gap-2">
        {(state === "running" || state === "thinking") && (
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: cfg.color }}
          />
        )}
        <span
          className="text-xs font-bold tracking-[0.25em] uppercase transition-all duration-300"
          style={{ color: cfg.color }}
        >
          {cfg.label}
        </span>
        {(state === "running" || state === "thinking") && (
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: cfg.color, animationDelay: "0.3s" }}
          />
        )}
      </div>
    </div>
  );
}
