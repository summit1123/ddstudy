import { NextResponse } from "next/server";

import { summarizePublicResources } from "../../../../lib/public-data";

export const runtime = "nodejs";

export async function POST() {
  try {
    const summary = await summarizePublicResources();

    return NextResponse.json({
      ok: true,
      mode: "validate-bundled-official-sources",
      ...summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INGEST_VALIDATION_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Unable to validate bundled public resource data.",
        },
      },
      { status: 500 },
    );
  }
}
