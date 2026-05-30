import { NextResponse } from "next/server";
import { readDb } from "@/lib/db";

export async function GET(request: Request) {
  const db = await readDb();
  const requestedStudentId = new URL(request.url).searchParams.get("studentId");
  const selectedStudent =
    (requestedStudentId ? db.students.find((student) => student.id === requestedStudentId) : undefined) ??
    db.students[0] ??
    null;
  if (!selectedStudent) {
    return NextResponse.json({
      studentId: null,
      student: null,
      students: [],
      tasks: [],
    });
  }
  const studentId = selectedStudent.id;
  const cards = db.executionCards
    .filter((card) => card.status === "published")
    .sort((a, b) => {
      const left = new Date(a.publishedAt ?? a.updatedAt ?? a.createdAt).getTime();
      const right = new Date(b.publishedAt ?? b.updatedAt ?? b.createdAt).getTime();
      return right - left;
    })
    .map((card) => {
      const lesson = db.lessons.find((item) => item.id === card.lessonId);
      const steps = db.executionSteps
        .filter((step) => step.cardId === card.id)
        .sort((a, b) => a.order - b.order);
      const summary = db.studentTaskSummaries.find(
        (item) => item.cardId === card.id && item.studentId === studentId
      );
      return { card, lesson, steps, summary };
    });
  return NextResponse.json({
    studentId,
    student: selectedStudent,
    students: db.students,
    tasks: cards,
  });
}
