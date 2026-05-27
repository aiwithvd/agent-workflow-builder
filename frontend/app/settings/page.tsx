"use client";

import { useEffect, useState } from "react";
import { settingsAPI } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Setting {
  key: string;
  value: string | null;
  is_secret: boolean;
  description: string | null;
}

// ─── Provider configs ─────────────────────────────────────────────────────────

interface ProviderConfig {
  id: string;
  name: string;
  fields: { key: string; label: string; type: "secret" | "url" | "text"; placeholder?: string }[];
}

const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    fields: [{ key: "openai_api_key", label: "API Key", type: "secret", placeholder: "sk-..." }],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    fields: [{ key: "anthropic_api_key", label: "API Key", type: "secret", placeholder: "sk-ant-..." }],
  },
  {
    id: "google",
    name: "Google Gemini",
    fields: [{ key: "google_api_key", label: "API Key", type: "secret", placeholder: "AI..." }],
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    fields: [{ key: "ollama_url", label: "Server URL", type: "url", placeholder: "http://localhost:11434" }],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    fields: [{ key: "openrouter_api_key", label: "API Key", type: "secret", placeholder: "sk-or-..." }],
  },
  {
    id: "zai",
    name: "Z.AI",
    fields: [
      { key: "z_ai_api_key", label: "API Key", type: "secret" },
      { key: "z_ai_base_url", label: "Base URL", type: "url", placeholder: "https://api.z.ai/v1" },
    ],
  },
];

// ─── Tool configs ─────────────────────────────────────────────────────────────

interface ToolConfig {
  tool: string;
  name: string;
  keys: string[];
  note?: string;
}

const TOOL_CONFIGS: ToolConfig[] = [
  { tool: "weather", name: "Weather (OpenWeatherMap)", keys: ["openweather_api_key"] },
  { tool: "web_search", name: "Web Search (DuckDuckGo)", keys: [], note: "No API key needed" },
  { tool: "calculator", name: "Calculator", keys: [], note: "Built-in tool" },
  { tool: "code_executor", name: "Code Executor", keys: [], note: "Built-in tool" },
  { tool: "http_request", name: "HTTP Request", keys: [], note: "No API key needed" },
  { tool: "file_read", name: "File Read", keys: [], note: "Built-in tool" },
  { tool: "file_write", name: "File Write", keys: [], note: "Built-in tool" },
];

// ─── Section definitions ──────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: "telegram",
    title: "Telegram",
    icon: (
      <svg className="w-4 h-4 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.01 9.47c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L6.51 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.535-.194 1.003.13.306.969z" />
      </svg>
    ),
    description: "Bot token and username for receiving messages and sending workflow results via Telegram.",
    keys: ["telegram_bot_token", "telegram_bot_username"],
  },
  {
    id: "observability",
    title: "Observability (Langfuse)",
    icon: (
      <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    description: "Langfuse credentials for LLM tracing and monitoring.",
    keys: ["langfuse_public_key", "langfuse_secret_key", "langfuse_host", "langfuse_project"],
  },
];

// ─── Key labels ───────────────────────────────────────────────────────────────

const KEY_LABELS: Record<string, string> = {
  telegram_bot_token: "Bot Token",
  telegram_bot_username: "Bot Username",
  openrouter_api_key: "API Key",
  ollama_url: "Server URL",
  openai_api_key: "API Key",
  anthropic_api_key: "API Key",
  google_api_key: "API Key",
  z_ai_api_key: "API Key",
  z_ai_base_url: "Base URL",
  openweather_api_key: "API Key",
  langfuse_public_key: "Public Key",
  langfuse_secret_key: "Secret Key",
  langfuse_host: "Host URL",
  langfuse_project: "Project Name",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    const res = await settingsAPI.list();
    if (res.error) {
      setError(res.error);
    } else {
      const list = (res.data as Setting[]) ?? [];
      setSettings(list);
      const initial: Record<string, string> = {};
      for (const s of list) {
        initial[s.key] = s.is_secret ? "" : (s.value ?? "");
      }
      setDraft(initial);
    }
    setLoading(false);
  }

  async function handleSave(sectionKeys: string[]) {
    setSaving(true);
    setError(null);
    const toSave = sectionKeys
      .filter((k) => draft[k] !== undefined && draft[k] !== "")
      .map((k) => ({ key: k, value: draft[k] }));

    if (toSave.length === 0) {
      setSaving(false);
      return;
    }

    const res = await settingsAPI.update(toSave);
    setSaving(false);
    if (res.error) {
      setError(res.error);
    } else {
      const updated = (res.data as Setting[]) ?? [];
      setSettings(updated);
      const cleared = { ...draft };
      for (const k of sectionKeys) {
        const setting = updated.find((s) => s.key === k);
        if (setting?.is_secret) cleared[k] = "";
      }
      setDraft(cleared);
      setEditMode({});
      setSaved(sectionKeys.join(","));
      setTimeout(() => setSaved(null), 3000);
    }
  }

  async function enterEditMode(key: string) {
    const setting = settings.find((s) => s.key === key);
    if (setting?.is_secret) {
      const res = await settingsAPI.getRaw(key);
      if (res.data?.value) {
        setDraft((d) => ({ ...d, [key]: res.data!.value! }));
      }
    }
    setEditMode((m) => ({ ...m, [key]: true }));
  }

  function cancelEdit(key: string) {
    const setting = settings.find((s) => s.key === key);
    setDraft((d) => ({ ...d, [key]: setting?.is_secret ? "" : (setting?.value ?? "") }));
    setEditMode((m) => ({ ...m, [key]: false }));
    setRevealed((r) => ({ ...r, [key]: false }));
  }

  function getSettingByKey(key: string): Setting | undefined {
    return settings.find((s) => s.key === key);
  }

  function isSet(key: string): boolean {
    const s = getSettingByKey(key);
    return !!s?.value;
  }

  function toggleProvider(id: string) {
    setExpandedProviders((p) => ({ ...p, [id]: !p[id] }));
  }

  // ─── Credential field renderer ────────────────────────────────────────────

  function renderField(key: string) {
    const setting = getSettingByKey(key);
    const isSecret = setting?.is_secret ?? false;
    const hasValue = isSet(key);
    const isRevealed = revealed[key] ?? false;
    const isEditing = editMode[key] ?? false;

    return (
      <div key={key} className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {KEY_LABELS[key] ?? key}
            {isSecret && (
              <span className="ml-1.5 text-xs text-slate-400 font-normal">secret</span>
            )}
          </label>
          <div className="flex items-center gap-2">
            {hasValue && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ Set
              </span>
            )}
            {hasValue && !isEditing && (
              <button
                type="button"
                onClick={() => enterEditMode(key)}
                className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
              >
                Edit
              </button>
            )}
            {isEditing && (
              <button
                type="button"
                onClick={() => cancelEdit(key)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Show masked preview when set and not editing */}
        {hasValue && !isEditing && isSecret ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-sm text-slate-500 dark:text-slate-400 font-mono">
            ••••••••••••
          </div>
        ) : hasValue && !isEditing && !isSecret ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-sm text-slate-700 dark:text-slate-300">
            {setting?.value}
          </div>
        ) : (
          <div className="relative">
            <input
              type={isSecret && !isRevealed ? "password" : "text"}
              value={draft[key] ?? ""}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              placeholder={`Enter ${KEY_LABELS[key] ?? key}...`}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
            />
            {isSecret && (
              <button
                type="button"
                onClick={() => setRevealed({ ...revealed, [key]: !isRevealed })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title={isRevealed ? "Hide" : "Show"}
              >
                {isRevealed ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            )}
          </div>
        )}

        {setting?.description && (
          <p className="text-xs text-slate-400 dark:text-slate-500">{setting.description}</p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  // Collect all LLM provider keys for saving
  const allLlmKeys = PROVIDER_CONFIGS.flatMap((p) => p.fields.map((f) => f.key));
  const allToolKeys = TOOL_CONFIGS.flatMap((t) => t.keys);
  const isLlmSaved = saved?.includes("openrouter_api_key") || saved?.includes("openai_api_key");
  const isToolsSaved = saved?.includes("openweather_api_key");

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Global platform credentials and configuration. Secrets are stored securely and masked after saving.
        </p>
      </div>

      {/* Global error */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Telegram + Langfuse sections (standard key-value) */}
      {SECTIONS.map((section) => {
        const isSectionSaved = saved?.includes(section.keys[0]);
        return (
          <div
            key={section.id}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                {section.icon}
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{section.title}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{section.description}</p>
              </div>
            </div>

            <div className="px-5 py-4 space-y-4">
              {section.keys.map((key) => renderField(key))}
            </div>

            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-400">
                {isSectionSaved ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Saved</span>
                ) : (
                  section.keys.some((k) => draft[k]) ? "Unsaved changes" : ""
                )}
              </div>
              <Button
                size="sm"
                loading={saving}
                onClick={() => handleSave(section.keys)}
                disabled={!section.keys.some((k) => draft[k])}
              >
                Save
              </Button>
            </div>
          </div>
        );
      })}

      {/* ─── LLM Providers Section ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">LLM Providers</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Configure API keys and endpoints for language model providers. Expand a provider to set its credentials.
            </p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-2">
          {PROVIDER_CONFIGS.map((provider) => {
            const isExpanded = expandedProviders[provider.id] ?? false;
            const isConfigured = provider.fields.every((f) => {
              const s = getSettingByKey(f.key);
              return !!s?.value;
            });
            const hasAnyConfigured = provider.fields.some((f) => {
              const s = getSettingByKey(f.key);
              return !!s?.value;
            });

            return (
              <div
                key={provider.id}
                className={`rounded-lg border transition-colors ${
                  isExpanded
                    ? "border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-900/10"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleProvider(provider.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {provider.name}
                    </span>
                    {isConfigured && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Configured
                      </span>
                    )}
                    {hasAnyConfigured && !isConfigured && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        Partial
                      </span>
                    )}
                  </div>
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                    {provider.fields.map((field) => renderField(field.key))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-400">
            {isLlmSaved ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Saved</span>
            ) : (
              allLlmKeys.some((k) => draft[k]) ? "Unsaved changes" : ""
            )}
          </div>
          <Button
            size="sm"
            loading={saving}
            onClick={() => handleSave(allLlmKeys)}
            disabled={!allLlmKeys.some((k) => draft[k])}
          >
            Save
          </Button>
        </div>
      </div>

      {/* ─── Tool Credentials Section ───────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Tool Credentials</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              API keys for tools used by agents. Most built-in tools require no credentials.
            </p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {TOOL_CONFIGS.map((tool) => (
            <div
              key={tool.tool}
              className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-700 dark:text-slate-300">{tool.name}</span>
              </div>
              {tool.keys.length === 0 ? (
                <span className="text-xs text-slate-400 dark:text-slate-500">{tool.note}</span>
              ) : (
                <div className="flex items-center gap-2">
                  {tool.keys.every((k) => isSet(k)) ? (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ Configured</span>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400">Needs API key</span>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Expandable credential fields for tools that need them */}
          {TOOL_CONFIGS.filter((t) => t.keys.length > 0).map((tool) => (
            <div key={`${tool.tool}-fields`} className="space-y-3 pt-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {tool.name}
              </p>
              {tool.keys.map((key) => renderField(key))}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-400">
            {isToolsSaved ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Saved</span>
            ) : (
              allToolKeys.some((k) => draft[k]) ? "Unsaved changes" : ""
            )}
          </div>
          <Button
            size="sm"
            loading={saving}
            onClick={() => handleSave(allToolKeys)}
            disabled={!allToolKeys.some((k) => draft[k])}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
