"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

const DEST_LABELS: Record<string, string> = {
  web: "Execution page",
  telegram: "Telegram",
  schedule: "Execution page",
  webhook: "Webhook response",
};

export const OutputNode = memo(({ data, selected }: NodeProps) => {
  const d = data as any;
  const delivery = d?.delivery ?? {};
  const hasDeliveryConfig = delivery.telegram || delivery.webhook;
  const inputSource = d?.inputSource as string | undefined;

  const borderClass = selected
    ? "border-emerald-400 shadow-lg shadow-emerald-400/20"
    : "border-emerald-600 dark:border-emerald-600";

  const destLabel = inputSource ? DEST_LABELS[inputSource] : null;

  return (
    <div
      className={`w-44 rounded-xl border-2 border-dashed bg-emerald-800 shadow-sm transition-all ${borderClass}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-emerald-400 !w-3 !h-3 !border-2 !border-emerald-900"
      />

      <div className="p-3 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-emerald-700 flex items-center justify-center shrink-0">
          <svg
            className="w-4 h-4 text-emerald-200"
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
          <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
            Output
          </div>
          <div className="text-sm font-medium text-white">
            Final Result
          </div>
          {destLabel ? (
            <div className="text-xs text-emerald-300 mt-0.5 font-medium">
              → {destLabel}
            </div>
          ) : hasDeliveryConfig ? (
            <div className="text-xs text-emerald-300 mt-0.5 font-medium">
              {[delivery.telegram && "Telegram", delivery.webhook && "Webhook"]
                .filter(Boolean).join(" + ")} ✓
            </div>
          ) : (
            <div className="text-xs text-emerald-400 mt-0.5">
              Click to configure →
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

OutputNode.displayName = "OutputNode";
