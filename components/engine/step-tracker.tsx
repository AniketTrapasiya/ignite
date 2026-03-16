"use client";

interface Step {
  index: number;
  text: string;
  status: "done" | "active" | "pending";
}

interface StepTrackerProps {
  chunks: string[];
  isDone: boolean;
  isRunning: boolean;
}

function parseSteps(chunks: string[]): { steps: Step[]; hasResult: boolean; resultText: string } {
  const full = chunks.join("");
  const lines = full.split("\n");
  const stepLines: string[] = [];
  let hasResult = false;
  let resultText = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("STEP:")) {
      stepLines.push(trimmed.replace("STEP:", "").trim());
    }
    if (trimmed.startsWith("RESULT:")) {
      hasResult = true;
      resultText = trimmed.replace("RESULT:", "").trim();
    }
  }

  const steps: Step[] = stepLines.map((text, i) => ({
    index: i,
    text,
    status: i < stepLines.length - 1 ? "done" : hasResult ? "done" : "active",
  }));

  return { steps, hasResult, resultText };
}

export default function StepTracker({ chunks, isDone, isRunning }: StepTrackerProps) {
  const { steps, hasResult, resultText } = parseSteps(chunks);

  if (steps.length === 0 && !isRunning) return null;

  return (
    <div className="w-full rounded-xl border border-white/8 bg-white/2 p-4 space-y-3">
      <p className="text-xs text-white/30 uppercase tracking-widest">Progress</p>

      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.index} className="flex items-start gap-3">
            {/* Step indicator */}
            <div className="shrink-0 mt-0.5">
              {step.status === "done" ? (
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : step.status === "active" ? (
                <div className="w-5 h-5 rounded-full bg-orange-500/20 border border-orange-500/50 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border border-white/10 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                </div>
              )}
            </div>

            {/* Step text */}
            <p
              className={`text-sm leading-relaxed ${step.status === "done"
                ? "text-white/60"
                : step.status === "active"
                  ? "text-white"
                  : "text-white/25"
                }`}
            >
              {step.text}
            </p>
          </div>
        ))}

        {/* Running indicator when no steps yet */}
        {isRunning && steps.length === 0 && (
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-orange-500/20 border border-orange-500/50 flex items-center justify-center shrink-0">
              <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            </div>
            <p className="text-sm text-white/50 animate-pulse">Engine starting up...</p>
          </div>
        )}

        {/* Result row */}
        {hasResult && (
          <>
            {/* Connector line */}
            {steps.length > 0 && (
              <div className="ml-2.5 w-px h-3 bg-emerald-500/30" />
            )}
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-500/30 border border-emerald-400/50 flex items-center justify-center shrink-0">
                <span className="text-[9px] text-emerald-300 font-bold">✓</span>
              </div>
              <p className="text-sm text-emerald-300 font-medium leading-relaxed">{resultText}</p>
            </div>
          </>
        )}

        {/* Progress bar */}
        {(isRunning || isDone) && steps.length > 0 && (
          <div className="mt-2 h-0.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isDone ? "bg-emerald-500" : "bg-orange-500"
                }`}
              style={{
                width: isDone ? "100%" : `${Math.min(90, (steps.length / Math.max(steps.length + 1, 3)) * 100)}%`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
