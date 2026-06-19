"use client";

import { createAuthClient } from "better-auth/react";

const BEARER_TOKEN_KEY = "resume-agent:better-auth-bearer";

function readBearerToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(BEARER_TOKEN_KEY) || "";
}

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_BASE_URL || undefined,
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: readBearerToken,
    },
    onSuccess: (ctx) => {
      if (typeof window === "undefined") return;

      const authToken = ctx.response.headers.get("set-auth-token");
      if (authToken) {
        window.localStorage.setItem(BEARER_TOKEN_KEY, authToken);
      }
    },
  },
});

export const { signIn, signOut, signUp, useSession } = authClient;

export function getBearerToken() {
  return readBearerToken();
}

export function clearBearerToken() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(BEARER_TOKEN_KEY);
  }
}
