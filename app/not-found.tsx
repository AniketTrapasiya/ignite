import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#07070f] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div
          className="text-8xl font-black mb-4 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"
        >
          404
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
        <p className="text-white/40 text-sm mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
          style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", boxShadow: "0 0 24px rgba(168,85,247,0.3)" }}
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
