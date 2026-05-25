"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useNodeExecutionStatus } from "./WorkflowCanvas";

interface SwarmNodeData {
  name?: string;
  label?: string;
  agentId?: string | null;
  role?: string;
  provider?: string;
}

export const SwarmNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as unknown as SwarmNodeData;
  const statusMap = useNodeExecutionStatus();
  const execStatus = id ? statusMap[id] : undefined;

  const displayName = d.label || d.name || "Swarm Agent";
  const isUnassigned = !d.agentId;

  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const borderClass =
    execStatus === "running"
      ? "border-blue-500 animate-pulse shadow-lg shadow-blue-200 dark:shadow-blue-900"
      : execStatus === "done"
      ? "border-emerald-500 shadow-emerald-200 dark:shadow-emerald-900"
      : execStatus === "error"
      ? "border-red-500"
      : selected
      ? "border-teal-500 shadow-teal-200 dark:shadow-teal-900"
      : isUnassigned
      ? "border-teal-300 dark:border-teal-700"
      : "border-teal-400 dark:border-teal-600";

  const avatarClass =
    execStatus === "running"
      ? "bg-blue-600"
      : execStatus === "done"
      ? "bg-emerald-600"
      : execStatus === "error"
      ? "bg-red-600"
      : "bg-teal-600";

  return (
    <div
      className={`w-48 rounded-xl border-2 bg-white dark:bg-slate-800 shadow-sm transition-all ${borderClass}`}
    >
      {/* Bidirectional handles — swarm agents can hand off to each other */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-teal-500 !w-3 !h-3 !border-2 !border-white dark:!border-slate-800"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!bg-teal-500 !w-3 !h-3 !border-2 !border-white dark:!border-slate-800"
      />

      {/* Header badge */}
      <div className="px-3 pt-2.5 pb-0">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 rounded px-1.5 py-0.5">
          {/* Hexagon/swarm icon */}
          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L4 7v10l8 5 8-5V7L12 2z" />
          </svg>
          Swarm
        </span>
      </div>

      <div className="p-3 pt-2 flex items-center gap-2.5">
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
          {execStatus === "running" && (
            <div className="text-xs text-blue-500 dark:text-blue-400 animate-pulse font-medium">
              ● Active…
            </div>
          )}
          {execStatus === "done" && (
            <div className="text-xs text-emerald-500 dark:text-emerald-400 font-medium">
              ✓ Done
            </div>
          )}
          {!execStatus && isUnassigned && (
            <div className="text-xs text-teal-500 dark:text-teal-400">
              Click to assign ↗
            </div>
          )}
          {!execStatus && !isUnassigned && d.provider && (
            <div className="text-xs text-teal-500 dark:text-teal-400 truncate">
              {d.provider}
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-teal-500 !w-3 !h-3 !border-2 !border-white dark:!border-slate-800"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="!bg-teal-500 !w-3 !h-3 !border-2 !border-white dark:!border-slate-800"
      />
    </div>
  );
});

SwarmNode.displayName = "SwarmNode";
