import { NextResponse } from "next/server";
import { addStudentLog } from "@/lib/db";
import { buildTaskSummary, defaultLogPayload } from "@/lib/reporting";
import { resolveDemoStudentId, validatePublishedStudentStep } from "@/lib/student-task-validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId: string; stepId: string }> }
) {
  const { cardId, stepId } = await params;
  const validation = await validatePublishedStudentStep(cardId, stepId);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 404 });
  }
  const studentId = resolveDemoStudentId(validation.db, request);

  const log = await addStudentLog({
    studentId,
    cardId,
    stepId,
    eventType: "confused",
    payloadJson: defaultLogPayload()
  });
  const { summary } = await buildTaskSummary(studentId, cardId);
  return NextResponse.json({ log, summary });
}
