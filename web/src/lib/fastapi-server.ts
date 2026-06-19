import type { BetterAuthUser } from "@/lib/fastapi-types";

const FASTAPI_INTERNAL_BASE_URL =
  process.env.FASTAPI_INTERNAL_BASE_URL ||
  process.env.NEXT_PUBLIC_FASTAPI_BASE_URL ||
  "http://127.0.0.1:9000";

export function getFastApiInternalBaseUrl() {
  return FASTAPI_INTERNAL_BASE_URL.replace(/\/$/, "");
}

export function buildTrustedUserHeaders(user: BetterAuthUser) {
  const secret = process.env.FASTAPI_INTERNAL_AUTH_SECRET || "";
  if (!secret) {
    throw new Error("FASTAPI_INTERNAL_AUTH_SECRET is required for server-side FastAPI handoff.");
  }

  const headers = new Headers({
    "X-Internal-Auth-Secret": secret,
    "X-Better-Auth-User-Id": user.id,
  });

  if (user.email) headers.set("X-Better-Auth-User-Email", user.email);
  if (user.name) headers.set("X-Better-Auth-User-Name", user.name);
  if (user.image) headers.set("X-Better-Auth-User-Image", user.image);

  return headers;
}
