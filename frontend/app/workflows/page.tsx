"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { workflowsAPI } from "@/lib/api";

interface Workflow {
  id: string;
  name: string;
  description?: string;
  template_name?: string;
  created_at: string;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [workflowsRes, templatesRes] = await Promise.all([
          workflowsAPI.list(),
          workflowsAPI.templates(),
        ]);

        if (workflowsRes.data) {
          setWorkflows(workflowsRes.data);
        }

        if (templatesRes.data && templatesRes.data.templates) {
          setTemplates(templatesRes.data.templates);
        }
      } catch (err) {
        setError("Failed to load workflows");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Workflows</h1>
          <p className="text-gray-600">Create multi-agent workflows</p>
        </div>
        <Link
          href="/workflows/new"
          className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-purple-600"
        >
          + New Workflow
        </Link>
      </div>

      {/* Templates Section */}
      {!loading && templates.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Templates</h2>
          <div className="grid grid-cols-2 gap-4">
            {templates.map((template) => (
              <Link
                key={template.name}
                href={`/workflows/new?template=${template.name}`}
                className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200 p-6 hover:shadow-lg transition"
              >
                <h3 className="text-lg font-semibold text-purple-900">
                  {template.name}
                </h3>
                <p className="text-purple-700 text-sm">
                  {template.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Workflows List */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Your Workflows</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">Loading workflows...</div>
        ) : workflows.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-600 mb-4">No workflows yet</p>
            <Link
              href="/workflows/new"
              className="text-secondary hover:underline font-medium"
            >
              Create your first workflow →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {workflows.map((workflow) => (
              <Link
                key={workflow.id}
                href={`/workflows/${workflow.id}`}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:border-purple-300 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{workflow.name}</h3>
                    {workflow.description && (
                      <p className="text-gray-600 text-sm mt-1">
                        {workflow.description}
                      </p>
                    )}
                    {workflow.template_name && (
                      <span className="inline-block mt-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                        Template: {workflow.template_name}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      {new Date(workflow.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
