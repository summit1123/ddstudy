import { NextResponse } from "next/server";
import { getCardBundle, readDb } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const bundle = await getCardBundle(cardId);
  if (!bundle) {
    return NextResponse.json({ error: "과제를 찾을 수 없습니다." }, { status: 404 });
  }
  if (bundle.card.status !== "published") {
    return NextResponse.json({ error: "아직 학생에게 배포되지 않은 과제입니다." }, { status: 404 });
  }
  const db = await readDb();
  const requestedStudentId = new URL(request.url).searchParams.get("studentId");
  const selectedStudent =
    (requestedStudentId ? db.students.find((student) => student.id === requestedStudentId) : undefined) ??
    db.students[0] ??
    null;
  if (!selectedStudent) {
    return NextResponse.json({ error: "등록된 학생이 없습니다. 선생님 화면에서 학생을 먼저 등록해 주세요." }, { status: 400 });
  }
  const studentId = selectedStudent.id;
  const logs = db.studentStepLogs.filter(
    (log) => log.studentId === studentId && log.cardId === cardId
  );
  const summary = db.studentTaskSummaries.find(
    (item) => item.studentId === studentId && item.cardId === cardId
  );
  return NextResponse.json({ ...bundle, studentId, student: selectedStudent, students: db.students, logs, summary });
}
