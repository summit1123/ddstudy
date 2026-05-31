import { NextResponse } from "next/server";
import { addStudentLog } from "@/lib/db";
import { buildTaskSummary, defaultLogPayload } from "@/lib/reporting";
import { resolveStudentId, validatePublishedStudentStep } from "@/lib/student-task-validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId: string; stepId: string }> }
) {
  const { cardId, stepId } = await params;
  const body = (await request.json().catch(() => ({}))) as { studentResponse?: unknown };
  const validation = await validatePublishedStudentStep(cardId, stepId);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 404 });
  }
  const studentId = resolveStudentId(validation.db, request);
  const studentResponse =
    typeof body.studentResponse === "string" ? body.studentResponse.trim().slice(0, 800) : "";

  const log = await addStudentLog({
    studentId,
    cardId,
    stepId,
    eventType: "completed",
    payloadJson: defaultLogPayload(studentResponse ? { studentResponse } : undefined)
  });
  const { summary } = await buildTaskSummary(studentId, cardId);
  return NextResponse.json({ log, summary });
}
