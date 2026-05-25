"use client";

import Link from "next/link";
import { useWorkflows } from "@/lib/hooks/useWorkflows";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { workflowsAPI } from "@/lib/api";

export default function WorkflowsPage() {
  const { workflows, isLoading, error } = useWorkflows();
  const [templates, setTemplates] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    workflowsAPI.templates().then((res) => {
      if (res.data && (res.data as any).templates) {
        setTemplates((res.data as any).templates);
      }
    });
  }, []);

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Workflows
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {workflows.length} workflow{workflows.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/workflows/new">
          <Button>New Workflow</Button>
        </Link>
      </div>

      {/* Templates */}
      {templates.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Templates
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {templates.map((t: any) => (
              <Link
                key={t.name}
                href={`/workflows/new?template=${t.name}`}
                className="p-4 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/10 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                <p className="font-medium text-indigo-700 dark:text-indigo-400 text-sm">
                  {t.display_name || t.name}
                </p>
                {t.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {t.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Workflows */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Your Workflows
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <EmptyState
            icon="⚠️"
            title="Failed to load workflows"
            description={(error as Error).message}
          />
        ) : workflows.length === 0 ? (
          <EmptyState
            icon="🔀"
            title="No workflows yet"
            description="Design multi-agent workflows on an interactive canvas."
            action={{
              label: "Create Workflow",
              onClick: () => router.push("/workflows/new"),
            }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {workflows.map((wf: any) => (
              <Link key={wf.id} href={`/workflows/${wf.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardBody className="flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {wf.name}
                      </h3>
                      {wf.template_name && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                          {wf.template_name}
                        </span>
                      )}
                    </div>
                    {wf.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                        {wf.description}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-auto">
                      {wf.created_at
                        ? new Date(wf.created_at).toLocaleDateString()
                        : "—"}
                    </p>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
