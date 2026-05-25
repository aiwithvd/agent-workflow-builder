import { create } from "zustand";

export interface Agent {
  id: string;
  name: string;
  role: string;
  system_prompt?: string;
  provider: string;
  model: string;
  tools?: string[];
  channels?: string[];
  memory_enabled?: boolean;
  guardrails?: { max_tokens?: number | null; rate_limit?: number | null } | null;
  schedule?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface AgentStore {
  agents: Agent[];
  selected: Agent | null;
  setAgents: (agents: Agent[]) => void;
  setSelected: (agent: Agent | null) => void;
  upsert: (agent: Agent) => void;
  remove: (id: string) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  selected: null,
  setAgents: (agents) => set({ agents }),
  setSelected: (selected) => set({ selected }),
  upsert: (agent) =>
    set((state) => {
      const idx = state.agents.findIndex((a) => a.id === agent.id);
      if (idx >= 0) {
        const updated = [...state.agents];
        updated[idx] = agent;
        return { agents: updated };
      }
      return { agents: [...state.agents, agent] };
    }),
  remove: (id) =>
    set((state) => ({ agents: state.agents.filter((a) => a.id !== id) })),
}));
