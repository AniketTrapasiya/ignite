/**
 * components/workflows/WorkflowBuilder.tsx
 * Visual node-based workflow editor powered by @xyflow/react.
 * Features: drag-and-drop, keyboard shortcuts, auto-layout, run log panel,
 *           undo/redo, snap-to-grid, node duplication, palette search.
 */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, ReactFlowProvider,
  type Connection, type Edge, type Node, type ReactFlowInstance,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "./nodes";
import { NodeInspector } from "./NodeInspector";
import { WorkflowNode, NodeType } from "@/lib/workflow-executor";
import { Zap, Bot, Globe, GitBranch, Cog, Clock, Shuffle, Send } from "lucide-react";

// ── Palette definitions ───────────────────────────────────────────────────────
const PALETTE_NODES: {
  type: NodeType; label: string; icon: typeof Zap; colorKey: string;
  defaultData: Record<string, unknown>; description: string;
}[] = [
    { type: "trigger", label: "Trigger", icon: Zap, colorKey: "yellow", defaultData: { triggerType: "manual" }, description: "Start of workflow" },
    { type: "llm", label: "AI / LLM", icon: Bot, colorKey: "blue", defaultData: { model: "gemini-2.5-flash", prompt: "" }, description: "Generate text with AI" },
    { type: "http", label: "HTTP", icon: Globe, colorKey: "green", defaultData: { method: "GET", url: "" }, description: "Call any REST API" },
    { type: "condition", label: "Condition", icon: GitBranch, colorKey: "purple", defaultData: { left: "", operator: "==", right: "" }, description: "Branch on true / false" },
    { type: "action", label: "Action", icon: Cog, colorKey: "orange", defaultData: { actionType: "log", message: "" }, description: "Email, Slack, Telegram…" },
    { type: "delay", label: "Delay", icon: Clock, colorKey: "neutral", defaultData: { delayMs: 5000 }, description: "Wait before next step" },
    { type: "transform", label: "Transform", icon: Shuffle, colorKey: "cyan", defaultData: { expression: "input" }, description: "Reshape / map data" },
    { type: "output", label: "Output", icon: Send, colorKey: "pink", defaultData: { format: "json" }, description: "Final result / response" },
  ];

const PALETTE_COLORS: Record<string, string> = {
  yellow: "border-yellow-500/60 text-yellow-400", blue: "border-blue-500/60 text-blue-400",
  green: "border-green-500/60 text-green-400", purple: "border-purple-500/60 text-purple-400",
  orange: "border-orange-500/60 text-orange-400", neutral: "border-neutral-500/60 text-neutral-400",
  cyan: "border-cyan-500/60 text-cyan-400", pink: "border-pink-500/60 text-pink-400",
};

let nodeCounter = 1;

// ── Edge styles ───────────────────────────────────────────────────────────────
const EDGE_DEFAULTS: Partial<Edge> = {
  animated: true,
  style: { stroke: "#6366f1", strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1", width: 18, height: 18 },
};

// ── Auto-layout (simple top-down DAG) ────────────────────────────────────────
function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  const childrenOf: Record<string, string[]> = {};
  const parentOf: Record<string, string[]> = {};
  nodes.forEach((n) => { childrenOf[n.id] = []; parentOf[n.id] = []; });
  edges.forEach((e) => {
    childrenOf[e.source]?.push(e.target);
    parentOf[e.target]?.push(e.source);
  });

  // Topological sort
  const visited = new Set<string>();
  const order: string[] = [];
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    (childrenOf[id] ?? []).forEach(visit);
    order.unshift(id);
  };
  nodes.forEach((n) => { if ((parentOf[n.id] ?? []).length === 0) visit(n.id); });
  nodes.forEach((n) => visit(n.id));

  // Assign levels
  const level: Record<string, number> = {};
  order.forEach((id) => {
    const parents = parentOf[id] ?? [];
    level[id] = parents.length === 0 ? 0 : Math.max(...parents.map((p) => (level[p] ?? 0) + 1));
  });

  // Assign column within level
  const levelCols: Record<number, number> = {};
  const col: Record<string, number> = {};
  order.forEach((id) => {
    const l = level[id] ?? 0;
    col[id] = levelCols[l] ?? 0;
    levelCols[l] = (levelCols[l] ?? 0) + 1;
  });

  // Position nodes
  const NODE_W = 220; const NODE_H = 120;
  // Centre each level
  const maxLvl = Math.max(...Object.values(level));
  const lvlWidths: Record<number, number> = {};
  for (let l = 0; l <= maxLvl; l++) lvlWidths[l] = (levelCols[l] ?? 1) * NODE_W;
  const totalWidth = Math.max(...Object.values(lvlWidths));

  return nodes.map((n) => {
    const l = level[n.id] ?? 0;
    const c = col[n.id] ?? 0;
    const lw = lvlWidths[l] ?? NODE_W;
    const xOffset = (totalWidth - lw) / 2;
    return { ...n, position: { x: xOffset + c * NODE_W, y: l * NODE_H + 50 } };
  });
}

// ── Execution log types ───────────────────────────────────────────────────────
interface StepLog { nodeId: string; nodeType: string; status: string; input?: unknown; output?: unknown; error?: string; startedAt: string; completedAt?: string }
interface ExecutionRecord { id: string; status: string; createdAt: string; completedAt?: string; stepLogs: StepLog[]; output?: unknown; error?: string }

interface Props {
  workflowId: string;
  initialNodes?: WorkflowNode[];
  initialEdges?: Edge[];
  onSave?: (nodes: WorkflowNode[], edges: Edge[]) => Promise<void>;
}

// ── History (undo/redo) ───────────────────────────────────────────────────────
type Snapshot = { nodes: Node[]; edges: Edge[] };

function Builder({ workflowId, initialNodes = [], initialEdges = [], onSave }: Props) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<{ type: "info" | "success" | "error"; msg: string } | null>(null);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [activeTab, setActiveTab] = useState<"canvas" | "logs">("canvas");
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  // Undo/redo history
  const history = useRef<Snapshot[]>([]);
  const historyIdx = useRef(-1);
  const ignoreHistory = useRef(false);

  const pushHistory = useCallback((n: Node[], e: Edge[]) => {
    if (ignoreHistory.current) return;
    history.current = history.current.slice(0, historyIdx.current + 1);
    history.current.push({ nodes: n.map((x) => ({ ...x })), edges: e.map((x) => ({ ...x })) });
    historyIdx.current = history.current.length - 1;
  }, []);

  const undo = useCallback(() => {
    if (historyIdx.current <= 0) return;
    historyIdx.current--;
    const snap = history.current[historyIdx.current];
    ignoreHistory.current = true;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    ignoreHistory.current = false;
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (historyIdx.current >= history.current.length - 1) return;
    historyIdx.current++;
    const snap = history.current[historyIdx.current];
    ignoreHistory.current = true;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    ignoreHistory.current = false;
  }, [setNodes, setEdges]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) as WorkflowNode | undefined;

  // ── Connections ─────────────────────────────────────────────────────────────
  const onConnect = useCallback((connection: Connection) => {
    const newEdges = addEdge({ ...connection, ...EDGE_DEFAULTS }, edges);
    setEdges(newEdges);
    pushHistory(nodes, newEdges);
  }, [setEdges, edges, nodes, pushHistory]);

  // ── Drag-and-drop ────────────────────────────────────────────────────────────
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (!rfInstance || !reactFlowWrapper.current) return;
    const type = event.dataTransfer.getData("application/reactflow-type") as NodeType;
    const defaultData = JSON.parse(event.dataTransfer.getData("application/reactflow-data") || "{}");
    if (!type) return;
    const position = rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const id = `${type}-${nodeCounter++}`;
    const newNodes = [...nodes, { id, type, position, data: { ...defaultData }, selected: false }];
    setNodes(newNodes);
    pushHistory(newNodes, edges);
    setSelectedNodeId(id);
  }, [rfInstance, setNodes, nodes, edges, pushHistory]);

  // ── Node events ──────────────────────────────────────────────────────────────
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setCtxMenu(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setCtxMenu(null);
  }, []);

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
  }, []);

  // ── Context menu actions ─────────────────────────────────────────────────────
  const duplicateNode = (nodeId: string) => {
    const orig = nodes.find((n) => n.id === nodeId);
    if (!orig) return;
    const id = `${orig.type}-${nodeCounter++}`;
    const newNodes = [...nodes, { ...orig, id, position: { x: orig.position.x + 30, y: orig.position.y + 30 }, selected: false }];
    setNodes(newNodes);
    pushHistory(newNodes, edges);
    setCtxMenu(null);
  };

  const deleteNode = useCallback((nodeId: string) => {
    const newNodes = nodes.filter((n) => n.id !== nodeId);
    const newEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    setNodes(newNodes);
    setEdges(newEdges);
    pushHistory(newNodes, newEdges);
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    setCtxMenu(null);
  }, [nodes, edges, setNodes, setEdges, pushHistory, selectedNodeId]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeId) deleteNode(selectedNodeId);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) undo();
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) redo();
      if ((e.metaKey || e.ctrlKey) && e.key === "d") { e.preventDefault(); if (selectedNodeId) duplicateNode(selectedNodeId); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId, deleteNode, undo, redo]);

  // ── Inspector change ─────────────────────────────────────────────────────────
  const handleNodeDataChange = (id: string, data: Record<string, unknown>) => {
    const newNodes = nodes.map((n) => (n.id === id ? { ...n, data } : n));
    setNodes(newNodes);
    // Don't push to history on every keystroke — only on blur (handled below)
  };

  const handleNodeDataCommit = (id: string, data: Record<string, unknown>) => {
    const newNodes = nodes.map((n) => (n.id === id ? { ...n, data } : n));
    pushHistory(newNodes, edges);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(nodes as WorkflowNode[], edges);
      setRunStatus({ type: "success", msg: "Saved ✓" });
      setTimeout(() => setRunStatus(null), 3000);
    } catch {
      setRunStatus({ type: "error", msg: "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  // ── Run + poll ───────────────────────────────────────────────────────────────
  const handleRun = async () => {
    setRunning(true);
    setRunStatus({ type: "info", msg: "Starting…" });
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: {} }),
      });
      const data = await res.json() as { executionId?: string; error?: string };
      if (res.ok && data.executionId) {
        setRunStatus({ type: "info", msg: `Running — ${data.executionId.slice(0, 8)}…` });
        setActiveTab("logs");
        // Poll for completion
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          if (attempts > 30) { clearInterval(poll); setRunning(false); return; }
          try {
            const r2 = await fetch(`/api/workflows/${workflowId}`);
            const d2 = await r2.json() as { workflow?: { executions?: ExecutionRecord[] } };
            const execs = d2.workflow?.executions ?? [];
            setExecutions(execs);
            const latest = execs.find((e) => e.id === data.executionId);
            if (latest && ["COMPLETED", "FAILED", "CANCELLED"].includes(latest.status)) {
              clearInterval(poll);
              setRunning(false);
              setRunStatus({
                type: latest.status === "COMPLETED" ? "success" : "error",
                msg: latest.status === "COMPLETED" ? "Completed ✓" : `Failed: ${latest.error ?? "unknown"}`,
              });
            }
          } catch { clearInterval(poll); setRunning(false); }
        }, 2000);
      } else {
        setRunStatus({ type: "error", msg: `Error: ${data.error}` });
        setRunning(false);
      }
    } catch (err) {
      setRunStatus({ type: "error", msg: `Failed: ${String(err)}` });
      setRunning(false);
    }
  };

  // ── Load executions ───────────────────────────────────────────────────────────
  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}`);
      const d = await res.json() as { workflow?: { executions?: ExecutionRecord[] } };
      setExecutions(d.workflow?.executions ?? []);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => { if (activeTab === "logs") loadLogs(); }, [activeTab]);

  // ── Auto layout ───────────────────────────────────────────────────────────────
  const handleAutoLayout = () => {
    const laid = autoLayout(nodes, edges);
    setNodes(laid);
    pushHistory(laid, edges);
    setTimeout(() => rfInstance?.fitView({ padding: 0.15 }), 50);
  };

  // ── Filtered palette ──────────────────────────────────────────────────────────
  const filteredPalette = PALETTE_NODES.filter(
    (p) => !paletteSearch || p.label.toLowerCase().includes(paletteSearch.toLowerCase()) || p.description.toLowerCase().includes(paletteSearch.toLowerCase())
  );

  // ── Status badge colours ───────────────────────────────────────────────────────
  const statusColor = (s: string) => {
    if (s === "COMPLETED") return "text-green-400";
    if (s === "FAILED") return "text-red-400";
    if (s === "RUNNING") return "text-blue-400 animate-pulse";
    return "text-neutral-400";
  };

  const runStatusClasses = runStatus?.type === "success" ? "text-green-400"
    : runStatus?.type === "error" ? "text-red-400"
      : "text-neutral-400";

  // ────────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full relative" onClick={() => setCtxMenu(null)}>
      {/* ── Palette sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-48 shrink-0 bg-[#0c0c14] border-r border-white/[0.07] flex flex-col">
        <div className="p-2 border-b border-white/[0.07]">
          <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-2 px-1">Nodes</p>
          <input
            value={paletteSearch}
            onChange={(e) => setPaletteSearch(e.target.value)}
            placeholder="Search…"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 placeholder-white/20 focus:outline-none focus:border-indigo-400/50"
          />
        </div>
        <div className="flex-1 p-2 space-y-1 overflow-y-auto">
          {filteredPalette.map((p) => {
            const colClasses = PALETTE_COLORS[p.colorKey] ?? PALETTE_COLORS.neutral;
            return (
              <div
                key={p.type}
                className={`flex items-start gap-2 px-2.5 py-2.5 rounded-xl border ${colClasses} bg-white/3 cursor-grab active:cursor-grabbing hover:bg-white/[0.07] transition-all`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/reactflow-type", p.type);
                  e.dataTransfer.setData("application/reactflow-data", JSON.stringify(p.defaultData));
                  e.dataTransfer.effectAllowed = "move";
                }}
              >
                <p.icon className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white/80 leading-none">{p.label}</div>
                  <div className="text-[10px] text-white/30 leading-relaxed mt-0.5">{p.description}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Keyboard shortcut hint */}
        <div className="p-2 border-t border-white/6 space-y-0.5">
          {[["Del", "Delete node"], ["⌘S", "Save"], ["⌘Z", "Undo"], ["⌘D", "Duplicate"]].map(([k, d]) => (
            <div key={k} className="flex justify-between text-[10px] text-white/20">
              <kbd className="font-mono">{k}</kbd><span>{d}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-[#0c0c14] border-b border-white/[0.07] shrink-0">
          {/* Tabs */}
          <div className="flex rounded-lg bg-white/4 border border-white/[0.07] p-0.5 mr-1">
            {(["canvas", "logs"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${activeTab === tab
                  ? "bg-indigo-600 text-white"
                  : "text-white/40 hover:text-white/70"
                  }`}
              >
                {tab === "canvas" ? "🎨 Canvas" : "📋 Run Log"}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || !onSave}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white/90 text-xs font-medium transition-colors"
          >
            {saving ? "Saving…" : "💾 Save"}
          </button>

          {/* Run */}
          <button
            onClick={handleRun}
            disabled={running}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white/90 text-xs font-medium transition-colors"
          >
            {running ? "Running…" : "▶ Run"}
          </button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* Undo/Redo */}
          <button onClick={undo} title="Undo" className="px-2 py-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 text-xs transition-colors">↩</button>
          <button onClick={redo} title="Redo" className="px-2 py-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 text-xs transition-colors">↪</button>

          {/* Auto-layout */}
          <button
            onClick={handleAutoLayout}
            title="Auto-layout"
            className="px-2 py-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 text-xs transition-colors"
          >
            ⊞ Layout
          </button>

          {/* Fit view */}
          <button
            onClick={() => rfInstance?.fitView({ padding: 0.15 })}
            title="Fit view"
            className="px-2 py-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 text-xs transition-colors"
          >
            ⊡ Fit
          </button>

          {/* Snap toggle */}
          <button
            onClick={() => setSnapToGrid((v) => !v)}
            className={`px-2 py-1.5 rounded-lg text-xs transition-colors ${snapToGrid ? "text-indigo-400 bg-indigo-500/10" : "text-white/30 hover:bg-white/5"
              }`}
          >
            ⊹ Snap
          </button>

          {/* Status message */}
          {runStatus && <span className={`text-xs ml-1 ${runStatusClasses}`}>{runStatus.msg}</span>}

          {/* Node / edge count */}
          <div className="ml-auto flex items-center gap-3 text-[10px] text-white/20">
            <span>{nodes.length} node{nodes.length !== 1 ? "s" : ""}</span>
            <span>{edges.length} edge{edges.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={reactFlowWrapper}
          className="flex-1 relative"
          style={{ display: activeTab === "canvas" ? "block" : "none" }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodeContextMenu={onNodeContextMenu}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid={snapToGrid}
            snapGrid={[20, 20]}
            defaultEdgeOptions={EDGE_DEFAULTS}
            style={{ background: "#080810" }}
          >
            <Background color="rgba(255,255,255,0.04)" gap={24} size={1} />
            <Controls
              style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.08)" }}
              showInteractive={false}
            />
            <MiniMap
              style={{ background: "#0c0c14", border: "1px solid rgba(255,255,255,0.07)" }}
              nodeColor={(n) => {
                const cm: Record<string, string> = {
                  trigger: "#eab308", llm: "#3b82f6", http: "#22c55e",
                  condition: "#a855f7", action: "#f97316", delay: "#737373",
                  transform: "#06b6d4", output: "#ec4899",
                };
                return cm[n.type ?? ""] ?? "#555";
              }}
              maskColor="rgba(0,0,0,0.7)"
            />
          </ReactFlow>

          {/* Empty state */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none text-center">
              <span className="text-5xl opacity-20">🔗</span>
              <p className="text-sm text-white/25">Drag nodes from the left panel to get started</p>
              <p className="text-xs text-white/15">or use ⊞ Layout after pasting AI-generated nodes</p>
            </div>
          )}
        </div>

        {/* Run Log tab */}
        {activeTab === "logs" && (
          <div className="flex-1 overflow-y-auto bg-[#080810] p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white/70">Execution History</h3>
              <button
                onClick={loadLogs}
                disabled={loadingLogs}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 transition-colors disabled:opacity-40"
              >
                {loadingLogs ? "Loading…" : "↺ Refresh"}
              </button >
            </div >

            {
              executions.length === 0 && !loadingLogs && (
                <div className="text-center py-16 text-white/25 text-sm">
                  <p className="text-3xl mb-3">📋</p>
                  <p>No executions yet. Press <strong>▶ Run</strong> to start.</p>
                </div>
              )
            }

            < div className="space-y-3" >
              {
                executions.map((exec) => (
                  <div key={exec.id} className="rounded-2xl border border-white/[0.07] bg-white/2 overflow-hidden">
                    {/* Exec header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                      <span className={`font-semibold text-xs ${statusColor(exec.status)}`}>
                        {exec.status === "COMPLETED" ? "✓" : exec.status === "FAILED" ? "✗" : exec.status === "RUNNING" ? "⏳" : "○"} {exec.status}
                      </span>
                      <span className="text-xs text-white/25 font-mono">{exec.id.slice(0, 8)}</span>
                      <span className="text-xs text-white/20 ml-auto">
                        {new Date(exec.createdAt).toLocaleString()}
                      </span>
                      {exec.completedAt && (
                        <span className="text-xs text-white/20">
                          {Math.round((new Date(exec.completedAt).getTime() - new Date(exec.createdAt).getTime()) / 1000)}s
                        </span>
                      )}
                    </div>

                    {/* Step logs */}
                    {exec.stepLogs && exec.stepLogs.length > 0 && (
                      <div className="divide-y divide-white/[0.04]">
                        {exec.stepLogs.map((step, i) => (
                          <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                            <span className={`text-xs mt-0.5 shrink-0 ${step.status === "completed" ? "text-green-400" : step.status === "failed" ? "text-red-400" : step.status === "running" ? "text-blue-400" : "text-neutral-500"}`}>
                              {step.status === "completed" ? "✓" : step.status === "failed" ? "✗" : step.status === "running" ? "⏳" : "○"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-white/50">{step.nodeId}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 capitalize">{step.nodeType}</span>
                              </div>
                              {step.error && <div className="text-xs text-red-400 mt-1 font-mono truncate">{step.error}</div>}
                              {step.output != null && (
                                <div className="text-[10px] text-white/30 mt-1 font-mono truncate">
                                  → {typeof step.output === "string" ? step.output.slice(0, 120) : JSON.stringify(step.output).slice(0, 120)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {exec.error && (
                      <div className="px-4 py-2 text-xs text-red-400 font-mono bg-red-500/5">{exec.error}</div>
                    )}
                  </div>
                ))
              }
            </div >
          </div >
        )
        }
      </div >

      {/* ── Inspector ────────────────────────────────────────────────────────── */}
      < aside className="w-68 shrink-0 bg-[#0c0c14] border-l border-white/[0.07] overflow-y-auto" style={{ width: 272 }}>
        {
          selectedNode ? (
            <NodeInspector node={selectedNode} onChange={handleNodeDataChange} onCommit={handleNodeDataCommit} onDelete={deleteNode} />
          ) : activeTab === "logs" && executions.length > 0 ? (
            <div className="p-4 space-y-4">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest">Latest Run</p>
              {(() => {
                const latest = executions[0];
                return (
                  <div className="space-y-3">
                    {/* Status */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/6 bg-white/2">
                      <span className={`text-sm ${latest.status === "COMPLETED" ? "text-green-400" : latest.status === "FAILED" ? "text-red-400" : latest.status === "RUNNING" ? "text-blue-400" : "text-neutral-400"}`}>
                        {latest.status === "COMPLETED" ? "✓" : latest.status === "FAILED" ? "✗" : latest.status === "RUNNING" ? "⏳" : "○"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold ${latest.status === "COMPLETED" ? "text-green-400" : latest.status === "FAILED" ? "text-red-400" : latest.status === "RUNNING" ? "text-blue-400" : "text-neutral-400"}`}>{latest.status}</p>
                        <p className="text-[10px] text-white/25 font-mono">{latest.id.slice(0, 8)}</p>
                      </div>
                      {latest.completedAt && (
                        <span className="text-[10px] text-white/30 shrink-0">
                          {Math.round((new Date(latest.completedAt).getTime() - new Date(latest.createdAt).getTime()) / 1000)}s
                        </span>
                      )}
                    </div>

                    {/* Final output */}
                    {latest.output != null && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-white/25 font-semibold uppercase tracking-widest">Output</p>
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                          <pre className="text-[11px] text-emerald-300/80 font-mono whitespace-pre-wrap break-all leading-relaxed max-h-48 overflow-y-auto">
                            {typeof latest.output === "string" ? latest.output : JSON.stringify(latest.output, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Error */}
                    {latest.error && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-white/25 font-semibold uppercase tracking-widest">Error</p>
                        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                          <p className="text-[11px] text-red-300/80 font-mono break-all">{latest.error}</p>
                        </div>
                      </div>
                    )}

                    {/* Step summary */}
                    {latest.stepLogs && latest.stepLogs.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-white/25 font-semibold uppercase tracking-widest">Steps ({latest.stepLogs.length})</p>
                        <div className="space-y-1">
                          {latest.stepLogs.map((step, i) => (
                            <div key={i} className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-white/2 border border-white/4">
                              <span className={`text-xs shrink-0 mt-0.5 ${step.status === "completed" ? "text-green-400" : step.status === "failed" ? "text-red-400" : "text-blue-400"}`}>
                                {step.status === "completed" ? "✓" : step.status === "failed" ? "✗" : "⏳"}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-mono text-white/40 truncate">{step.nodeId}</span>
                                  <span className="text-[9px] px-1 rounded bg-white/5 text-white/25 capitalize shrink-0">{step.nodeType}</span>
                                </div>
                                {step.output != null && (
                                  <p className="text-[10px] text-white/30 font-mono truncate mt-0.5">
                                    → {typeof step.output === "string" ? step.output.slice(0, 80) : JSON.stringify(step.output).slice(0, 80)}
                                  </p>
                                )}
                                {step.error && <p className="text-[10px] text-red-400/80 font-mono truncate mt-0.5">{step.error}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-[9px] text-white/20 text-center">
                      {new Date(latest.createdAt).toLocaleString()}
                    </p>
                  </div>
                );
              })()}
            </div>
          ) : activeTab === "logs" && running ? (
            <div className="p-5 flex flex-col items-center gap-3 pt-12">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <p className="text-xs text-white/30 text-center">Executing workflow…</p>
              {runStatus && <p className="text-xs text-blue-400/70 text-center font-mono">{runStatus.msg}</p>}
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <p className="text-xs font-semibold text-white/40">Inspector</p>
              <p className="text-xs text-white/25 leading-relaxed">Click any node to configure it here.</p>
              <div className="border-t border-white/6 pt-4 space-y-2">
                <p className="text-[10px] text-white/20 font-semibold uppercase tracking-widest">Quick tip</p>
                <p className="text-xs text-white/20 leading-relaxed">
                  Connect nodes by dragging from the dot at the bottom of one node to the top of another.
                  Right-click a node for more options.
                </p>
              </div>
            </div>
          )}
      </aside >

      {/* ── Context menu ─────────────────────────────────────────────────────── */}
      {
        ctxMenu && (
          <div
            className="fixed z-50 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[160px]"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              { label: "✎ Configure", action: () => { setSelectedNodeId(ctxMenu.nodeId); setCtxMenu(null); } },
              { label: "⧉ Duplicate (⌘D)", action: () => duplicateNode(ctxMenu.nodeId) },
              { label: "⊡ Copy ID", action: () => { navigator.clipboard.writeText(ctxMenu.nodeId); setCtxMenu(null); } },
              null, // divider
              { label: "🗑 Delete", action: () => deleteNode(ctxMenu.nodeId), danger: true },
            ].map((item, i) =>
              !item ? (
                <div key={i} className="my-1 h-px bg-white/10" />
              ) : (
                <button
                  key={i}
                  onClick={item.action}
                  className={`w-full text-left px-4 py-2 text-xs transition-colors ${item.danger ? "text-red-400 hover:bg-red-500/10" : "text-white/70 hover:bg-white/5"
                    }`}
                >
                  {item.label}
                </button>
              )
            )}
          </div>
        )
      }
    </div >
  );
}

export function WorkflowBuilder(props: Props) {
  return (
    <ReactFlowProvider>
      <Builder {...props} />
    </ReactFlowProvider>
  );
}
