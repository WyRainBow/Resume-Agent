import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { corsPreflight, withCors } from "@/lib/cors";
import {
  buildTrustedUserHeaders,
  getFastApiInternalBaseUrl,
} from "@/lib/fastapi-server";

type ProxyContext = {
  params: Promise<{
    path?: string[];
  }>;
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function buildTargetUrl(request: NextRequest, path: string[]) {
  const target = new URL(`/api/${path.join("/")}`, getFastApiInternalBaseUrl());
  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value);
  });
  return target;
}

function buildForwardHeaders(request: NextRequest) {
  const nextHeaders = new Headers();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lowerKey) && lowerKey !== "cookie") {
      nextHeaders.set(key, value);
    }
  });
  return nextHeaders;
}

async function proxyToFastApi(request: NextRequest, context: ProxyContext) {
  const { path = [] } = await context.params;
  if (path.length === 0) {
    return withCors(
      NextResponse.json({ detail: "Missing FastAPI path" }, { status: 400 }),
      request,
    );
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const forwardHeaders = buildForwardHeaders(request);

  if (session?.user?.id) {
    try {
      const trustedHeaders = buildTrustedUserHeaders(session.user);
      trustedHeaders.forEach((value, key) => forwardHeaders.set(key, value));
    } catch {
      // If the internal secret is not configured, proxy as an anonymous request.
    }
  }

  const hasBody = !["GET", "HEAD"].includes(request.method);
  const response = await fetch(buildTargetUrl(request, path), {
    method: request.method,
    headers: forwardHeaders,
    body: hasBody ? request.body : undefined,
    cache: "no-store",
    // Required when forwarding a streamed request body through fetch.
    duplex: hasBody ? "half" : undefined,
  } as RequestInit & { duplex?: "half" });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  return withCors(
    new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    }),
    request,
  );
}

export const OPTIONS = (request: NextRequest) => corsPreflight(request);
export const GET = proxyToFastApi;
export const POST = proxyToFastApi;
export const PUT = proxyToFastApi;
export const PATCH = proxyToFastApi;
export const DELETE = proxyToFastApi;
