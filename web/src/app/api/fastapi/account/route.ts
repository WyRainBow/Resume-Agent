import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { corsPreflight, withCors } from "@/lib/cors";
import {
  buildTrustedUserHeaders,
  getFastApiInternalBaseUrl,
} from "@/lib/fastapi-server";

export function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return withCors(
      NextResponse.json({ detail: "Unauthorized" }, { status: 401 }),
      request,
    );
  }

  let trustedHeaders: Headers;
  try {
    trustedHeaders = buildTrustedUserHeaders(session.user);
  } catch (error) {
    return withCors(
      NextResponse.json(
        {
          detail:
            error instanceof Error
              ? error.message
              : "FastAPI handoff is not configured.",
        },
        { status: 500 },
      ),
      request,
    );
  }

  const response = await fetch(
    `${getFastApiInternalBaseUrl()}/api/auth/better/account`,
    {
      headers: trustedHeaders,
      cache: "no-store",
    },
  );

  const body = await response.text();
  const contentType = response.headers.get("content-type") || "application/json";

  return withCors(
    new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": contentType,
      },
    }),
    request,
  );
}
