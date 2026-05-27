"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { workflowsAPI, agentsAPI } from "@/lib/api";
import { useAgents } from "@/lib/hooks/useAgents";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import Link from "next/link";

function NewWorkflowContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { agents } = useAgents();
  const { nodes, edges, setNodes, setEdges } = useWorkflowStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [presets, setPresets] = useState<any[]>([]);

  useEffect(() => {
    agentsAPI.presets().then((res) => {
      if (res.data) setPresets(res.data as any[]);
    });
  }, []);

  // Pre-populate canvas from ?template= query param
  useEffect(() => {
    setNodes([]);
    setEdges([]);
    const templateName = searchParams.get("template");
    if (!templateName) return;

    setTemplateLoading(true);
    workflowsAPI.templates().then((res) => {
      setTemplateLoading(false);
      if (res.error || !res.data) return;

      const templates: any[] = (res.data as any).templates ?? [];
      const tpl = templates.find((t: any) => t.name === templateName);
      if (!tpl) return;

      // Pre-fill name and description
      setName(tpl.display_name || tpl.name);
      setDescription(tpl.description || "");

      // Pre-populate canvas — add animated flag to edges for React Flow styling
      const rawNodes = tpl.graph_definition?.nodes ?? [];
      const rawEdges = tpl.graph_definition?.edges ?? [];

      setNodes(rawNodes);
      setEdges(rawEdges.map((e: any) => ({ ...e, animated: true })));
    });
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePresetDropOnCanvas(preset: any) {
    const res = await agentsAPI.create({
      name: preset.name,
      role: preset.role,
      instructions: preset.instructions,
      provider: preset.provider,
      model: preset.model,
      tools: preset.tools ?? [],
    });
    const agent = res.data as any;
    return { agentId: agent.id, name: agent.name, role: agent.role, provider: agent.provider };
  }

  async function handleSave() {
    if (!name.trim()) {
      alert("Workflow name is required");
      return;
    }
    setSaving(true);
    const res = await workflowsAPI.create({ name, description, nodes, edges });
    setSaving(false);
    if (res.error) {
      alert(`Failed to save: ${res.error}`);
      return;
    }
    setNodes([]);
    setEdges([]);
    router.push("/workflows");
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-4 shrink-0">
        <Link
          href="/workflows"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          ← Back
        </Link>
        <div className="flex-1 grid grid-cols-2 gap-3 max-w-lg">
          <Input
            placeholder="Workflow name*"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="ml-auto flex gap-2">
          {templateLoading && (
            <span className="text-xs text-slate-400 dark:text-slate-500 self-center">
              Loading template…
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setNodes([]); setEdges([]); setName(""); setDescription(""); }}
          >
            Clear
          </Button>
          <Button size="sm" loading={saving} onClick={handleSave}>
            Save Workflow
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0">
        <WorkflowCanvas agents={agents} presets={presets} onPresetDrop={handlePresetDropOnCanvas} />
      </div>
    </div>
  );
}

export default function NewWorkflowPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-slate-500">Loading…</div>}>
      <NewWorkflowContent />
    </Suspense>
  );
}
