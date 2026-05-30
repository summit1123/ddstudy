import { NextResponse } from "next/server";
import { readDb } from "@/lib/db";
import { buildStudentReport } from "@/lib/reporting";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  const db = await readDb();
  const students = db.students;
  const reports = await Promise.all(
    students.map((student) => buildStudentReport(student.id, cardId))
  );
  return NextResponse.json({ cardId, reports });
}
