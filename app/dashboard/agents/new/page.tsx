import AgentBuilder from "@/components/agents/agent-builder";
import Link from "next/link";

export default function NewAgentPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back */}
      <div className="mb-6">
        <Link
          href="/dashboard/agents"
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          ← Back to Agents
        </Link>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
          style={{
            background: "linear-gradient(135deg,rgba(99,102,241,0.3),rgba(168,85,247,0.3))",
            border: "1px solid rgba(168,85,247,0.3)",
            boxShadow: "0 0 40px rgba(168,85,247,0.15)",
          }}
        >
          🤖
        </div>
        <h1 className="text-2xl font-bold text-white">Create Agent</h1>
        <p className="text-white/40 text-sm mt-1">
          Build an autonomous AI that reacts to events and takes action automatically
        </p>
      </div>

      <AgentBuilder />
    </div>
  );
}
