"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { Agent } from "@/lib/stores/agentStore";

const PROVIDERS = [
  { value: "ollama", label: "Ollama (Local)" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "glm51", label: "Z.ai / GLM (Cloud)" },
  { value: "glm51-local", label: "GLM-5.1 (Local)" },
];

const AVAILABLE_TOOLS = [
  "web_search",
  "weather",
  "calculator",
  "code_executor",
  "http_request",
  "file_read",
  "file_write",
];

const CHANNELS = ["web", "telegram", "api"];

interface AgentFormProps {
  initial?: Partial<Agent>;
  onSubmit: (data: Partial<Agent>) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

export function AgentForm({
  initial = {},
  onSubmit,
  onCancel,
  submitLabel = "Save",
}: AgentFormProps) {
  const [form, setForm] = useState({
    name: initial.name ?? "",
    role: initial.role ?? "",
    system_prompt: initial.system_prompt ?? "",
    provider: initial.provider ?? "ollama",
    model: initial.model ?? "",
    tools: initial.tools ?? [],
    channels: initial.channels ?? [],
    memory_enabled: initial.memory_enabled ?? false,
    guardrails: {
      max_tokens: (initial.guardrails as any)?.max_tokens ?? "",
      rate_limit: (initial.guardrails as any)?.rate_limit ?? "",
    },
    schedule: initial.schedule ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(
    !!(initial.memory_enabled || initial.guardrails || initial.schedule)
  );

  function set(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  function toggleTool(tool: string) {
    const tools = form.tools as string[];
    set("tools", tools.includes(tool) ? tools.filter((t) => t !== tool) : [...tools, tool]);
  }

  function toggleChannel(ch: string) {
    const channels = form.channels as string[];
    set("channels", channels.includes(ch) ? channels.filter((c) => c !== ch) : [...channels, ch]);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.model.trim()) e.model = "Model is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      // Build guardrails only if any value is set
      const maxTokens = form.guardrails.max_tokens ? Number(form.guardrails.max_tokens) : null;
      const rateLimit = form.guardrails.rate_limit ? Number(form.guardrails.rate_limit) : null;
      const guardrails =
        maxTokens !== null || rateLimit !== null
          ? { max_tokens: maxTokens, rate_limit: rateLimit }
          : null;

      await onSubmit({
        ...form,
        guardrails,
        schedule: form.schedule.trim() || null,
      } as any);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Agent Name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          error={errors.name}
          placeholder="e.g. Research Assistant"
        />
        <Input
          label="Role"
          value={form.role}
          onChange={(e) => set("role", e.target.value)}
          placeholder="e.g. Researcher, Analyst"
        />
      </div>

      <Textarea
        label="System Prompt"
        value={form.system_prompt}
        onChange={(e) => set("system_prompt", e.target.value)}
        placeholder="Describe the agent's behavior, constraints, and goals..."
        rows={4}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Provider"
          value={form.provider}
          onChange={(e) => set("provider", e.target.value)}
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <Input
          label="Model"
          value={form.model}
          onChange={(e) => set("model", e.target.value)}
          error={errors.model}
          placeholder="e.g. llama3, gpt-4o, glm-5.1"
        />
      </div>

      {/* Tools */}
      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
          Tools
        </label>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_TOOLS.map((tool) => (
            <button
              key={tool}
              type="button"
              onClick={() => toggleTool(tool)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                (form.tools as string[]).includes(tool)
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-indigo-400 dark:hover:border-indigo-500"
              }`}
            >
              {tool}
            </button>
          ))}
        </div>
      </div>

      {/* Channels */}
      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
          Channels
        </label>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => toggleChannel(ch)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                (form.channels as string[]).includes(ch)
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-indigo-400 dark:hover:border-indigo-500"
              }`}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Configuration */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors"
        >
          <span>Advanced Configuration</span>
          <span className="text-slate-400">{showAdvanced ? "▲" : "▼"}</span>
        </button>

        {showAdvanced && (
          <div className="px-4 pb-4 space-y-4 border-t border-slate-200 dark:border-slate-700 pt-4">
            {/* Memory */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Enable Memory
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Persist conversation history across runs
                </p>
              </div>
              <button
                type="button"
                onClick={() => set("memory_enabled", !form.memory_enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.memory_enabled
                    ? "bg-indigo-600"
                    : "bg-slate-200 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.memory_enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Guardrails */}
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Guardrails
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Max Tokens"
                  type="number"
                  value={form.guardrails.max_tokens}
                  onChange={(e) =>
                    set("guardrails", { ...form.guardrails, max_tokens: e.target.value })
                  }
                  placeholder="e.g. 2000"
                />
                <Input
                  label="Rate Limit (req/min)"
                  type="number"
                  value={form.guardrails.rate_limit}
                  onChange={(e) =>
                    set("guardrails", { ...form.guardrails, rate_limit: e.target.value })
                  }
                  placeholder="e.g. 10"
                />
              </div>
            </div>

            {/* Schedule */}
            <div>
              <Input
                label="Schedule (cron)"
                value={form.schedule}
                onChange={(e) => set("schedule", e.target.value)}
                placeholder="e.g. 0 9 * * * (every day at 9am)"
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Leave blank to disable scheduled runs. Format: minute hour day month weekday
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
