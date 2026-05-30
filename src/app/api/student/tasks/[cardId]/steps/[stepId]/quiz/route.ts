import { NextResponse } from "next/server";
import { addStudentLog } from "@/lib/db";
import { buildTaskSummary, defaultLogPayload } from "@/lib/reporting";
import { resolveStudentId, validatePublishedStudentStep } from "@/lib/student-task-validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId: string; stepId: string }> }
) {
  const { cardId, stepId } = await params;
  const body = (await request.json().catch(() => ({}))) as { answer?: string };
  const validation = await validatePublishedStudentStep(cardId, stepId);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 404 });
  }
  const studentId = resolveStudentId(validation.db, request);

  const step = validation.step;
  const isCorrect = body.answer === step.microQuizJson.answer;
  const log = await addStudentLog({
    studentId,
    cardId,
    stepId,
    eventType: "quiz_answered",
    payloadJson: defaultLogPayload({
      answer: body.answer ?? "",
      correctAnswer: step.microQuizJson.answer,
      isCorrect
    })
  });
  const { summary } = await buildTaskSummary(studentId, cardId);
  return NextResponse.json({ log, summary, isCorrect });
}
