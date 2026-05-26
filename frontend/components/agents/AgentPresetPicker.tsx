"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { agentsAPI } from "@/lib/api";

interface AgentPreset {
  preset_id: string;
  name: string;
  description: string;
  icon: string;
  role: string;
  provider: string;
  model: string;
  tools: string[];
  channels: string[];
  memory_enabled: boolean;
  guardrails: { max_tokens: number | null; rate_limit: number | null } | null;
  schedule: string | null;
  system_prompt: string;
}

// Which preset IDs belong to which workflow template group
const TEMPLATE_GROUPS: Record<string, { label: string; template: string; ids: string[] }> = {
  research: {
    label: "Research Report Pipeline",
    template: "research_report",
    ids: ["researcher", "writer"],
  },
  support: {
    label: "Customer Support Triage",
    template: "customer_support",
    ids: ["classifier", "technical_support", "billing_support", "general_support"],
  },
};

const STANDALONE_IDS = ["support_specialist", "data_analyst"];

export function AgentPresetPicker() {
  const router = useRouter();
  const [presets, setPresets] = useState<AgentPreset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    agentsAPI.presets().then((res) => {
      if (res.data) setPresets(res.data);
      setLoading(false);
    });
  }, []);

  function usePreset(preset: AgentPreset) {
    const encoded = encodeURIComponent(btoa(JSON.stringify(preset)));
    router.push(`/agents/new?preset=${encoded}`);
  }

  if (loading || presets.length === 0) return null;

  const byId = Object.fromEntries(presets.map((p) => [p.preset_id, p]));

  function PresetCard({ preset }: { preset: AgentPreset }) {
    return (
      <button
        onClick={() => usePreset(preset)}
        className="text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 transition-all group"
      >
        <div className="text-2xl mb-2">{preset.icon}</div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">
          {preset.name}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
          {preset.description}
        </p>
        {preset.tools.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {preset.tools.slice(0, 3).map((t) => (
              <span
                key={t}
                className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              >
                {t}
              </span>
            ))}
            {preset.tools.length > 3 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                +{preset.tools.length - 3}
              </span>
            )}
          </div>
        )}
      </button>
    );
  }

  const standalonePresets = STANDALONE_IDS.map((id) => byId[id]).filter(Boolean);
  // Any preset not in a known group or standalone goes here too
  const knownIds = new Set([
    ...Object.values(TEMPLATE_GROUPS).flatMap((g) => g.ids),
    ...STANDALONE_IDS,
  ]);
  const extraPresets = presets.filter((p) => !knownIds.has(p.preset_id));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
          Start from a preset
        </h2>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          — pre-configured agents ready to drop into templates
        </span>
      </div>

      {/* Template-aligned groups */}
      {Object.entries(TEMPLATE_GROUPS).map(([key, group]) => {
        const groupPresets = group.ids.map((id) => byId[id]).filter(Boolean);
        if (groupPresets.length === 0) return null;
        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                For:
              </span>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                {group.label}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {groupPresets.map((preset) => (
                <PresetCard key={preset.preset_id} preset={preset} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Standalone presets */}
      {(standalonePresets.length > 0 || extraPresets.length > 0) && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            General purpose
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...standalonePresets, ...extraPresets].map((preset) => (
              <PresetCard key={preset.preset_id} preset={preset} />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        <span className="text-xs text-slate-400 dark:text-slate-500">or create a custom agent</span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}
