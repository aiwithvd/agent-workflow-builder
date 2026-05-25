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
    description: "Bot token for receiving messages and sending workflow results via Telegram.",
    keys: ["telegram_bot_token"],
  },
  {
    id: "llm",
    title: "LLM Providers",
    icon: (
      <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    description: "API keys and endpoints for language model providers.",
    keys: ["openrouter_api_key", "ollama_url"],
  },
  {
    id: "tools",
    title: "Tool Credentials",
    icon: (
      <svg className="w-4 h-4 text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    description: "API keys for tools used by agents (weather, etc.).",
    keys: ["openweather_api_key"],
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
    keys: ["langfuse_public_key", "langfuse_secret_key", "langfuse_host"],
  },
];

// ─── Key labels ───────────────────────────────────────────────────────────────

const KEY_LABELS: Record<string, string> = {
  telegram_bot_token: "Bot Token",
  openrouter_api_key: "API Key",
  ollama_url: "Ollama URL",
  openweather_api_key: "API Key",
  langfuse_public_key: "Public Key",
  langfuse_secret_key: "Secret Key",
  langfuse_host: "Host URL",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // draft values: key → current input value
  const [draft, setDraft] = useState<Record<string, string>>({});
  // which secrets are currently revealed
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

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
      // Initialize draft with empty strings (don't pre-fill secrets)
      const initial: Record<string, string> = {};
      for (const s of list) {
        // For non-secrets, pre-fill with current value; for secrets leave blank
        initial[s.key] = s.is_secret ? "" : (s.value ?? "");
      }
      setDraft(initial);
    }
    setLoading(false);
  }

  async function handleSave(sectionKeys: string[]) {
    setSaving(true);
    setError(null);
    // Only send keys that have a non-empty draft value (to avoid clearing secrets that weren't changed)
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
      // Clear draft for secrets after save (re-mask them)
      const cleared = { ...draft };
      for (const k of sectionKeys) {
        const setting = updated.find((s) => s.key === k);
        if (setting?.is_secret) cleared[k] = "";
      }
      setDraft(cleared);
      setSaved(sectionKeys.join(","));
      setTimeout(() => setSaved(null), 3000);
    }
  }

  function getSettingByKey(key: string): Setting | undefined {
    return settings.find((s) => s.key === key);
  }

  function isSet(key: string): boolean {
    const s = getSettingByKey(key);
    return !!s?.value;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

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

      {/* Sections */}
      {SECTIONS.map((section) => {
        const isSectionSaved = saved?.includes(section.keys[0]);
        return (
          <div
            key={section.id}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
          >
            {/* Section header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                {section.icon}
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{section.title}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{section.description}</p>
              </div>
            </div>

            {/* Fields */}
            <div className="px-5 py-4 space-y-4">
              {section.keys.map((key) => {
                const setting = getSettingByKey(key);
                const isSecret = setting?.is_secret ?? false;
                const hasValue = isSet(key);
                const isRevealed = revealed[key] ?? false;

                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {KEY_LABELS[key] ?? key}
                        {isSecret && (
                          <span className="ml-1.5 text-xs text-slate-400 font-normal">secret</span>
                        )}
                      </label>
                      {hasValue && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          ✓ Set
                        </span>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type={isSecret && !isRevealed ? "password" : "text"}
                        value={draft[key] ?? ""}
                        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                        placeholder={
                          hasValue
                            ? isSecret
                              ? "Enter new value to change…"
                              : setting?.value ?? ""
                            : `Enter ${KEY_LABELS[key] ?? key}…`
                        }
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

                    {setting?.description && (
                      <p className="text-xs text-slate-400 dark:text-slate-500">{setting.description}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Section footer */}
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
    </div>
  );
}
