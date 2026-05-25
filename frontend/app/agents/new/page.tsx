"use client";

import { useRouter } from "next/navigation";
import { AgentForm } from "@/components/agents/AgentForm";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { agentsAPI } from "@/lib/api";
import { useAgentStore } from "@/lib/stores/agentStore";
import Link from "next/link";

export default function NewAgentPage() {
  const router = useRouter();
  const upsert = useAgentStore((s) => s.upsert);

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
          Create Agent
        </h1>
      </div>
      <Card>
        <CardHeader>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Configure a new AI agent with a provider, model, and tools.
          </p>
        </CardHeader>
        <CardBody>
          <AgentForm
            onSubmit={handleSubmit}
            onCancel={() => router.push("/agents")}
            submitLabel="Create Agent"
          />
        </CardBody>
      </Card>
    </div>
  );
}
