"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export const OutputNode = memo(({ data, selected }: NodeProps) => {
  const d = data as any;
  const delivery = d?.delivery ?? {};
  const hasDeliveryConfig = delivery.telegram || delivery.webhook;

  const borderClass = selected
    ? "border-emerald-500 shadow-emerald-200 dark:shadow-emerald-900"
    : "border-emerald-300 dark:border-emerald-700";

  return (
    <div
      className={`w-44 rounded-xl border-2 border-dashed bg-white dark:bg-slate-800 shadow-sm transition-all ${borderClass}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-emerald-400 !w-3 !h-3 !border-2 !border-white dark:!border-emerald-950"
      />

      <div className="p-3 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
          {/* Checkmark icon */}
          <svg
            className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="overflow-hidden">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Output
          </div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Final Result
          </div>
          {hasDeliveryConfig ? (
            <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
              {[delivery.telegram && "Telegram", delivery.webhook && "Webhook"]
                .filter(Boolean).join(" + ")} ✓
            </div>
          ) : (
            <div className="text-xs text-emerald-500 dark:text-emerald-400 mt-0.5">
              Click to configure →
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

OutputNode.displayName = "OutputNode";
