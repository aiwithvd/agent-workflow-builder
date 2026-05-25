"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

interface WebChatTriggerData {
  description?: string;
  label?: string;
}

export const WebChatTriggerNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as WebChatTriggerData;

  // Web Chat triggers are always "configured" — no credentials needed
  const borderClass = selected
    ? "border-blue-500 shadow-blue-200 dark:shadow-blue-900"
    : "border-blue-200 dark:border-blue-800";

  return (
    <div
      className={`w-48 rounded-xl border-2 bg-white dark:bg-slate-800 shadow-sm transition-all ${borderClass}`}
    >
      {/* No top Handle — triggers are source-only */}

      <div className="p-3 flex items-center gap-2.5">
        {/* Chat bubble icon */}
        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <svg
            className="w-4 h-4 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>

        <div className="overflow-hidden flex-1">
          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Web Chat
          </div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {d.label || "Web Chat Trigger"}
          </div>
          {d.description ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {d.description}
            </div>
          ) : (
            <div className="text-xs text-blue-500 dark:text-blue-400">
              Manual run entry point
            </div>
          )}
        </div>
      </div>

      {/* Status indicator */}
      <div className="mx-3 mb-3 rounded-md px-2 py-1 text-xs text-center font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
        🌐 Always ready
      </div>

      {/* Source handle only */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white dark:!border-slate-800"
      />
    </div>
  );
});

WebChatTriggerNode.displayName = "WebChatTriggerNode";
