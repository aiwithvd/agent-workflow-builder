/**
 * API client utilities for backend communication
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        error: data.detail || "API error",
        status: response.status,
      };
    }

    return {
      data,
      status: response.status,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Network error",
      status: 0,
    };
  }
}

// Agents API
export const agentsAPI = {
  list: () => apiCall("/agents"),
  get: (id: string) => apiCall(`/agents/${id}`),
  create: (data: any) =>
    apiCall("/agents", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/agents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiCall(`/agents/${id}`, { method: "DELETE" }),
};

// Workflows API
export const workflowsAPI = {
  list: () => apiCall("/workflows"),
  get: (id: string) => apiCall(`/workflows/${id}`),
  templates: () => apiCall("/workflows/templates"),
  create: (data: any) =>
    apiCall("/workflows", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/workflows/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiCall(`/workflows/${id}`, { method: "DELETE" }),
};

// Executions API
export const executionsAPI = {
  list: (workflowId?: string) => {
    const params = workflowId ? `?workflow_id=${workflowId}` : "";
    return apiCall(`/executions${params}`);
  },
  get: (id: string) => apiCall(`/executions/${id}`),
  create: (data: any) =>
    apiCall("/executions", { method: "POST", body: JSON.stringify(data) }),
};

// WebSocket for monitoring
export function createMonitorWebSocket(executionId: string): WebSocket {
  const wsUrl =
    (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/api/v1") +
    `/executions/ws/monitor/${executionId}`;
  return new WebSocket(wsUrl);
}
