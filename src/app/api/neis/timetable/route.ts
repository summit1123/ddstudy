import { NextRequest, NextResponse } from "next/server";

import {
  getTimetable,
  parsePositiveInt,
  serializeApiError,
  type NeisTimetableKind,
} from "../../../../lib/neis";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  try {
    const result = await getTimetable({
      kind: (params.get("kind") ?? "his") as NeisTimetableKind,
      officeCode: params.get("officeCode") ?? "",
      schoolCode: params.get("schoolCode") ?? "",
      date: params.get("date") ?? "",
      grade: params.get("grade") ?? undefined,
      className: params.get("className") ?? params.get("class") ?? undefined,
      page: parsePositiveInt(params.get("page")),
      pageSize: parsePositiveInt(params.get("pageSize")),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const serialized = serializeApiError(error);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
