"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useNodeExecutionStatus } from "./WorkflowCanvas";

interface AgentNodeData {
  name?: string;
  label?: string;   // templates use "label", drag-drop uses "name"
  role?: string;
  provider?: string;
  agentId?: string | null;
}

export const AgentNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as unknown as AgentNodeData;
  const statusMap = useNodeExecutionStatus();
  const execStatus = id ? statusMap[id] : undefined;

  // Templates store display text in "label"; drag-dropped nodes use "name"
  const displayName = d.label || d.name || "Unassigned";
  const isUnassigned = !d.agentId;

  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Execution overlay takes priority over selection/assignment states
  const borderClass = execStatus === "running"
    ? "border-blue-500 animate-pulse shadow-lg shadow-blue-200 dark:shadow-blue-900"
    : execStatus === "done"
    ? "border-emerald-500 shadow-emerald-200 dark:shadow-emerald-900"
    : execStatus === "error"
    ? "border-red-500 shadow-red-200 dark:shadow-red-900"
    : isUnassigned
    ? "border-amber-400 dark:border-amber-600"
    : selected
    ? "border-indigo-500 shadow-indigo-200 dark:shadow-indigo-900"
    : "border-slate-200 dark:border-slate-700";

  const avatarClass = execStatus === "running"
    ? "bg-blue-600"
    : execStatus === "done"
    ? "bg-emerald-600"
    : execStatus === "error"
    ? "bg-red-600"
    : isUnassigned
    ? "bg-amber-500"
    : "bg-indigo-600";

  return (
    <div
      className={`w-44 rounded-xl border-2 bg-white dark:bg-slate-800 shadow-sm transition-all ${borderClass}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-white dark:!border-slate-800"
      />

      <div className="p-3 flex items-center gap-2.5">
        <div
          className={`h-8 w-8 rounded-lg ${avatarClass} flex items-center justify-center text-white text-xs font-bold shrink-0`}
        >
          {initials}
        </div>
        <div className="overflow-hidden flex-1">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {displayName}
          </div>
          {d.role && (
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {d.role}
            </div>
          )}
          {d.provider && !isUnassigned && (
            <div className="text-xs text-indigo-500 dark:text-indigo-400 truncate">
              {d.provider}
            </div>
          )}
          {execStatus === "running" && (
            <div className="text-xs text-blue-500 dark:text-blue-400 animate-pulse font-medium">
              ● Running…
            </div>
          )}
          {execStatus === "done" && (
            <div className="text-xs text-emerald-500 dark:text-emerald-400 font-medium">
              ✓ Done
            </div>
          )}
          {execStatus === "error" && (
            <div className="text-xs text-red-500 dark:text-red-400 font-medium">
              ✕ Error
            </div>
          )}
          {!execStatus && isUnassigned && (
            <div className="text-xs text-amber-500 dark:text-amber-400">
              Click to assign ↗
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-white dark:!border-slate-800"
      />
    </div>
  );
});

AgentNode.displayName = "AgentNode";
