import { NextRequest, NextResponse } from "next/server";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function configuredAllowedOrigins() {
  const raw =
    process.env.AUTH_PROXY_ALLOWED_ORIGINS ||
    process.env.NEXT_PUBLIC_LEGACY_FRONTEND_URL ||
    "";

  return raw
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function getAllowedOrigins() {
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredAllowedOrigins()]);
}

export function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin")?.replace(/\/$/, "") || "";
  const headers = new Headers();

  if (!origin || !getAllowedOrigins().has(origin)) {
    return headers;
  }

  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    request.headers.get("access-control-request-headers") ||
      "Content-Type, Authorization",
  );
  headers.set("Vary", "Origin");

  return headers;
}

export function withCors(response: NextResponse, request: NextRequest) {
  getCorsHeaders(request).forEach((value, key) => {
    response.headers.set(key, value);
  });
  return response;
}

export function corsPreflight(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}
