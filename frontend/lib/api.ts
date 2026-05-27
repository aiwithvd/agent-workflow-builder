/**
 * API client utilities for backend communication.
 *
 * All HTTP traffic goes through the Next.js proxy at /api/backend so that
 * the backend URL and shared secret never reach the browser.
 * WebSocket connections are still direct (browsers can't proxy WS through
 * serverless functions), but they use a short-lived token obtained via the
 * proxy before connecting.
 */

const API_URL = "/api/backend";

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

    // Handle 204 No Content (no response body)
    let data;
    if (response.status === 204) {
      data = null;
    } else {
      data = await response.json();
    }

    if (!response.ok) {
      // Extract error message, handling both string and array formats
      let errorMsg = "API error";
      if (typeof data?.detail === "string") {
        errorMsg = data.detail;
      } else if (Array.isArray(data?.detail)) {
        // Pydantic validation errors come as arrays
        errorMsg = data.detail
          .map((err: any) => `${err.loc?.join(".") || "field"}: ${err.msg}`)
          .join("; ");
      } else if (data?.detail) {
        errorMsg = JSON.stringify(data.detail);
      }
      return {
        error: errorMsg,
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
  presets: () => apiCall<any[]>("/agents/presets"),
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
  messages: (id: string) => apiCall(`/executions/${id}/messages`),
  traces: (id: string) => apiCall(`/executions/${id}/traces`),
  metrics: (id: string) => apiCall(`/executions/${id}/metrics`),
};

// Settings API
export const settingsAPI = {
  list: () => apiCall<any[]>("/settings"),
  update: (settings: Array<{ key: string; value: string }>) =>
    apiCall<any[]>("/settings", {
      method: "PATCH",
      body: JSON.stringify({ settings }),
    }),
  getRaw: (key: string) => apiCall<{ key: string; value: string | null }>(`/settings/${key}/raw`),
};

// ─── WebSocket helpers ────────────────────────────────────────────────────────

/**
 * Fetch a short-lived (30 s) single-use WS token from the backend via the
 * Next.js proxy.  Returns an empty string when the backend has no secret
 * configured (local development), so callers can always await this safely.
 */
async function getWsToken(): Promise<string> {
  try {
    const res = await fetch("/api/backend/executions/ws-token", {
      method: "POST",
    });
    if (!res.ok) return "";
    const data = await res.json();
    return (data as { token?: string }).token ?? "";
  } catch {
    return "";
  }
}

/**
 * Open a monitored WebSocket for an execution.  Fetches a short-lived auth
 * token first so the backend can validate the connection.
 */
export async function createMonitorWebSocket(
  executionId: string
): Promise<WebSocket> {
  const token = await getWsToken();
  const wsBase =
    process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/api/v1";
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
  return new WebSocket(
    `${wsBase}/executions/ws/monitor/${executionId}${tokenParam}`
  );
}
