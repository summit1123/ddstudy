import { NextResponse } from "next/server";

import { loadPublicResources } from "../../../lib/public-data";

export const runtime = "nodejs";

export async function GET() {
  try {
    const dataset = await loadPublicResources();
    return NextResponse.json({ ok: true, ...dataset });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "PUBLIC_DATA_LOAD_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load public resource dataset.",
        },
      },
      { status: 500 },
    );
  }
}
