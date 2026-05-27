"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createMonitorWebSocket } from "@/lib/api";

type WSStatus = "connecting" | "open" | "closed" | "error";

export function useWebSocket(executionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WSStatus>("closed");
  const [messages, setMessages] = useState<any[]>([]);

  const connect = useCallback(async () => {
    if (!executionId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    const ws = await createMonitorWebSocket(executionId);
    wsRef.current = ws;

    ws.onopen = () => setStatus("open");
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setMessages((prev) => [...prev, data]);
      } catch {
        setMessages((prev) => [...prev, { content: e.data }]);
      }
    };
    ws.onerror = () => setStatus("error");
    ws.onclose = () => setStatus("closed");
  }, [executionId]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { status, messages, connect, disconnect };
}
