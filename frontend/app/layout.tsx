import type { Metadata } from "next";
import { Providers } from "./providers";
import { Sidebar } from "@/components/ui/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Orchestration Platform",
  description: "Create, configure, and orchestrate AI agents into collaborative workflows",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-8 min-h-screen">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
