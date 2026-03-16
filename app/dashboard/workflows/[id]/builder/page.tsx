/**
 * app/dashboard/workflows/[id]/builder/page.tsx
 * Visual node-graph editor for a single workflow.
 * React Flow requires client-only rendering → dynamic import.
 */
"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import type { Edge } from "@xyflow/react";
import type { WorkflowNode } from "@/lib/workflow-executor";

const WorkflowBuilder = dynamic(
  () => import("@/components/workflows/WorkflowBuilder").then((m) => m.WorkflowBuilder),
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm">Loading canvas…</div> }
);

interface WorkflowData {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: Edge[];
  status: string;
}

export default function BuilderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/workflows/${id}`)
      .then((r) => r.json())
      .then((d: { workflow?: WorkflowData; error?: string }) => {
        if (d.workflow) setWorkflow(d.workflow);
        else setError(d.error ?? "Not found");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (nodes: WorkflowNode[], edges: Edge[]) => {
    const res = await fetch(`/api/workflows/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes, edges }),
    });
    if (!res.ok) throw new Error("Save failed");
    setWorkflow((w) => w ? { ...w, nodes, edges } : w);
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-500">Loading…</div>
  );
  if (error) return (
    <div className="flex h-screen items-center justify-center bg-neutral-950 text-red-400">
      <div className="text-center">
        <p className="text-lg font-medium mb-2">{error}</p>
        <button onClick={() => router.push("/dashboard/workflows")} className="text-sm underline">← Back to workflows</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-neutral-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 flex-shrink-0">
        <button
          onClick={() => router.push("/dashboard/workflows")}
          className="text-neutral-400 hover:text-white text-sm transition-colors"
        >
          ← Workflows
        </button>
        <div className="h-4 w-px bg-neutral-700" />
        <h1 className="text-sm font-semibold text-white">{workflow?.name ?? "Untitled"}</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 capitalize">
          {workflow?.status?.toLowerCase() ?? "draft"}
        </span>
      </div>

      {/* Builder canvas — fills remaining height */}
      <div className="flex-1 flex overflow-hidden">
        <WorkflowBuilder
          workflowId={id}
          initialNodes={workflow?.nodes ?? []}
          initialEdges={workflow?.edges ?? []}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
