"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { StatusIndicator } from "@/components/monitor/StatusIndicator";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, statusToBadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { executionsAPI, createMonitorWebSocket } from "@/lib/api";
import Link from "next/link";

type Tab = "live" | "traces" | "messages";

const TERMINAL_STATUSES = new Set(["completed", "failed"]);

// ─── Sub-components ────────────────────────────────────────────────────────────

function MetricsBar({ metrics }: { metrics: any }) {
  if (!metrics) return null;
  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        { label: "Total Tokens", value: metrics.total_tokens?.toLocaleString() ?? "—" },
        { label: "Prompt Tokens", value: metrics.prompt_tokens?.toLocaleString() ?? "—" },
        { label: "Completion Tokens", value: metrics.completion_tokens?.toLocaleString() ?? "—" },
        {
          label: "Est. Cost",
          value: metrics.total_cost_usd != null ? `$${metrics.total_cost_usd.toFixed(5)}` : "—",
        },
      ].map(({ label, value }) => (
        <Card key={label}>
          <CardBody className="text-center py-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm font-mono">
              {value}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

const EVENT_STYLES: Record<string, string> = {
  execution_started: "border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/10",
  graph_built: "border-slate-200 dark:border-slate-700",
  step_start: "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10",
  step_complete: "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10",
  execution_complete: "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20",
  execution_failed: "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10",
  error: "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10",
  heartbeat: "border-slate-100 dark:border-slate-800 opacity-50",
};

function LiveLogPanel({ events }: { events: any[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-500 text-sm">
        Waiting for execution events…
      </div>
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto max-h-[55vh] pr-1">
      {events.map((ev, i) => {
        if (ev.type === "heartbeat") return null;
        const style = EVENT_STYLES[ev.type] ?? "border-slate-200 dark:border-slate-700";
        return (
          <div key={i} className={`rounded-lg border px-4 py-3 ${style}`}>
            <div className="flex items-center gap-2 text-xs mb-1">
              <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">
                {ev.type}
              </span>
              {ev.agent_name && (
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                  {ev.agent_name}
                </span>
              )}
              <span className="ml-auto text-slate-400 dark:text-slate-500">
                {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : ""}
              </span>
            </div>
            {ev.message && (
              <p className="text-sm text-slate-700 dark:text-slate-300">{ev.message}</p>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

function TracesPanel({ traces, langfuseAuthError }: { traces: any[]; langfuseAuthError?: boolean }) {
  if (langfuseAuthError) {
    return (
      <div className="flex flex-col items-center justify-center h-52 gap-3 text-center px-4">
        <div className="text-2xl">🔑</div>
        <div className="font-medium text-slate-700 dark:text-slate-300 text-sm">Langfuse credentials not configured</div>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
          To see LLM traces, token counts, and costs here, you need to set up Langfuse API keys.
        </p>
        <ol className="text-xs text-slate-500 dark:text-slate-400 text-left space-y-1 max-w-sm">
          <li>1. Open <a href="http://localhost:3000" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">localhost:3000</a> and create a Langfuse account</li>
          <li>2. Create a project → Settings → API Keys → copy Public + Secret keys</li>
          <li>3. Go to <a href="/settings" className="text-indigo-500 hover:underline">Settings</a> and paste both keys in the Langfuse section</li>
        </ol>
      </div>
    );
  }

  if (traces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400 dark:text-slate-500 text-sm">
        <span>No traces yet.</span>
        <span className="text-xs">Traces appear after execution completes and Langfuse ingests them.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 overflow-y-auto max-h-[55vh]">
      {traces.map((trace: any) => (
        <div
          key={trace.id}
          className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 space-y-1"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
              {trace.name ?? trace.id?.slice(0, 12)}
            </span>
            <span className="text-slate-400 dark:text-slate-500">
              {trace.timestamp ? new Date(trace.timestamp).toLocaleTimeString() : ""}
            </span>
          </div>
          <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400">
            {trace.usage?.input != null && (
              <span>Prompt: {trace.usage.input} tokens</span>
            )}
            {trace.usage?.output != null && (
              <span>Completion: {trace.usage.output} tokens</span>
            )}
            {trace.totalCost != null && (
              <span>Cost: ${trace.totalCost.toFixed(6)}</span>
            )}
            {trace.latency != null && (
              <span>Latency: {trace.latency}ms</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MessagesPanel({ messages }: { messages: any[] }) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-500 text-sm">
        No messages persisted for this execution.
      </div>
    );
  }

  const typeColors: Record<string, string> = {
    user_input: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
    agent_response: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800",
    tool_call: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    tool_result: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
    system: "bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-700",
  };

  return (
    <div className="space-y-3 overflow-y-auto max-h-[55vh]">
      {messages.map((msg: any) => {
        const style = typeColors[msg.message_type] ?? typeColors.system;
        return (
          <div key={msg.id} className={`rounded-lg border px-4 py-3 ${style}`}>
            <div className="flex items-center gap-2 text-xs mb-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {msg.from_agent ?? "system"}
              </span>
              {msg.to_agent && (
                <span className="text-slate-400">→ {msg.to_agent}</span>
              )}
              <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px] capitalize">
                {msg.message_type?.replace("_", " ")}
              </span>
              <span className="ml-auto text-slate-400 dark:text-slate-500">
                {msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : ""}
              </span>
              {msg.tokens_used != null && (
                <span className="text-slate-400 dark:text-slate-500">
                  {msg.tokens_used} tokens
                </span>
              )}
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
              {msg.content}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Output extractor ──────────────────────────────────────────────────────────

function extractFinalOutput(output: any): { text: string | null; isJson: boolean } {
  if (!output) return { text: null, isJson: false };

  // Try to find the last AI message in the messages array
  const messages = output.messages ?? output.data?.messages ?? [];
  if (Array.isArray(messages) && messages.length > 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgType = msg?.type || msg?.role || "";
      const content = msg?.content ?? (typeof msg === "string" ? msg : null);
      if ((msgType === "ai" || msgType === "assistant") && content) {
        return {
          text: typeof content === "string" ? content : JSON.stringify(content, null, 2),
          isJson: false,
        };
      }
    }
  }

  // Fallback: direct "result" or "content" field
  if (typeof output.result === "string") return { text: output.result, isJson: false };
  if (typeof output.content === "string") return { text: output.content, isJson: false };

  // Last resort: formatted JSON
  return { text: JSON.stringify(output, null, 2), isJson: true };
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ExecutionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [execution, setExecution] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("live");
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [wsStatus, setWsStatus] = useState<string>("closed");
  const [traces, setTraces] = useState<any[]>([]);
  const [langfuseAuthError, setLangfuseAuthError] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load execution on mount
  useEffect(() => {
    executionsAPI.get(id).then((res) => {
      if (res.data) setExecution(res.data);
      setLoading(false);
    });
  }, [id]);

  // WebSocket for live events + polling fallback
  useEffect(() => {
    if (!execution) return;
    if (TERMINAL_STATUSES.has(execution.status)) {
      // Already done — fetch historical data instead
      loadHistoricalData();
      return;
    }

    const ws = createMonitorWebSocket(id);
    wsRef.current = ws;
    setWsStatus("connecting");

    ws.onopen = () => {
      setWsStatus("open");
      // Clear polling fallback once WS is established
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        setLiveEvents((prev) => [...prev, event]);

        // Update execution status from terminal events
        if (event.type === "execution_complete") {
          setExecution((ex: any) => ({ ...ex, status: "completed" }));
          setTimeout(loadHistoricalData, 2000); // give Langfuse time to ingest
        } else if (event.type === "execution_failed") {
          setExecution((ex: any) => ({ ...ex, status: "failed" }));
        }
      } catch {
        setLiveEvents((prev) => [...prev, { type: "raw", message: e.data }]);
      }
    };
    ws.onerror = () => setWsStatus("error");
    ws.onclose = () => {
      setWsStatus("closed");
      // Start polling fallback when WS closes unexpectedly (e.g. server restart)
      if (pollRef.current) return;
      pollRef.current = setInterval(async () => {
        const res = await executionsAPI.get(id);
        if (res.data) {
          const updated = res.data as any;
          setExecution(updated);
          if (TERMINAL_STATUSES.has(updated.status)) {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            loadHistoricalData();
          }
        }
      }, 3000);
    };

    return () => {
      ws.close();
      wsRef.current = null;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [execution?.id, execution?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadHistoricalData() {
    const [tracesRes, messagesRes, metricsRes] = await Promise.all([
      executionsAPI.traces(id),
      executionsAPI.messages(id),
      executionsAPI.metrics(id),
    ]);
    if (tracesRes.data) {
      const tracesPayload = tracesRes.data as any;
      setTraces(tracesPayload.data ?? []);
      setLangfuseAuthError(tracesPayload.langfuse_auth_error === true);
    }
    if (messagesRes.data) setMessages(messagesRes.data as any[]);
    if (metricsRes.data) setMetrics(metricsRes.data);
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!execution) {
    return (
      <div className="max-w-3xl">
        <p className="text-slate-500 dark:text-slate-400">Execution not found.</p>
        <Link href="/executions">
          <Button variant="ghost" className="mt-4">Back to executions</Button>
        </Link>
      </div>
    );
  }

  const isLive = !TERMINAL_STATUSES.has(execution.status);
  const start = execution.started_at ? new Date(execution.started_at) : null;
  const end = execution.completed_at ? new Date(execution.completed_at) : null;
  const durationSec = start && end ? Math.round((end.getTime() - start.getTime()) / 1000) : null;

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "live", label: "Live Log", count: liveEvents.filter(e => e.type !== "heartbeat").length },
    { id: "traces", label: "Traces", count: traces.length },
    { id: "messages", label: "Messages", count: messages.length },
  ];

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/executions"
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-2 inline-block"
          >
            ← Back to executions
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
              {execution.id.slice(0, 12)}…
            </h1>
            <Badge variant={statusToBadgeVariant(execution.status)} pulse={isLive}>
              {execution.status}
            </Badge>
            {isLive && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                WS: {wsStatus}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {execution.workflow_name ?? execution.workflow_id?.slice(0, 16)}
            {durationSec != null && ` · ${durationSec}s`}
            {start && ` · started ${start.toLocaleString()}`}
          </p>
        </div>

        {!isLive && (
          <Button variant="ghost" size="sm" onClick={loadHistoricalData}>
            Refresh
          </Button>
        )}
      </div>

      {/* Metrics bar — shown after completion */}
      <MetricsBar metrics={metrics} />

      {/* Final Result — shown prominently above tabs once execution completes */}
      {execution.output && (() => {
        const { text, isJson } = extractFinalOutput(execution.output);
        if (!text) return null;
        return (
          <Card className="border-emerald-200 dark:border-emerald-800">
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Final Result</h2>
              </div>
              {isJson && (
                <span className="text-xs text-slate-400">raw output</span>
              )}
            </CardHeader>
            <CardBody>
              {isJson ? (
                <pre className="text-xs text-slate-700 dark:text-slate-300 overflow-x-auto bg-slate-50 dark:bg-slate-900 rounded-lg p-4 max-h-64 whitespace-pre-wrap">
                  {text}
                </pre>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {text}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        );
      })()}

      {/* Tab panel */}
      <Card>
        <CardHeader className="flex items-center gap-0 border-b border-slate-100 dark:border-slate-800 pb-0">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                {t.label}
                {t.count != null && t.count > 0 && (
                  <span className="ml-1.5 text-xs bg-slate-100 dark:bg-slate-800 rounded-full px-1.5 py-0.5">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          {tab === "live" && isLive && (
            <Badge variant="running" pulse className="ml-auto mr-1">
              Live
            </Badge>
          )}
        </CardHeader>
        <CardBody>
          {tab === "live" && <LiveLogPanel events={liveEvents} />}
          {tab === "traces" && <TracesPanel traces={traces} langfuseAuthError={langfuseAuthError} />}
          {tab === "messages" && <MessagesPanel messages={messages} />}
        </CardBody>
      </Card>

      {execution.error && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <h2 className="font-semibold text-red-600 dark:text-red-400 text-sm">Error</h2>
          </CardHeader>
          <CardBody>
            <pre className="text-xs text-red-700 dark:text-red-300 overflow-x-auto">
              {execution.error}
            </pre>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
