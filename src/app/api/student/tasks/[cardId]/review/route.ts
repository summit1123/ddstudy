import { NextResponse } from "next/server";
import { buildStudentReport, buildTaskSummary } from "@/lib/reporting";
import { resolveDemoStudentId, validatePublishedStudentCard } from "@/lib/student-task-validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const validation = await validatePublishedStudentCard(cardId);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 404 });
  }
  const studentId = resolveDemoStudentId(validation.db, request);

  const summary = await buildTaskSummary(studentId, cardId);
  const report = await buildStudentReport(studentId, cardId);
  return NextResponse.json({ ...summary, report });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const validation = await validatePublishedStudentCard(cardId);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 404 });
  }
  const studentId = resolveDemoStudentId(validation.db, request);

  const summary = await buildTaskSummary(studentId, cardId);
  return NextResponse.json(summary);
}
