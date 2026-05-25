import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, className = "", id, children, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-slate-800
            text-slate-900 dark:text-slate-100
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
            transition-colors appearance-none cursor-pointer
            ${
              error
                ? "border-red-400 dark:border-red-500"
                : "border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
            }
            ${className}
          `}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
        )}
        {helperText && !error && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
