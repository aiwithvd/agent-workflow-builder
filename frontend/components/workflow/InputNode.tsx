"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

const SOURCE_BADGES: Record<string, { icon: string; label: string; color: string }> = {
  web: { icon: "💬", label: "Web", color: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300" },
  telegram: { icon: "📱", label: "Telegram", color: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300" },
  schedule: { icon: "⏰", label: "Schedule", color: "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300" },
  webhook: { icon: "🔗", label: "Webhook", color: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
};

export const InputNode = memo(({ data, selected }: NodeProps) => {
  const d = data as any;
  const hasDefault = !!(d?.defaultMessage?.trim());
  const source = d?.source as string | undefined;
  const badge = source ? SOURCE_BADGES[source] : null;
  const borderClass = selected
    ? "border-slate-400 shadow-lg shadow-slate-400/20"
    : "border-slate-500 dark:border-slate-500";

  return (
    <div
      className={`w-44 rounded-xl border-2 border-dashed bg-slate-600 shadow-sm transition-all ${borderClass}`}
    >
      <div className="p-3 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-slate-500 flex items-center justify-center shrink-0">
          <svg
            className="w-4 h-4 text-slate-200"
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
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Input
          </div>
          <div className="text-sm font-medium text-white">
            User Input
          </div>
          {badge ? (
            <div className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.color}`}>
              <span>{badge.icon}</span> {badge.label}
            </div>
          ) : hasDefault ? (
            <div className="text-xs text-indigo-300 mt-0.5 font-medium truncate">
              &ldquo;{d.defaultMessage.slice(0, 20)}{d.defaultMessage.length > 20 ? "…" : ""}&rdquo;
            </div>
          ) : (
            <div className="text-xs text-slate-400 mt-0.5">
              Click to configure →
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-400 !w-3 !h-3 !border-2 !border-slate-700"
      />
    </div>
  );
});

InputNode.displayName = "InputNode";
