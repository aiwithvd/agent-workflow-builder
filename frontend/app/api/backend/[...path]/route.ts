/**
 * Next.js API proxy for all backend calls.
 *
 * Routes: /api/backend/* → BACKEND_URL/api/v1/*
 *
 * The proxy injects X-Internal-Secret so the FastAPI backend can
 * authenticate that requests come from our server-side code, not
 * arbitrary callers. BACKEND_URL is a server-side env var — it is
 * never exposed to the browser.
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

/** Headers that must not be forwarded from the upstream response. */
const BLOCKED_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

async function proxy(
  req: NextRequest,
  params: { path: string[] }
): Promise<NextResponse> {
  const { path } = params;
  const search = req.nextUrl.search;
  const upstreamUrl = `${BACKEND_URL}/api/v1/${path.join("/")}${search}`;

  // Forward only safe, relevant request headers
  const forwardHeaders: Record<string, string> = {
    "X-Internal-Secret": INTERNAL_SECRET,
  };
  const contentType = req.headers.get("content-type");
  if (contentType) forwardHeaders["content-type"] = contentType;
  const accept = req.headers.get("accept");
  if (accept) forwardHeaders["accept"] = accept;

  // Read body for methods that carry one
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: body && body.byteLength > 0 ? body : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { detail: "Backend unreachable" },
      { status: 502 }
    );
  }

  // Forward upstream response headers (minus hop-by-hop headers)
  const responseHeaders = new Headers();
  upstreamRes.headers.forEach((value, key) => {
    if (!BLOCKED_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(req, params);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(req, params);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(req, params);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(req, params);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(req, params);
}
