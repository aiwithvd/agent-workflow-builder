"use client";

import Link from "next/link";
import { useAgents } from "@/lib/hooks/useAgents";
import { AgentCard } from "@/components/agents/AgentCard";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { useRouter } from "next/navigation";

export default function AgentsPage() {
  const { agents, isLoading, error } = useAgents();
  const router = useRouter();

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Agents
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {agents.length} agent{agents.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <Link href="/agents/new">
          <Button>New Agent</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <EmptyState
          icon="⚠️"
          title="Failed to load agents"
          description={(error as Error).message}
          action={{ label: "Retry", onClick: () => location.reload() }}
        />
      ) : agents.length === 0 ? (
        <EmptyState
          icon="🤖"
          title="No agents yet"
          description="Create your first AI agent to get started with workflow orchestration."
          action={{
            label: "Create Agent",
            onClick: () => router.push("/agents/new"),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent: any) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
