"use client";

import { useEffect, useRef } from "react";
import type { ExecutionMessage } from "@/lib/stores/executionStore";

const roleColors: Record<string, string> = {
  user: "text-blue-600 dark:text-blue-400",
  assistant: "text-indigo-600 dark:text-indigo-400",
  system: "text-slate-500 dark:text-slate-400",
  tool: "text-emerald-600 dark:text-emerald-400",
};

interface ExecutionLogProps {
  messages: ExecutionMessage[];
  autoScroll?: boolean;
}

export function ExecutionLog({ messages, autoScroll = true }: ExecutionLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-500 text-sm">
        Waiting for messages...
      </div>
    );
  }

  return (
    <div className="space-y-3 overflow-y-auto max-h-[60vh] pr-2">
      {messages.map((msg, i) => (
        <div
          key={msg.id ?? i}
          className="flex flex-col gap-1 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 px-4 py-3"
        >
          <div className="flex items-center gap-2 text-xs">
            {msg.agent_name && (
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {msg.agent_name}
              </span>
            )}
            <span className={`font-medium ${roleColors[msg.role] ?? roleColors.system}`}>
              {msg.role}
            </span>
            <span className="text-slate-400 dark:text-slate-500 ml-auto">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
            {msg.token_count != null && (
              <span className="text-slate-400 dark:text-slate-500">
                {msg.token_count} tokens
              </span>
            )}
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
            {msg.content}
          </p>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
