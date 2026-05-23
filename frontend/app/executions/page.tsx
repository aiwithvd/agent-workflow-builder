"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { executionsAPI } from "@/lib/api";

interface Execution {
  id: string;
  workflow_id: string;
  status: string;
  total_tokens: number;
  started_at: string;
  completed_at?: string;
}

export default function ExecutionsPage() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadExecutions() {
      try {
        const res = await executionsAPI.list();
        if (res.data) {
          setExecutions(res.data);
        } else {
          setError(res.error || "Failed to load executions");
        }
      } catch (err) {
        setError("Error loading executions");
      } finally {
        setLoading(false);
      }
    }

    loadExecutions();
    // Refresh every 5 seconds
    const interval = setInterval(loadExecutions, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "running":
        return "bg-blue-100 text-blue-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Executions</h1>
        <p className="text-gray-600">Monitor workflow executions in real-time</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">Loading executions...</div>
      ) : executions.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-600">No executions yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Execution ID
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Tokens
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {executions.map((exec) => (
                <tr key={exec.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-mono">
                    {exec.id.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        exec.status
                      )}`}
                    >
                      {exec.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm">{exec.total_tokens}</td>
                  <td className="px-6 py-3 text-sm">
                    {new Date(exec.started_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-3">
                    <Link
                      href={`/executions/${exec.id}`}
                      className="text-primary hover:underline text-sm font-medium"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
