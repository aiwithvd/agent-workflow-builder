"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { agentsAPI } from "@/lib/api";

interface Agent {
  id: string;
  name: string;
  role?: string;
  provider: string;
  model?: string;
  tools: string[];
  channels: string[];
  created_at: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAgents() {
      try {
        const res = await agentsAPI.list();
        if (res.data) {
          setAgents(res.data);
        } else {
          setError(res.error || "Failed to load agents");
        }
      } catch (err) {
        setError("Error loading agents");
      } finally {
        setLoading(false);
      }
    }

    loadAgents();
  }, []);

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Agents</h1>
          <p className="text-gray-600">Create and manage AI agents</p>
        </div>
        <Link
          href="/agents/new"
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600"
        >
          + New Agent
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">Loading agents...</div>
      ) : agents.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-600 mb-4">No agents yet</p>
          <Link
            href="/agents/new"
            className="text-primary hover:underline font-medium"
          >
            Create your first agent →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{agent.name}</h3>
                  {agent.role && (
                    <p className="text-gray-600">{agent.role}</p>
                  )}
                  <div className="flex gap-4 mt-3 text-sm text-gray-500">
                    <span>{agent.provider}/{agent.model}</span>
                    <span>Tools: {agent.tools.length}</span>
                    <span>Channels: {agent.channels.length}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">
                    {new Date(agent.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
