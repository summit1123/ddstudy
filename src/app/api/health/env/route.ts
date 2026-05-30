import { NextResponse } from "next/server";
import { getPublicEnvStatus } from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    env: getPublicEnvStatus(),
  });
}
