import { NextRequest, NextResponse } from "next/server";

import { parsePositiveInt, searchSchools, serializeApiError } from "../../../../lib/neis";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  try {
    const result = await searchSchools({
      query: params.get("keyword") ?? params.get("query") ?? params.get("schoolName") ?? "",
      officeCode: params.get("officeCode") ?? undefined,
      schoolKind: params.get("schoolKind") ?? undefined,
      location: params.get("location") ?? undefined,
      page: parsePositiveInt(params.get("page")),
      pageSize: parsePositiveInt(params.get("pageSize")),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const serialized = serializeApiError(error);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
