import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Agent } from "@/lib/stores/agentStore";

const providerColors: Record<string, string> = {
  ollama: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  openrouter: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  glm51: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "glm51-local": "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
};

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  const initials = agent.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const providerColor =
    providerColors[agent.provider?.toLowerCase()] ??
    "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";

  return (
    <Link href={`/agents/${agent.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {initials}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                  {agent.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {agent.role || "AI Agent"}
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${providerColor}`}
            >
              {agent.provider}
            </span>
          </div>

          {agent.system_prompt && (
            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
              {agent.system_prompt}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span>{agent.model}</span>
            {agent.tools && agent.tools.length > 0 && (
              <span>{agent.tools.length} tools</span>
            )}
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
