"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { agentsAPI, workflowsAPI, executionsAPI } from "@/lib/api";

interface DashboardStats {
  agents: number;
  workflows: number;
  executions: number;
}

export default function Home() {
  const [stats, setStats] = useState<DashboardStats>({
    agents: 0,
    workflows: 0,
    executions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [agentsRes, workflowsRes, executionsRes] = await Promise.all([
          agentsAPI.list(),
          workflowsAPI.list(),
          executionsAPI.list(),
        ]);

        setStats({
          agents: Array.isArray(agentsRes.data) ? agentsRes.data.length : 0,
          workflows: Array.isArray(workflowsRes.data)
            ? workflowsRes.data.length
            : 0,
          executions: Array.isArray(executionsRes.data)
            ? executionsRes.data.length
            : 0,
        });
      } catch (error) {
        console.error("Failed to load stats:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-2">Welcome to Yuno AI</h1>
        <p className="text-gray-600 text-lg">
          Build and orchestrate multi-agent workflows
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-6 mb-12">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-4xl font-bold text-primary mb-2">
            {loading ? "-" : stats.agents}
          </div>
          <div className="text-gray-600">Active Agents</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-4xl font-bold text-secondary mb-2">
            {loading ? "-" : stats.workflows}
          </div>
          <div className="text-gray-600">Workflows</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-4xl font-bold text-green-600 mb-2">
            {loading ? "-" : stats.executions}
          </div>
          <div className="text-gray-600">Executions</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <h2 className="text-2xl font-bold mb-6">Quick Start</h2>

        <div className="grid grid-cols-2 gap-6">
          <Link
            href="/agents"
            className="flex flex-col gap-2 p-4 border border-gray-300 rounded-lg hover:bg-blue-50 transition"
          >
            <div className="text-xl font-semibold">👥 Manage Agents</div>
            <p className="text-gray-600">Create and configure AI agents</p>
          </Link>

          <Link
            href="/workflows"
            className="flex flex-col gap-2 p-4 border border-gray-300 rounded-lg hover:bg-purple-50 transition"
          >
            <div className="text-xl font-semibold">🔄 Build Workflows</div>
            <p className="text-gray-600">Design multi-agent workflows</p>
          </Link>

          <Link
            href="/executions"
            className="flex flex-col gap-2 p-4 border border-gray-300 rounded-lg hover:bg-green-50 transition"
          >
            <div className="text-xl font-semibold">📊 Monitor Executions</div>
            <p className="text-gray-600">Watch workflows in real-time</p>
          </Link>

          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-2 p-4 border border-gray-300 rounded-lg hover:bg-yellow-50 transition"
          >
            <div className="text-xl font-semibold">📚 API Docs</div>
            <p className="text-gray-600">View backend API documentation</p>
          </a>
        </div>
      </div>
    </div>
  );
}
