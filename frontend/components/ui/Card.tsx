import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`px-6 py-4 border-b border-slate-200 dark:border-slate-700 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardBody({ className = "", children, ...props }: CardProps) {
  return (
    <div className={`px-6 py-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`px-6 py-4 border-t border-slate-200 dark:border-slate-700 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
