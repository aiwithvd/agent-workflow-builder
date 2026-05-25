"use client";

import Link from "next/link";
import { useState } from "react";
import { useExecutions } from "@/lib/hooks/useExecutions";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge, statusToBadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";

const STATUS_FILTERS = ["all", "running", "completed", "failed", "pending"];

export default function ExecutionsPage() {
  const { executions, isLoading, error } = useExecutions();
  const [filter, setFilter] = useState("all");

  const filtered =
    filter === "all"
      ? executions
      : executions.filter((e: any) => e.status === filter);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Executions
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time workflow execution monitor
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
              filter === s
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <EmptyState icon="⚠️" title="Failed to load executions" description={(error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No executions"
          description={
            filter === "all"
              ? "Run a workflow to see execution history here."
              : `No ${filter} executions.`
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left">
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    ID
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Workflow
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Started
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Duration
                  </th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((ex: any) => {
                  const start = ex.created_at ? new Date(ex.created_at) : null;
                  const end = ex.updated_at ? new Date(ex.updated_at) : null;
                  const duration =
                    start && end && ex.status !== "running"
                      ? `${Math.round((end.getTime() - start.getTime()) / 1000)}s`
                      : null;

                  return (
                    <tr
                      key={ex.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-6 py-3">
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          {ex.id.slice(0, 8)}…
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-700 dark:text-slate-300">
                        {ex.workflow_name ?? ex.workflow_id?.slice(0, 8)}
                      </td>
                      <td className="px-6 py-3">
                        <Badge
                          variant={statusToBadgeVariant(ex.status)}
                          pulse={ex.status === "running"}
                        >
                          {ex.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                        {start ? start.toLocaleString() : "—"}
                      </td>
                      <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                        {duration ?? (ex.status === "running" ? "…" : "—")}
                      </td>
                      <td className="px-6 py-3">
                        <Link
                          href={`/executions/${ex.id}`}
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
