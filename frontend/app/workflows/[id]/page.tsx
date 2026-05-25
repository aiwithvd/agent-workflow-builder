"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { type Node } from "@xyflow/react";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Spinner } from "@/components/ui/Spinner";
import { workflowsAPI, executionsAPI, agentsAPI, createMonitorWebSocket } from "@/lib/api";
import { useAgents } from "@/lib/hooks/useAgents";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { useAgentStore, type Agent } from "@/lib/stores/agentStore";
import Link from "next/link";

// ─── Constants ────────────────────────────────────────────────────────────────

const PROVIDERS = [
  { value: "ollama", label: "Ollama (Local)" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "glm51", label: "GLM-5.1 (Cloud)" },
  { value: "glm51-local", label: "GLM-5.1 (Local)" },
];
const AVAILABLE_TOOLS = ["web_search","weather","calculator","code_executor","http_request","file_read","file_write"];

// ─── Input Node Panel ──────────────────────────────────────────────────────────

function InputNodePanel({
  onClose,
  onRunNow,
  defaultMessage,
  onDefaultMessageChange,
  onSave,
}: {
  onClose: () => void;
  onRunNow: () => void;
  defaultMessage: string;
  onDefaultMessageChange: (v: string) => void;
  onSave?: (msg: string) => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute top-0 right-0 h-full w-80 z-40 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Input Node</p>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">User Input</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* How input flows */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">How input flows</p>
            <ol className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 list-decimal list-inside">
              <li>Click <span className="font-semibold text-indigo-600 dark:text-indigo-400">▶ Run</span> in the toolbar</li>
              <li>A dialog asks you to type a message or task</li>
              <li>That message enters the workflow here at this node</li>
              <li>It flows to the first connected agent as their task</li>
            </ol>
          </div>

          {/* Default message */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Default message <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={defaultMessage}
              onChange={(e) => onDefaultMessageChange(e.target.value)}
              placeholder="Pre-fill the Run dialog with this message…"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <p className="text-xs text-slate-400">This will pre-fill the run dialog so you don&apos;t have to retype it each time.</p>
          </div>

          {/* Supported trigger types */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Input sources</p>
            <div className="space-y-1.5">
              {[
                { icon: "💬", label: "Web Run", desc: "Type a message when you click ▶ Run", active: true },
                { icon: "📱", label: "Telegram", desc: "Add a Telegram Trigger node to receive messages from your bot", active: false },
                { icon: "⏰", label: "Schedule", desc: "Add a Schedule Trigger node to run on a cron", active: false },
              ].map((s) => (
                <div key={s.label} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${s.active ? "bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700" : "bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"}`}>
                  <span>{s.icon}</span>
                  <div>
                    <p className={`font-medium ${s.active ? "text-indigo-700 dark:text-indigo-300" : "text-slate-600 dark:text-slate-400"}`}>{s.label}{s.active && <span className="ml-1 text-indigo-500">● active</span>}</p>
                    <p className="text-slate-500 dark:text-slate-500">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 text-sm py-2 text-slate-600 dark:text-slate-400">Close</button>
          {onSave && (
            <button
              onClick={() => { onSave(defaultMessage); onClose(); }}
              className="flex-1 rounded-lg border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 text-sm py-2"
            >
              Save
            </button>
          )}
          <button onClick={() => { onClose(); onRunNow(); }} className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2">▶ Run now</button>
        </div>
      </div>
    </>
  );
}

// ─── Output Node Panel ─────────────────────────────────────────────────────────

function OutputNodePanel({
  node,
  workflowId,
  onClose,
  onSave,
}: {
  node: Node;
  workflowId: string;
  onClose: () => void;
  onSave: (nodeId: string, data: Record<string, unknown>) => void;
}) {
  const d = node.data as any;
  // Read from nested 'delivery' sub-object (executor-compatible format) with
  // fallback to legacy flat fields for backwards compatibility.
  const storedDelivery = d.delivery ?? {};
  const [deliveryDisplay] = useState(true); // always on
  const [deliveryTelegram, setDeliveryTelegram] = useState<boolean>(
    storedDelivery.telegram ?? d.deliveryTelegram ?? false
  );
  const [deliveryWebhook, setDeliveryWebhook] = useState<boolean>(
    storedDelivery.webhook ?? d.deliveryWebhook ?? false
  );
  const [webhookUrl, setWebhookUrl] = useState<string>(
    storedDelivery.webhook_url ?? d.webhookUrl ?? ""
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSave() {
    // Save as nested 'delivery' object — matches what executor.py reads
    onSave(node.id, {
      delivery: {
        telegram: deliveryTelegram,
        webhook: deliveryWebhook,
        webhook_url: webhookUrl,
      },
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute top-0 right-0 h-full w-80 z-40 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Output Node</p>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Final Result</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Where results go */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Where does the output go?</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              After the workflow finishes, the final agent&apos;s response is the output. Choose where it&apos;s delivered below.
            </p>
          </div>

          {/* Delivery channels */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Delivery channels</p>

            {/* Display — always on */}
            <div className="flex items-center justify-between rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">🖥 Display on execution page</p>
                <p className="text-xs text-indigo-500 dark:text-indigo-400">Always on — view results at Executions</p>
              </div>
              <span className="text-xs bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-full px-2 py-0.5">Always</span>
            </div>

            {/* Telegram */}
            <div className={`rounded-lg border px-3 py-2.5 space-y-2 ${deliveryTelegram ? "border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">📱 Telegram reply</p>
                <button
                  type="button"
                  onClick={() => setDeliveryTelegram(v => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${deliveryTelegram ? "bg-purple-600" : "bg-slate-200 dark:bg-slate-700"}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${deliveryTelegram ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>
              {deliveryTelegram && (
                <p className="text-xs text-purple-600 dark:text-purple-400">Sends the result back to the Telegram user who triggered this workflow. Requires a Telegram Trigger node.</p>
              )}
            </div>

            {/* Webhook */}
            <div className={`rounded-lg border px-3 py-2.5 space-y-2 ${deliveryWebhook ? "border-teal-200 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/20" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">🔗 Webhook POST</p>
                <button
                  type="button"
                  onClick={() => setDeliveryWebhook(v => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${deliveryWebhook ? "bg-teal-600" : "bg-slate-200 dark:bg-slate-700"}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${deliveryWebhook ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>
              {deliveryWebhook && (
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-server.com/webhook"
                  className="w-full rounded-md border border-teal-200 dark:border-teal-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              )}
            </div>
          </div>

          {/* View executions link */}
          <Link
            href={`/executions?workflow_id=${workflowId}`}
            className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
          >
            <span>View past execution results</span>
            <span>→</span>
          </Link>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 text-sm py-2 text-slate-600 dark:text-slate-400">Cancel</button>
          <button onClick={handleSave} className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2">Save</button>
        </div>
      </div>
    </>
  );
}

// ─── Trigger Config Panel ──────────────────────────────────────────────────────

function TriggerConfigPanel({
  node,
  onClose,
  onSave,
}: {
  node: Node;
  onClose: () => void;
  onSave: (nodeId: string, data: Record<string, unknown>) => void;
}) {
  const d = node.data as any;
  const panelRef = useRef<HTMLDivElement>(null);

  // Local form state — initialise from existing node data
  const [label, setLabel] = useState<string>(d.label ?? "");
  const [cron, setCron] = useState<string>(d.cron ?? "");
  const [inputMessage, setInputMessage] = useState<string>(d.inputMessage ?? "");
  const [botUsername, setBotUsername] = useState<string>(d.botUsername ?? "");
  const [botToken, setBotToken] = useState<string>(d.botToken ?? "");
  const [description, setDescription] = useState<string>(d.description ?? "");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSave() {
    const base = { label };
    if (node.type === "telegram_trigger") {
      onSave(node.id, { ...base, botUsername, botToken });
    } else if (node.type === "schedule_trigger") {
      onSave(node.id, { ...base, cron, inputMessage });
    } else {
      onSave(node.id, { ...base, description });
    }
  }

  const typeLabels: Record<string, { title: string; color: string }> = {
    telegram_trigger: { title: "Telegram Trigger", color: "text-purple-600 dark:text-purple-400" },
    schedule_trigger: { title: "Schedule Trigger", color: "text-teal-600 dark:text-teal-400" },
    web_trigger: { title: "Web Chat Trigger", color: "text-blue-600 dark:text-blue-400" },
  };
  const meta = typeLabels[node.type ?? ""] ?? { title: "Trigger", color: "text-slate-600" };

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div
        ref={panelRef}
        className="absolute top-0 right-0 h-full w-80 z-40 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${meta.color}`}>
              {meta.title}
            </p>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Configure trigger
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Label (all trigger types) */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Display label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Customer Bot"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Telegram-specific fields */}
          {node.type === "telegram_trigger" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Bot username
                </label>
                <input
                  type="text"
                  value={botUsername}
                  onChange={(e) => setBotUsername(e.target.value)}
                  placeholder="mybot (without @)"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Bot token{" "}
                  <span className="text-slate-400 font-normal">(overrides global setting)</span>
                </label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="Leave blank to use global token"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 px-3 py-2.5 text-xs text-purple-700 dark:text-purple-400">
                When a user messages your bot, this workflow will run automatically.
              </div>
            </>
          )}

          {/* Schedule-specific fields */}
          {node.type === "schedule_trigger" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Cron expression
                </label>
                <input
                  type="text"
                  value={cron}
                  onChange={(e) => setCron(e.target.value)}
                  placeholder="0 9 * * 1-5  (weekdays at 9 AM)"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-400">
                  Format: minute hour day month weekday
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Input message
                </label>
                <textarea
                  rows={3}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="What the workflow should do when triggered…"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </>
          )}

          {/* Web Chat-specific fields */}
          {node.type === "web_trigger" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Customer support entry point"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 px-3 py-2.5 text-xs text-blue-700 dark:text-blue-400">
                This workflow can be triggered from the web UI. No credentials required.
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} className="flex-1">
            Save
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── Node Config Panel ─────────────────────────────────────────────────────────

function NodeConfigPanel({
  node,
  agents,
  onClose,
  onAssign,
  onSaveAgent,
  onDeleteNode,
}: {
  node: Node;
  agents: Agent[];
  onClose: () => void;
  onAssign: (nodeId: string, agentId: string) => void;
  onSaveAgent: (nodeId: string, agentId: string, form: Partial<Agent>) => Promise<void>;
  onDeleteNode: (nodeId: string) => void;
}) {
  const d = node.data as any;
  const displayName = d.label || d.name || "Agent Node";
  const currentAgentId = d.agentId as string | null | undefined;

  const [selectedAgentId, setSelectedAgentId] = useState(currentAgentId ?? "");
  const panelRef = useRef<HTMLDivElement>(null);

  const currentAgent = agents.find(a => a.id === currentAgentId);
  const [agentForm, setAgentForm] = useState<Partial<Agent>>({
    name: currentAgent?.name ?? "",
    role: currentAgent?.role ?? "",
    system_prompt: currentAgent?.system_prompt ?? "",
    provider: currentAgent?.provider ?? "",
    model: currentAgent?.model ?? "",
    tools: currentAgent?.tools ?? [],
    memory_enabled: currentAgent?.memory_enabled ?? false,
  });
  const [savingAgent, setSavingAgent] = useState(false);
  const [changeAgentOpen, setChangeAgentOpen] = useState(!currentAgentId);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleAssign() {
    if (selectedAgentId) onAssign(node.id, selectedAgentId);
  }

  const previewAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="absolute top-0 right-0 h-full w-80 z-40 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Agent Node
            </p>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
              {displayName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {currentAgentId ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Name</label>
                <input value={agentForm.name ?? ""} onChange={e => setAgentForm(f => ({...f, name: e.target.value}))} className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Role</label>
                <input value={agentForm.role ?? ""} onChange={e => setAgentForm(f => ({...f, role: e.target.value}))} className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">System Prompt</label>
                <textarea rows={5} value={agentForm.system_prompt ?? ""} onChange={e => setAgentForm(f => ({...f, system_prompt: e.target.value}))} className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Provider</label>
                <select value={agentForm.provider ?? ""} onChange={e => setAgentForm(f => ({...f, provider: e.target.value}))} className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100">
                  {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Model</label>
                <input value={agentForm.model ?? ""} onChange={e => setAgentForm(f => ({...f, model: e.target.value}))} className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">Tools</label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_TOOLS.map(tool => (
                    <button key={tool} type="button" onClick={() => { const cur = agentForm.tools ?? []; setAgentForm(f => ({...f, tools: cur.includes(tool) ? cur.filter((t: string) => t !== tool) : [...cur, tool]})); }} className={`px-2 py-1 rounded text-xs font-medium transition-colors ${(agentForm.tools ?? []).includes(tool) ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"}`}>{tool}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Memory</label>
                <button type="button" onClick={() => setAgentForm(f => ({...f, memory_enabled: !f.memory_enabled}))} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${agentForm.memory_enabled ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"}`}><span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${agentForm.memory_enabled ? "translate-x-5" : "translate-x-1"}`} /></button>
              </div>
              <div>
                <button type="button" onClick={() => setChangeAgentOpen(o => !o)} className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1">{changeAgentOpen ? "▴" : "▾"} Change Agent</button>
                {changeAgentOpen && (
                  <div className="mt-2 space-y-2">
                    <Select
                      label=""
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                    >
                      <option value="">— Select an agent —</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.provider} · {a.model})
                        </option>
                      ))}
                    </Select>
                    {previewAgent && previewAgent.id !== currentAgentId && (
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2.5 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                        <p className="font-medium text-slate-800 dark:text-slate-200">{previewAgent.name}</p>
                        {previewAgent.role && <p>Role: {previewAgent.role}</p>}
                        <p>{previewAgent.provider} · {previewAgent.model}</p>
                        {previewAgent.tools && previewAgent.tools.length > 0 && (
                          <p>Tools: {previewAgent.tools.join(", ")}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Warning if unassigned */}
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2.5">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  ⚠ No agent assigned
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                  This node won't execute until an agent is selected below.
                </p>
              </div>

              {/* Agent picker */}
              <div className="space-y-3">
                <Select
                  label="Assign agent"
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                >
                  <option value="">— Select an agent —</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.provider} · {a.model})
                    </option>
                  ))}
                </Select>

                {/* Preview selected agent */}
                {previewAgent && previewAgent.id !== currentAgentId && (
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2.5 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {previewAgent.name}
                    </p>
                    {previewAgent.role && <p>Role: {previewAgent.role}</p>}
                    <p>
                      {previewAgent.provider} · {previewAgent.model}
                    </p>
                    {previewAgent.tools && previewAgent.tools.length > 0 && (
                      <p>Tools: {previewAgent.tools.join(", ")}</p>
                    )}
                  </div>
                )}

                {agents.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No agents yet.{" "}
                    <Link
                      href="/agents/new"
                      className="text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Create one first →
                    </Link>
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-2">
          {currentAgentId ? (
            <>
              <button onClick={() => { setSavingAgent(true); onSaveAgent(node.id, currentAgentId, agentForm).finally(() => setSavingAgent(false)); }} disabled={savingAgent} className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 disabled:opacity-50">
                {savingAgent ? "Saving…" : "Save Changes"}
              </button>
              <button onClick={onClose} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 text-sm py-2 text-slate-600 dark:text-slate-400">Cancel</button>
            </>
          ) : (
            <button onClick={() => selectedAgentId && onAssign(node.id, selectedAgentId)} disabled={!selectedAgentId} className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2">Assign Agent</button>
          )}
          <button onClick={() => onDeleteNode(node.id)} className="w-full rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm py-2 hover:bg-red-50 dark:hover:bg-red-950/20">🗑 Delete Node</button>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkflowDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { agents } = useAgents();
  const { nodes, edges, setNodes, setEdges } = useWorkflowStore();
  const { upsert } = useAgentStore();

  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  // Node config panel
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Run modal
  const [showRunModal, setShowRunModal] = useState(false);
  const [runInput, setRunInput] = useState("");
  const [runError, setRunError] = useState<string | null>(null);

  // Input node default message (pre-fills run dialog)
  const [defaultRunInput, setDefaultRunInput] = useState("");

  // Canvas execution overlay — live node status while a run is active
  const [activeExecId, setActiveExecId] = useState<string | null>(null);
  const [nodeStatus, setNodeStatus] = useState<Record<string, "running" | "done" | "error">>({});
  const wsOverlayRef = useRef<WebSocket | null>(null);

  // Connect to WebSocket when execution starts, update node border colours
  const startOverlay = useCallback((execId: string) => {
    setActiveExecId(execId);
    setNodeStatus({});
    const ws = createMonitorWebSocket(execId);
    wsOverlayRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === "step_start" && ev.node_id) {
          setNodeStatus(prev => ({ ...prev, [ev.node_id]: "running" }));
        } else if (ev.type === "step_complete" && ev.node_id) {
          setNodeStatus(prev => ({ ...prev, [ev.node_id]: "done" }));
        } else if (ev.type === "execution_complete" || ev.type === "execution_failed") {
          setActiveExecId(null);
          ws.close();
        }
      } catch { /* ignore parse errors */ }
    };
    ws.onclose = () => setActiveExecId(null);
  }, []);

  useEffect(() => {
    return () => { wsOverlayRef.current?.close(); };
  }, []);

  useEffect(() => {
    workflowsAPI.get(id).then((res) => {
      if (res.data) {
        const wf = res.data as any;
        setWorkflow(wf);
        const graphDef = wf.graph_definition ?? {};
        setNodes(wf.nodes ?? graphDef.nodes ?? []);
        setEdges(wf.edges ?? graphDef.edges ?? []);
      }
      setLoading(false);
    });
    return () => {
      setNodes([]);
      setEdges([]);
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Count unassigned agent-like nodes (agent, supervisor, swarm)
  const unassignedCount = nodes.filter(
    (n) => ["agent", "supervisor", "swarm"].includes(n.type ?? "") && !(n.data as any).agentId
  ).length;

  function handleNodeClick(node: Node) {
    const agentLikeTypes = ["agent", "supervisor", "swarm"];
    const triggerTypes = ["telegram_trigger", "schedule_trigger", "web_trigger"];
    if (
      agentLikeTypes.includes(node.type ?? "") ||
      node.type === "input" ||
      node.type === "output" ||
      triggerTypes.includes(node.type ?? "")
    ) {
      setSelectedNode(node);
    }
  }

  function assignAgentToNode(nodeId: string, agentId: string) {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;
    setNodes(
      nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                agentId: agent.id,
                name: agent.name,
                label: agent.name,
                role: agent.role,
                provider: agent.provider,
              },
            }
          : n
      )
    );
    setSelectedNode(null);
  }

  function updateTriggerNode(nodeId: string, data: Record<string, unknown>) {
    setNodes(
      nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      )
    );
    setSelectedNode(null);
  }

  async function handleSaveAgent(nodeId: string, agentId: string, form: Partial<Agent>) {
    const res = await agentsAPI.update(agentId, form);
    if (res.error) { console.error("Failed to save agent:", res.error); return; }
    upsert(res.data as Agent);
    setNodes(nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, name: (form as any).name ?? n.data.name, role: (form as any).role ?? n.data.role, provider: (form as any).provider ?? n.data.provider } } : n));
    setSelectedNode(null);
  }
  function handleDeleteNode(nodeId: string) {
    setNodes(nodes.filter(n => n.id !== nodeId));
    setEdges(edges.filter(e => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }

  async function handleSave() {
    setSaving(true);
    await workflowsAPI.update(id, { nodes, edges });
    setSaving(false);
  }

  function updateOutputNode(nodeId: string, data: Record<string, unknown>) {
    // data contains { delivery: { telegram, webhook, webhook_url } }
    // Merge into node.data so graph_definition carries the delivery config.
    setNodes(nodes.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
    setSelectedNode(null);
  }

  function handleRunClick() {
    setRunError(null);
    if (unassignedCount > 0) {
      setRunError(
        `${unassignedCount} node${unassignedCount > 1 ? "s" : ""} need an agent assigned. Click each ⚠ node to assign.`
      );
      return;
    }
    // Pre-fill with default message from Input node if set
    setRunInput(defaultRunInput);
    setShowRunModal(true);
  }

  async function handleRunConfirm() {
    setShowRunModal(false);
    setRunning(true);
    const res = await executionsAPI.create({
      workflow_id: id,
      input: { message: runInput.trim() || "Run this workflow." },
    });
    setRunning(false);
    if (res.error) {
      setRunError(`Failed to start: ${res.error}`);
      return;
    }
    const exec = res.data as any;
    // Stay on canvas so the node-status overlay is visible while the run
    // progresses.  The blue banner shows a "View live →" link so the user
    // can still jump to the execution detail page at any time.
    startOverlay(exec.id);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const agentNodeCount = nodes.filter((n) => ["agent", "supervisor", "swarm"].includes(n.type ?? "")).length;

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
        <div>
          <h1 className="font-semibold text-slate-900 dark:text-slate-100">
            {workflow?.name}
          </h1>
          {workflow?.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {workflow.description}
            </p>
          )}
        </div>

        {/* Validation hint */}
        {unassignedCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-1.5">
            <span>⚠</span>
            <span>
              {unassignedCount} of {agentNodeCount} nodes need an agent
            </span>
          </div>
        )}

        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" loading={saving} onClick={handleSave}>
            Save
          </Button>
          <Button size="sm" loading={running} onClick={handleRunClick}>
            ▶ Run
          </Button>
        </div>
      </div>

      {/* Run error banner */}
      {runError && (
        <div className="shrink-0 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-2.5 flex items-center justify-between">
          <p className="text-sm text-red-700 dark:text-red-400">{runError}</p>
          <button
            onClick={() => setRunError(null)}
            className="text-red-400 hover:text-red-600 dark:hover:text-red-200 ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Canvas execution overlay banner */}
      {activeExecId && (
        <div className="shrink-0 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 px-4 py-2.5 flex items-center gap-3">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <p className="text-sm text-blue-700 dark:text-blue-300 flex-1">
            Workflow is running — agent nodes will light up as they execute.
          </p>
          <Link
            href={`/executions/${activeExecId}`}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0"
          >
            View live →
          </Link>
        </div>
      )}

      {/* Canvas (relative so the panel can overlay it) */}
      <div className="flex-1 min-h-0 relative">
        <WorkflowCanvas agents={agents} onNodeClick={handleNodeClick} nodeStatus={nodeStatus} />

        {/* Node config panel — overlays the canvas */}
        {selectedNode && ["agent", "supervisor", "swarm"].includes(selectedNode.type ?? "") && (
          <NodeConfigPanel
            node={selectedNode}
            agents={agents}
            onClose={() => setSelectedNode(null)}
            onAssign={assignAgentToNode}
            onSaveAgent={handleSaveAgent}
            onDeleteNode={handleDeleteNode}
          />
        )}

        {/* Trigger config panel — for telegram/schedule/web_trigger nodes */}
        {selectedNode &&
          ["telegram_trigger", "schedule_trigger", "web_trigger"].includes(
            selectedNode.type ?? ""
          ) && (
            <TriggerConfigPanel
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onSave={updateTriggerNode}
            />
          )}

        {/* Input node panel */}
        {selectedNode && selectedNode.type === "input" && (
          <InputNodePanel
            onClose={() => setSelectedNode(null)}
            onRunNow={handleRunClick}
            defaultMessage={defaultRunInput}
            onDefaultMessageChange={setDefaultRunInput}
            onSave={(msg) => {
              // Persist defaultMessage into the node.data so it shows on the canvas
              // and is preserved when the workflow is saved.
              const nodeId = selectedNode.id;
              setNodes(nodes.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, defaultMessage: msg } } : n
              ));
            }}
          />
        )}

        {/* Output node panel */}
        {selectedNode && selectedNode.type === "output" && (
          <OutputNodePanel
            node={selectedNode}
            workflowId={id}
            onClose={() => setSelectedNode(null)}
            onSave={updateOutputNode}
          />
        )}
      </div>

      {/* Run input modal */}
      <Modal
        open={showRunModal}
        onClose={() => setShowRunModal(false)}
        title={`Run: ${workflow?.name ?? "Workflow"}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRunModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleRunConfirm} loading={running}>
              ▶ Run Workflow
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Enter a task or message for this workflow. The agents will use this as their starting input.
          </p>
          <Textarea
            label="Input message"
            rows={4}
            placeholder="e.g. Research the latest advances in quantum computing and write a structured report."
            value={runInput}
            onChange={(e) => setRunInput(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-slate-400 dark:text-slate-500">
            You can watch the execution live on the next page.
          </p>
        </div>
      </Modal>
    </div>
  );
}
