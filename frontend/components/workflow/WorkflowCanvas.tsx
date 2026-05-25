"use client";

import { useCallback, createContext, useContext } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AgentNode } from "./AgentNode";
import { SupervisorNode } from "./SupervisorNode";
import { SwarmNode } from "./SwarmNode";
import { TelegramTriggerNode } from "./TelegramTriggerNode";
import { ScheduleTriggerNode } from "./ScheduleTriggerNode";
import { WebChatTriggerNode } from "./WebChatTriggerNode";
import { InputNode } from "./InputNode";
import { OutputNode } from "./OutputNode";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import type { Agent } from "@/lib/stores/agentStore";

// ─── Execution status context (consumed by AgentNode / Supervisor / Swarm) ────
export type NodeExecStatus = "running" | "done" | "error";
export const ExecutionStatusContext = createContext<Record<string, NodeExecStatus>>({});
export const useNodeExecutionStatus = () => useContext(ExecutionStatusContext);

const nodeTypes = {
  agent: AgentNode,
  supervisor: SupervisorNode,
  swarm: SwarmNode,
  telegram_trigger: TelegramTriggerNode,
  schedule_trigger: ScheduleTriggerNode,
  web_trigger: WebChatTriggerNode,
  input: InputNode,
  output: OutputNode,
};

// ─── Trigger palette items ─────────────────────────────────────────────────────

const TRIGGER_PALETTE = [
  {
    type: "telegram_trigger",
    label: "Telegram",
    description: "Bot message trigger",
    color: "bg-purple-600",
    icon: (
      <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.01 9.47c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L6.51 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.535-.194 1.003.13.306.969z" />
      </svg>
    ),
    defaultData: { label: "Telegram Trigger" },
  },
  {
    type: "schedule_trigger",
    label: "Schedule",
    description: "Cron-based trigger",
    color: "bg-teal-600",
    icon: (
      <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    defaultData: { label: "Cron Trigger" },
  },
  {
    type: "web_trigger",
    label: "Web Chat",
    description: "Manual run entry point",
    color: "bg-blue-600",
    icon: (
      <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    defaultData: { label: "Web Chat Trigger" },
  },
];

interface WorkflowCanvasProps {
  agents: Agent[];
  onNodeClick?: (node: Node) => void;
  nodeStatus?: Record<string, NodeExecStatus>;
}

// ─── Inner canvas component (must be inside ReactFlowProvider) ─────────────────

function FlowCanvas({ agents, onNodeClick }: Omit<WorkflowCanvasProps, "nodeStatus">) {
  const { nodes, edges, setNodes, setEdges } = useWorkflowStore();
  const { screenToFlowPosition } = useReactFlow();

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges(addEdge({ ...connection, animated: true }, edges)),
    [edges, setEdges]
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

    // Check if it's a trigger node drop
    const triggerType = e.dataTransfer.getData("triggerType");
    if (triggerType) {
      const palette = TRIGGER_PALETTE.find((t) => t.type === triggerType);
      if (!palette) return;
      const newNode: Node = {
        id: `${triggerType}-${Date.now()}`,
        type: triggerType,
        position,
        data: { ...palette.defaultData },
      };
      setNodes([...nodes, newNode]);
      return;
    }

    // Check if it's an orchestration node (supervisor / swarm)
    const orchestrationType = e.dataTransfer.getData("orchestrationType");
    if (orchestrationType) {
      const newNode: Node = {
        id: `${orchestrationType}-${Date.now()}`,
        type: orchestrationType,
        position,
        data: { label: orchestrationType === "supervisor" ? "Supervisor" : "Swarm Agent" },
      };
      setNodes([...nodes, newNode]);
      return;
    }

    // Otherwise it's an agent drop
    const agentId = e.dataTransfer.getData("agentId");
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;

    const newNode: Node = {
      id: `${agent.id}-${Date.now()}`,
      type: "agent",
      position,
      data: { agentId: agent.id, name: agent.name, role: agent.role, provider: agent.provider },
    };
    setNodes([...nodes, newNode]);
  }

  return (
    <div
      className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-950"
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          const applyChanges = (ns: Node[]) => {
            return changes.reduce((acc: Node[], change: any) => {
              if (change.type === "remove") return acc.filter((n) => n.id !== change.id);
              if (change.type === "position" && change.position) {
                return acc.map((n) =>
                  n.id === change.id ? { ...n, position: change.position } : n
                );
              }
              if (change.type === "select") {
                return acc.map((n) =>
                  n.id === change.id ? { ...n, selected: change.selected } : n
                );
              }
              return acc;
            }, ns);
          };
          setNodes(applyChanges(nodes));
        }}
        onEdgesChange={(changes) => {
          const updated = changes.reduce((acc: Edge[], change: any) => {
            if (change.type === "remove") return acc.filter((e) => e.id !== change.id);
            return acc;
          }, edges);
          setEdges(updated);
        }}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick?.(node)}
        nodeTypes={nodeTypes}
        deleteKeyCode="Delete"
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="dark:opacity-30" />
        <Controls className="dark:bg-slate-800 dark:border-slate-700" />
        <MiniMap className="dark:bg-slate-800" />
      </ReactFlow>
    </div>
  );
}

// ─── Outer component: palette + provider wrapper ───────────────────────────────

export function WorkflowCanvas({ agents, onNodeClick, nodeStatus }: WorkflowCanvasProps) {
  return (
    <ExecutionStatusContext.Provider value={nodeStatus ?? {}}>
    <div className="flex gap-4 h-full">
      {/* Palette */}
      <div className="w-48 shrink-0 flex flex-col gap-2 overflow-y-auto">

        {/* ── Triggers section ── */}
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
          Triggers
        </p>
        {TRIGGER_PALETTE.map((t) => (
          <div
            key={t.type}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("triggerType", t.type)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-grab active:cursor-grabbing text-sm text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
          >
            <div
              className={`h-6 w-6 rounded ${t.color} flex items-center justify-center shrink-0`}
            >
              {t.icon}
            </div>
            <div className="overflow-hidden">
              <div className="truncate font-medium text-xs">{t.label}</div>
              <div className="truncate text-xs text-slate-400 dark:text-slate-500">{t.description}</div>
            </div>
          </div>
        ))}

        {/* ── Divider ── */}
        <div className="border-t border-slate-200 dark:border-slate-700 my-1" />

        {/* ── Orchestration section ── */}
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
          Orchestration
        </p>
        {[
          {
            type: "supervisor",
            label: "Supervisor",
            description: "Routes to sub-agents",
            color: "bg-amber-500",
            icon: (
              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 19l3-11 5 7 2-9 5 7 3-11v14H2z" />
              </svg>
            ),
          },
          {
            type: "swarm",
            label: "Swarm Agent",
            description: "Peer-to-peer handoff",
            color: "bg-teal-600",
            icon: (
              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L4 7v10l8 5 8-5V7L12 2z" />
              </svg>
            ),
          },
        ].map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("orchestrationType", item.type)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-grab active:cursor-grabbing text-sm text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
          >
            <div className={`h-6 w-6 rounded ${item.color} flex items-center justify-center shrink-0`}>
              {item.icon}
            </div>
            <div className="overflow-hidden">
              <div className="truncate font-medium text-xs">{item.label}</div>
              <div className="truncate text-xs text-slate-400 dark:text-slate-500">{item.description}</div>
            </div>
          </div>
        ))}

        {/* ── Divider ── */}
        <div className="border-t border-slate-200 dark:border-slate-700 my-1" />

        {/* ── Agents section ── */}
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
          Agents
        </p>
        {agents.map((agent) => (
          <div
            key={agent.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("agentId", agent.id)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-grab active:cursor-grabbing text-sm text-slate-700 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
          >
            <div className="h-6 w-6 rounded bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {agent.name[0]?.toUpperCase()}
            </div>
            <span className="truncate">{agent.name}</span>
          </div>
        ))}
        {agents.length === 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            No agents yet. Create some first.
          </p>
        )}
      </div>

      {/* Canvas wrapped in provider */}
      <ReactFlowProvider>
        <FlowCanvas agents={agents} onNodeClick={onNodeClick} />
      </ReactFlowProvider>
    </div>
    </ExecutionStatusContext.Provider>
  );
}
