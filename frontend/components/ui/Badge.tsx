type BadgeVariant =
  | "success"
  | "running"
  | "failed"
  | "pending"
  | "default"
  | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  success:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  running:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  failed:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  info:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  default:
    "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
};

export function Badge({
  variant = "default",
  children,
  className = "",
  pulse,
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              variant === "running" ? "bg-blue-500" : "bg-current"
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
              variant === "running" ? "bg-blue-500" : "bg-current"
            }`}
          />
        </span>
      )}
      {children}
    </span>
  );
}

export function statusToBadgeVariant(status: string): BadgeVariant {
  switch (status?.toLowerCase()) {
    case "completed":
    case "success":
      return "success";
    case "running":
    case "in_progress":
      return "running";
    case "failed":
    case "error":
      return "failed";
    case "pending":
    case "queued":
      return "pending";
    default:
      return "default";
  }
}
