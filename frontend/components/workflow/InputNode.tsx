"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export const InputNode = memo(({ data, selected }: NodeProps) => {
  const d = data as any;
  const hasDefault = !!(d?.defaultMessage?.trim());
  const borderClass = selected
    ? "border-slate-500 shadow-slate-200 dark:shadow-slate-900"
    : "border-slate-300 dark:border-slate-600";

  return (
    <div
      className={`w-44 rounded-xl border-2 border-dashed bg-white dark:bg-slate-800 shadow-sm transition-all ${borderClass}`}
    >
      <div className="p-3 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
          {/* Pencil icon */}
          <svg
            className="w-4 h-4 text-slate-500 dark:text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>
        <div className="overflow-hidden">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Input
          </div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
            User Input
          </div>
          {hasDefault ? (
            <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5 font-medium truncate">
              "{d.defaultMessage.slice(0, 20)}{d.defaultMessage.length > 20 ? "…" : ""}"
            </div>
          ) : (
            <div className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
              Click to configure →
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white dark:!border-slate-900"
      />
    </div>
  );
});

InputNode.displayName = "InputNode";
