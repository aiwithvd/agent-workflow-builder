"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

interface TelegramTriggerData {
  botUsername?: string;
  botToken?: string;
  label?: string;
}

export const TelegramTriggerNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as TelegramTriggerData;
  const isConfigured = !!(d.botToken || d.botUsername);

  const borderClass = !isConfigured
    ? "border-amber-400 dark:border-amber-600"
    : selected
    ? "border-purple-500 shadow-purple-200 dark:shadow-purple-900"
    : "border-purple-200 dark:border-purple-800";

  return (
    <div
      className={`w-48 rounded-xl border-2 bg-white dark:bg-slate-800 shadow-sm transition-all ${borderClass}`}
    >
      {/* No top Handle — triggers are source-only */}

      <div className="p-3 flex items-center gap-2.5">
        {/* Telegram icon (paper plane) */}
        <div className="h-8 w-8 rounded-lg bg-purple-600 flex items-center justify-center shrink-0">
          <svg
            className="w-4 h-4 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.01 9.47c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L6.51 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.535-.194 1.003.13.306.969z" />
          </svg>
        </div>

        <div className="overflow-hidden flex-1">
          <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            Telegram
          </div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {d.label || "Telegram Trigger"}
          </div>
          {d.botUsername ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              @{d.botUsername}
            </div>
          ) : (
            <div className="text-xs text-amber-500 dark:text-amber-400">
              Click to configure ↗
            </div>
          )}
        </div>
      </div>

      {/* Status indicator */}
      <div
        className={`mx-3 mb-3 rounded-md px-2 py-1 text-xs text-center font-medium ${
          isConfigured
            ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
            : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
        }`}
      >
        {isConfigured ? "⚡ Active trigger" : "⚠ No bot configured"}
      </div>

      {/* Source handle only — triggers fire into the graph */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-purple-500 !w-3 !h-3 !border-2 !border-white dark:!border-slate-800"
      />
    </div>
  );
});

TelegramTriggerNode.displayName = "TelegramTriggerNode";
