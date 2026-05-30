import { NextResponse } from "next/server";
import { buildStudentReport } from "@/lib/reporting";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  const cardId = new URL(request.url).searchParams.get("cardId") ?? undefined;
  try {
    const report = await buildStudentReport(studentId, cardId);
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "리포트를 만들 수 없습니다." },
      { status: 400 }
    );
  }
}
