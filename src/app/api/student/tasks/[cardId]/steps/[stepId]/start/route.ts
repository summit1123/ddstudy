import { NextResponse } from "next/server";
import { id, updateDb } from "@/lib/db";
import { defaultLogPayload } from "@/lib/reporting";
import { resolveStudentId, validatePublishedStudentStep } from "@/lib/student-task-validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId: string; stepId: string }> }
) {
  const { cardId, stepId } = await params;
  const validation = await validatePublishedStudentStep(cardId, stepId);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 404 });
  }
  const studentId = resolveStudentId(validation.db, request);

  const result = await updateDb((db) => {
    const existing = db.studentStepLogs.find(
      (log) =>
        log.studentId === studentId &&
        log.cardId === cardId &&
        log.stepId === stepId &&
        log.eventType === "started"
    );
    if (existing) return { log: existing, alreadyStarted: true };

    const log = {
      id: id("log"),
      studentId,
      cardId,
      stepId,
      eventType: "started" as const,
      payloadJson: defaultLogPayload(),
      createdAt: new Date().toISOString()
    };
    db.studentStepLogs.push(log);
    return { log, alreadyStarted: false };
  });

  return NextResponse.json(result);
}
