import useSWR from "swr";
import { workflowsAPI } from "@/lib/api";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { useEffect } from "react";

async function fetchWorkflows() {
  const res = await workflowsAPI.list();
  if (res.error) throw new Error(res.error);
  return (res.data as any[]) ?? [];
}

export function useWorkflows() {
  const setWorkflows = useWorkflowStore((s) => s.setWorkflows);
  const remove = useWorkflowStore((s) => s.remove);
  const { data, error, isLoading, mutate } = useSWR("/workflows", fetchWorkflows, {
    refreshInterval: 30_000,
  });

  useEffect(() => {
    if (data) setWorkflows(data);
  }, [data, setWorkflows]);

  return { workflows: data ?? [], error, isLoading, mutate, remove };
}
