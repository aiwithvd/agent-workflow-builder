/**
 * LangGraph Server client wrapper.
 *
 * LangGraph Server runs on port 8123 (via `langgraph dev` inside Docker).
 * This file provides a typed Client instance and a React hook for streaming
 * workflow execution events directly from LangGraph Server via SSE.
 *
 * Usage pattern:
 *   - POST /api/v1/executions  → FastAPI creates Execution row, returns {id, workflow_id}
 *   - useLangGraphStream(executionId, workflowId) → opens SSE stream on LangGraph Server
 *   - Events drive the Live Log panel + canvas node overlay
 */

import { Client } from "@langchain/langgraph-sdk";
import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

const LANGGRAPH_URL =
  process.env.NEXT_PUBLIC_LANGGRAPH_URL ?? "http://localhost:8123";

/** Pre-configured LangGraph Server client (no auth in dev mode). */
export const langGraphClient = new Client({ apiUrl: LANGGRAPH_URL });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StreamEvent = {
  type: string;
  node_id?: string;
  agent_name?: string;
  message?: string;
  timestamp?: string;
  [key: string]: unknown;
};

export type StreamStatus = "idle" | "connecting" | "streaming" | "done" | "error";

// ---------------------------------------------------------------------------
// React hook — useExecutionStream
// ---------------------------------------------------------------------------

/**
 * Opens a LangGraph Server SSE stream for a workflow run.
 *
 * @param executionId   UUID of the FastAPI Execution row — also used as thread_id.
 * @param workflowId    UUID of the Workflow — passed in configurable so the
 *                      dispatcher.make_graph factory can look it up from the DB.
 * @param userMessage   The initial user message to send into the graph.
 *
 * Events are normalised to the same shape used by the WebSocket event bus so
 * the rest of the UI (LiveLogPanel, canvas overlay) works unchanged.
 *
 * Returns { events, status, finalText }.
 */
export function useExecutionStream(
  executionId: string | null,
  workflowId: string | null,
  userMessage: string | null,
) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [finalText, setFinalText] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async () => {
    if (!executionId || !workflowId || !userMessage) return;

    setEvents([]);
    setFinalText(null);
    setStatus("connecting");

    abortRef.current = new AbortController();

    try {
      // Ensure a thread exists for this execution (idempotent)
      await langGraphClient.threads.create({ threadId: executionId });

      setStatus("streaming");

      const stream = langGraphClient.runs.stream(
        executionId,
        "dynamic_workflow",
        {
          input: {
            messages: [{ type: "human", content: userMessage }],
            execution_id: executionId,
          },
          config: {
            configurable: {
              workflow_id: workflowId,
              thread_id: executionId,
            },
          },
          streamMode: "events",
        },
      );

      for await (const chunk of stream) {
        if (abortRef.current?.signal.aborted) break;

        const event = chunk as any;
        const kind: string = event?.event ?? event?.type ?? "";
        const name: string = event?.name ?? "";

        // Normalise LangGraph events → our StreamEvent shape
        let normalised: StreamEvent | null = null;

        if (kind === "on_chain_start" && name && name !== "LangGraph") {
          normalised = {
            type: "step_start",
            node_id: name,
            agent_name: name,
            message: `▶ ${name} started`,
            timestamp: new Date().toISOString(),
          };
        } else if (kind === "on_chain_end" && name && name !== "LangGraph") {
          normalised = {
            type: "step_complete",
            node_id: name,
            agent_name: name,
            message: `✓ ${name} finished`,
            timestamp: new Date().toISOString(),
          };
        } else if (kind === "on_chain_end" && name === "LangGraph") {
          // Final state — extract last AI message
          const output = event?.data?.output ?? {};
          const messages: any[] = output?.messages ?? [];
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const msgType = msg?.type ?? msg?.role ?? "";
            if ((msgType === "ai" || msgType === "assistant") && msg?.content) {
              setFinalText(
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content),
              );
              break;
            }
          }
          normalised = {
            type: "execution_complete",
            message: "Workflow completed successfully",
            status: "completed",
            timestamp: new Date().toISOString(),
          };
        }

        if (normalised) {
          setEvents((prev) => [...prev, normalised!]);
        }
      }

      setStatus("done");
    } catch (err: unknown) {
      if ((err as any)?.name === "AbortError") return;
      setStatus("error");
      setEvents((prev) => [
        ...prev,
        {
          type: "execution_failed",
          message: String(err),
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [executionId, workflowId, userMessage]);

  // Start as soon as arguments are ready
  useEffect(() => {
    if (executionId && workflowId && userMessage) {
      startStream();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [startStream]); // eslint-disable-line react-hooks/exhaustive-deps

  return { events, status, finalText };
}
