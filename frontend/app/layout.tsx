import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Orchestration Platform",
  description:
    "Create, configure, and orchestrate AI agents into collaborative workflows",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="bg-white border-b border-gray-200">
            <nav className="container flex items-center justify-between py-4">
              <div className="flex items-center gap-8">
                <Link href="/" className="text-2xl font-bold text-primary">
                  🤖 Agent Orchestration
                </Link>
                <div className="flex gap-6">
                  <Link
                    href="/agents"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Agents
                  </Link>
                  <Link
                    href="/workflows"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Workflows
                  </Link>
                  <Link
                    href="/executions"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Executions
                  </Link>
                </div>
              </div>
            </nav>
          </header>

          {/* Main content */}
          <main className="flex-1 container py-8">{children}</main>

          {/* Footer */}
          <footer className="bg-gray-100 border-t border-gray-200 py-6">
            <div className="container text-center text-gray-600 text-sm">
              <p>
                Agent Orchestration Platform v0.1.0 | Build and deploy
                multi-agent workflows
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
