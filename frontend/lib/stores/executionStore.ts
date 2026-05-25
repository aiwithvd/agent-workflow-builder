import { create } from "zustand";

export interface ExecutionMessage {
  id: string;
  agent_name?: string;
  role: string;
  content: string;
  timestamp: string;
  token_count?: number;
}

export interface Execution {
  id: string;
  workflow_id: string;
  workflow_name?: string;
  status: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  created_at?: string;
  updated_at?: string;
  messages?: ExecutionMessage[];
}

interface ExecutionStore {
  executions: Execution[];
  activeExecution: Execution | null;
  messages: ExecutionMessage[];
  setExecutions: (executions: Execution[]) => void;
  setActiveExecution: (execution: Execution | null) => void;
  appendMessage: (message: ExecutionMessage) => void;
  clearMessages: () => void;
  updateExecutionStatus: (id: string, status: string) => void;
}

export const useExecutionStore = create<ExecutionStore>((set) => ({
  executions: [],
  activeExecution: null,
  messages: [],
  setExecutions: (executions) => set({ executions }),
  setActiveExecution: (execution) =>
    set({ activeExecution: execution, messages: execution?.messages ?? [] }),
  appendMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),
  updateExecutionStatus: (id, status) =>
    set((state) => ({
      executions: state.executions.map((e) =>
        e.id === id ? { ...e, status } : e
      ),
      activeExecution:
        state.activeExecution?.id === id
          ? { ...state.activeExecution, status }
          : state.activeExecution,
    })),
}));
