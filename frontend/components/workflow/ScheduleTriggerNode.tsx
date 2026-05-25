"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

interface ScheduleTriggerData {
  cron?: string;
  inputMessage?: string;
  label?: string;
}

/** Convert a simple cron string into a human-readable label.
 *  Covers the most common patterns; falls back to the raw string.
 */
function humanizeCron(cron: string): string {
  const trimmed = cron.trim();

  // Named shortcuts
  if (trimmed === "@hourly") return "Every hour";
  if (trimmed === "@daily" || trimmed === "@midnight") return "Every day at midnight";
  if (trimmed === "@weekly") return "Every Sunday at midnight";
  if (trimmed === "@monthly") return "1st of every month";
  if (trimmed === "@yearly" || trimmed === "@annually") return "Once a year";

  const parts = trimmed.split(/\s+/);
  if (parts.length < 5) return cron;

  const [minute, hour, dom, month, dow] = parts;

  // Every minute
  if (trimmed === "* * * * *") return "Every minute";

  // Every N minutes
  const everyMinute = minute.match(/^\*\/(\d+)$/);
  if (everyMinute && hour === "*") return `Every ${everyMinute[1]} minutes`;

  // Every hour at :MM
  if (hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return `Every hour at :${minute.padStart(2, "0")}`;
  }

  // Daily at HH:MM
  if (dom === "*" && month === "*" && dow === "*") {
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    if (!isNaN(h) && !isNaN(m)) {
      const suffix = h >= 12 ? "PM" : "AM";
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      return `Daily at ${displayHour}:${String(m).padStart(2, "0")} ${suffix}`;
    }
  }

  // Weekly on day
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (dom === "*" && month === "*" && dow !== "*") {
    const dayNum = parseInt(dow, 10);
    if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
      const h = parseInt(hour, 10);
      const m = parseInt(minute, 10);
      if (!isNaN(h) && !isNaN(m)) {
        const suffix = h >= 12 ? "PM" : "AM";
        const displayHour = h % 12 === 0 ? 12 : h % 12;
        return `Every ${dayNames[dayNum]} at ${displayHour}:${String(m).padStart(2, "0")} ${suffix}`;
      }
    }
  }

  return cron; // fallback: show raw
}

export const ScheduleTriggerNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as ScheduleTriggerData;
  const isConfigured = !!d.cron;
  const humanCron = d.cron ? humanizeCron(d.cron) : null;

  const borderClass = !isConfigured
    ? "border-amber-400 dark:border-amber-600"
    : selected
    ? "border-teal-500 shadow-teal-200 dark:shadow-teal-900"
    : "border-teal-200 dark:border-teal-800";

  return (
    <div
      className={`w-48 rounded-xl border-2 bg-white dark:bg-slate-800 shadow-sm transition-all ${borderClass}`}
    >
      {/* No top Handle — triggers are source-only */}

      <div className="p-3 flex items-center gap-2.5">
        {/* Clock icon */}
        <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
          <svg
            className="w-4 h-4 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        <div className="overflow-hidden flex-1">
          <div className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
            Schedule
          </div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {d.label || "Cron Trigger"}
          </div>
          {humanCron ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate" title={d.cron}>
              {humanCron}
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
            ? "bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400"
            : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
        }`}
      >
        {isConfigured ? "⏰ Scheduled" : "⚠ No schedule set"}
      </div>

      {/* Source handle only */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-teal-500 !w-3 !h-3 !border-2 !border-white dark:!border-slate-800"
      />
    </div>
  );
});

ScheduleTriggerNode.displayName = "ScheduleTriggerNode";
