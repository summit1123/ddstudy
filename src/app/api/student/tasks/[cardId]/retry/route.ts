import { NextResponse } from "next/server";
import { updateDb } from "@/lib/db";
import { resolveStudentId, validatePublishedStudentCard } from "@/lib/student-task-validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const validation = await validatePublishedStudentCard(cardId);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 404 });
  }
  const studentId = resolveStudentId(validation.db, request);

  const result = await updateDb((db) => {
    const beforeLogs = db.studentStepLogs.length;
    const beforeSummaries = db.studentTaskSummaries.length;
    const beforeReports = db.reports.length;
    db.studentStepLogs = db.studentStepLogs.filter(
      (log) => !(log.studentId === studentId && log.cardId === cardId)
    );
    db.studentTaskSummaries = db.studentTaskSummaries.filter(
      (summary) => !(summary.studentId === studentId && summary.cardId === cardId)
    );
    db.reports = db.reports.filter(
      (report) => !(report.studentId === studentId && report.cardId === cardId)
    );
    return {
      studentId,
      cardId,
      removedLogs: beforeLogs - db.studentStepLogs.length,
      removedSummaries: beforeSummaries - db.studentTaskSummaries.length,
      removedReports: beforeReports - db.reports.length,
    };
  });

  return NextResponse.json(result);
}
