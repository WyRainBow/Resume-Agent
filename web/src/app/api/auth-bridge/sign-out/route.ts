import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { corsPreflight, withCors } from "@/lib/cors";

export function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}

export async function POST(request: NextRequest) {
  await auth.api.signOut({
    headers: await headers(),
  });

  return withCors(new NextResponse(null, { status: 200 }), request);
}