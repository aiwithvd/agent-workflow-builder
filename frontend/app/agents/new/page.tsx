"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AgentForm } from "@/components/agents/AgentForm";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { agentsAPI } from "@/lib/api";
import { useAgentStore } from "@/lib/stores/agentStore";
import Link from "next/link";

function decodePreset(encoded: string | null): Record<string, any> | undefined {
  if (!encoded) return undefined;
  try {
    return JSON.parse(atob(decodeURIComponent(encoded)));
  } catch {
    return undefined;
  }
}

function NewAgentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const upsert = useAgentStore((s) => s.upsert);

  // Decode preset from URL param (set by AgentPresetPicker)
  const preset = useMemo(
    () => decodePreset(searchParams.get("preset")),
    [searchParams]
  );

  const isFromPreset = !!preset;

  async function handleSubmit(data: any) {
    const res = await agentsAPI.create(data);
    if (res.error) {
      alert(`Failed to create agent: ${res.error}`);
      return;
    }
    if (res.data) upsert(res.data as any);
    router.push("/agents");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/agents"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-2 inline-flex items-center gap-1"
        >
          ← Back to agents
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isFromPreset ? (
            <>
              <span className="mr-2">{preset?.icon}</span>
              {preset?.name} Agent
            </>
          ) : (
            "Create Agent"
          )}
        </h1>
        {isFromPreset && (
          <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">
            Pre-filled from the <strong>{preset?.name}</strong> preset — customise as needed.
          </p>
        )}
      </div>
      <Card>
        <CardHeader>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isFromPreset
              ? "Review and adjust the preset configuration, then save to create your agent."
              : "Configure a new AI agent with a provider, model, and tools."}
          </p>
        </CardHeader>
        <CardBody>
          <AgentForm
            initial={preset}
            onSubmit={handleSubmit}
            onCancel={() => router.push("/agents")}
            submitLabel="Create Agent"
          />
        </CardBody>
      </Card>
    </div>
  );
}

export default function NewAgentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-slate-500">Loading…</div>}>
      <NewAgentContent />
    </Suspense>
  );
}
