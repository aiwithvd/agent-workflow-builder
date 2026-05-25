interface StatusIndicatorProps {
  status: string;
  size?: "sm" | "md";
}

const statusConfig: Record<string, { color: string; label: string; pulse: boolean }> = {
  running: { color: "bg-blue-500", label: "Running", pulse: true },
  in_progress: { color: "bg-blue-500", label: "Running", pulse: true },
  completed: { color: "bg-emerald-500", label: "Completed", pulse: false },
  success: { color: "bg-emerald-500", label: "Success", pulse: false },
  failed: { color: "bg-red-500", label: "Failed", pulse: false },
  error: { color: "bg-red-500", label: "Error", pulse: false },
  pending: { color: "bg-amber-500", label: "Pending", pulse: false },
  queued: { color: "bg-amber-500", label: "Queued", pulse: false },
};

export function StatusIndicator({ status, size = "md" }: StatusIndicatorProps) {
  const config = statusConfig[status?.toLowerCase()] ?? {
    color: "bg-slate-400",
    label: status ?? "Unknown",
    pulse: false,
  };
  const dotSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";

  return (
    <span className="flex items-center gap-2">
      <span className="relative flex">
        {config.pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-60`}
          />
        )}
        <span className={`relative inline-flex rounded-full ${dotSize} ${config.color}`} />
      </span>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {config.label}
      </span>
    </span>
  );
}
