import useSWR from "swr";
import { executionsAPI } from "@/lib/api";
import { useExecutionStore } from "@/lib/stores/executionStore";
import { useEffect } from "react";

function makeKey(workflowId?: string) {
  return workflowId ? `/executions?workflow_id=${workflowId}` : "/executions";
}

async function fetchExecutions(key: string) {
  const workflowId = key.includes("workflow_id=")
    ? key.split("workflow_id=")[1]
    : undefined;
  const res = await executionsAPI.list(workflowId);
  if (res.error) throw new Error(res.error);
  return (res.data as any[]) ?? [];
}

export function useExecutions(workflowId?: string) {
  const setExecutions = useExecutionStore((s) => s.setExecutions);
  const { data, error, isLoading, mutate } = useSWR(
    makeKey(workflowId),
    fetchExecutions,
    { refreshInterval: 5_000 }
  );

  useEffect(() => {
    if (data) setExecutions(data);
  }, [data, setExecutions]);

  return { executions: data ?? [], error, isLoading, mutate };
}
