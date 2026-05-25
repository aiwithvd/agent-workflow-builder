"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { AgentForm } from "@/components/agents/AgentForm";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { agentsAPI } from "@/lib/api";
import { useAgentStore } from "@/lib/stores/agentStore";
import Link from "next/link";

export default function AgentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { upsert, remove } = useAgentStore();

  useEffect(() => {
    agentsAPI.get(id).then((res) => {
      if (res.data) setAgent(res.data);
      setLoading(false);
    });
  }, [id]);

  async function handleUpdate(data: any) {
    const res = await agentsAPI.update(id, data);
    if (res.error) {
      alert(`Update failed: ${res.error}`);
      return;
    }
    if (res.data) {
      upsert(res.data as any);
      setAgent(res.data);
    }
    router.push("/agents");
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await agentsAPI.delete(id);
    if (res.error) {
      alert(`Delete failed: ${res.error}`);
      setDeleting(false);
      return;
    }
    remove(id);
    router.push("/agents");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="max-w-2xl">
        <p className="text-slate-500 dark:text-slate-400">Agent not found.</p>
        <Link href="/agents">
          <Button variant="ghost" className="mt-4">Back to agents</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/agents"
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-2 inline-flex items-center gap-1"
          >
            ← Back to agents
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {agent.name}
          </h1>
        </div>
        <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
          Delete
        </Button>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Edit agent configuration
          </p>
        </CardHeader>
        <CardBody>
          <AgentForm
            initial={agent}
            onSubmit={handleUpdate}
            onCancel={() => router.push("/agents")}
            submitLabel="Save Changes"
          />
        </CardBody>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Agent"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-slate-600 dark:text-slate-400">
          Are you sure you want to delete <strong>{agent.name}</strong>? This
          action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
