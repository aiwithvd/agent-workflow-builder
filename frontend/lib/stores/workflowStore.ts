import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes?: Node[];
  edges?: Edge[];
  created_at?: string;
}

interface WorkflowStore {
  workflows: Workflow[];
  nodes: Node[];
  edges: Edge[];
  setWorkflows: (workflows: Workflow[]) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  upsert: (workflow: Workflow) => void;
  remove: (id: string) => void;
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  workflows: [],
  nodes: [],
  edges: [],
  setWorkflows: (workflows) => set({ workflows }),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  upsert: (workflow) =>
    set((state) => {
      const idx = state.workflows.findIndex((w) => w.id === workflow.id);
      if (idx >= 0) {
        const updated = [...state.workflows];
        updated[idx] = workflow;
        return { workflows: updated };
      }
      return { workflows: [...state.workflows, workflow] };
    }),
  remove: (id) =>
    set((state) => ({ workflows: state.workflows.filter((w) => w.id !== id) })),
}));
