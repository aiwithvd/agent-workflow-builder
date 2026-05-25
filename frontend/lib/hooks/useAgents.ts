import useSWR from "swr";
import { agentsAPI } from "@/lib/api";
import { useAgentStore } from "@/lib/stores/agentStore";
import { useEffect } from "react";

async function fetchAgents() {
  const res = await agentsAPI.list();
  if (res.error) throw new Error(res.error);
  return (res.data as any[]) ?? [];
}

export function useAgents() {
  const setAgents = useAgentStore((s) => s.setAgents);
  const { data, error, isLoading, mutate } = useSWR("/agents", fetchAgents, {
    refreshInterval: 30_000,
  });

  useEffect(() => {
    if (data) setAgents(data);
  }, [data, setAgents]);

  return { agents: data ?? [], error, isLoading, mutate };
}
