"use client";

import { getBearerToken } from "@/lib/auth-client";

const FASTAPI_BASE_URL =
  process.env.NEXT_PUBLIC_FASTAPI_BASE_URL || "http://127.0.0.1:9000";

export function getFastApiBaseUrl() {
  return FASTAPI_BASE_URL.replace(/\/$/, "");
}

export async function fastapiFetch(path: string, init: RequestInit = {}) {
  const token = getBearerToken();
  const headers = new Headers(init.headers);

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${getFastApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
  });
}
