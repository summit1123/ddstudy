import { NextRequest, NextResponse } from "next/server";

import { getSchedule, parsePositiveInt, serializeApiError } from "../../../../lib/neis";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  try {
    const result = await getSchedule({
      officeCode: params.get("officeCode") ?? "",
      schoolCode: params.get("schoolCode") ?? "",
      date: params.get("date") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      page: parsePositiveInt(params.get("page")),
      pageSize: parsePositiveInt(params.get("pageSize")),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const serialized = serializeApiError(error);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
