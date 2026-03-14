"use client";

interface AlertProps {
  message: string;
  type?: "error" | "success" | "warning" | "info";
  onDismiss?: () => void;
}

const styles = {
  error: "bg-red-50 text-red-700 border-red-200",
  success: "bg-green-50 text-green-700 border-green-200",
  warning: "bg-yellow-50 text-yellow-700 border-yellow-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
};

export function Alert({ message, type = "error", onDismiss }: AlertProps) {
  if (!message) return null;

  return (
    <div
      className={`animate-fade-in flex items-center justify-between px-4 py-3 rounded-lg border text-sm mb-4 ${styles[type]}`}
      role="alert"
      aria-live="polite"
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-3 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
