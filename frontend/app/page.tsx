"use client";

import Link from "next/link";
import { useAgents } from "@/lib/hooks/useAgents";
import { useWorkflows } from "@/lib/hooks/useWorkflows";
import { useExecutions } from "@/lib/hooks/useExecutions";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge, statusToBadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

function StatCard({
  label,
  value,
  icon,
  color,
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardBody className="flex items-center gap-4">
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${color}`}>
            {icon}
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {value}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

export default function Home() {
  const { agents, isLoading: aL } = useAgents();
  const { workflows, isLoading: wL } = useWorkflows();
  const { executions, isLoading: eL } = useExecutions();

  const activeExecutions = executions.filter(
    (e: any) => e.status === "running" || e.status === "in_progress"
  );
  const recentExecutions = [...executions]
    .sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 5);

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Overview of your agent orchestration platform
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/agents/new">
            <Button size="sm">New Agent</Button>
          </Link>
          <Link href="/workflows/new">
            <Button size="sm" variant="secondary">New Workflow</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Agents"
          value={aL ? "—" : agents.length}
          href="/agents"
          color="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
            </svg>
          }
        />
        <StatCard
          label="Workflows"
          value={wL ? "—" : workflows.length}
          href="/workflows"
          color="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <StatCard
          label="Total Executions"
          value={eL ? "—" : executions.length}
          href="/executions"
          color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <StatCard
          label="Active Now"
          value={eL ? "—" : activeExecutions.length}
          href="/executions"
          color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M8.464 15.536a5 5 0 010-7.072m7.072 0a5 5 0 010 7.072M12 12h.01" />
            </svg>
          }
        />
      </div>

      {/* Recent Executions */}
      <Card>
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            Recent Executions
          </h2>
          <Link href="/executions">
            <Button size="sm" variant="ghost">View all</Button>
          </Link>
        </div>
        <CardBody className="p-0">
          {eL ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : recentExecutions.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
              No executions yet. Run a workflow to get started.
            </div>
          ) : (
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentExecutions.map((ex: any) => (
                  <tr
                    key={ex.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <Link
                        href={`/executions/${ex.id}`}
                        className="font-mono text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {ex.id.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-slate-700 dark:text-slate-300">
                      {ex.workflow_name ?? ex.workflow_id?.slice(0, 8)}
                    </td>
                    <td className="px-6 py-3">
                      <Badge variant={statusToBadgeVariant(ex.status)} pulse={ex.status === "running"}>
                        {ex.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                      {ex.created_at
                        ? new Date(ex.created_at).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-4">
        <Link
          href="/agents/new"
          className="flex flex-col gap-2 p-5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors group text-center"
        >
          <span className="text-2xl">🤖</span>
          <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
            Create Agent
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Configure an AI agent
          </span>
        </Link>
        <Link
          href="/workflows/new"
          className="flex flex-col gap-2 p-5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors group text-center"
        >
          <span className="text-2xl">🔀</span>
          <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
            Build Workflow
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Design with visual canvas
          </span>
        </Link>
        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col gap-2 p-5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors group text-center"
        >
          <span className="text-2xl">📚</span>
          <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
            API Docs
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Explore the backend API
          </span>
        </a>
      </div>
    </div>
  );
}
