import { NextResponse } from "next/server";
import { id, readDb, updateDb } from "@/lib/db";
import { normalizeSupportOptions } from "@/lib/support-options";
import type { Student, User } from "@/lib/types";

export const runtime = "nodejs";

type CreateStudentBody = {
  nickname?: string;
  classroomId?: string;
  profile?: string;
  supportOptions?: string[];
};

export async function GET() {
  const db = await readDb();
  return NextResponse.json({ students: db.students });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CreateStudentBody;
  const nickname = body.nickname?.trim();

  if (!nickname) {
    return NextResponse.json({ error: "학생 이름 또는 별칭을 입력해 주세요." }, { status: 400 });
  }

  const created = await updateDb((db) => {
    const classroom = body.classroomId
      ? db.classrooms.find((item) => item.id === body.classroomId)
      : db.classrooms[0];
    if (!classroom) {
      throw new Error("학생을 등록할 학급이 없습니다. 먼저 학교/학급을 설정해 주세요.");
    }

    const existing = db.students.find(
      (student) => student.classroomId === classroom.id && student.nickname.trim() === nickname
    );
    if (existing) {
      return existing;
    }

    const studentId = id("student");
    const now = new Date().toISOString();
    const user: User = {
      id: studentId,
      role: "student",
      name: nickname,
      email: null,
      createdAt: now,
    };
    const student: Student = {
      id: studentId,
      classroomId: classroom.id,
      nickname,
      supportProfileJson: {
        profile: body.profile?.trim() || "지원 프로필 미설정",
        supportOptions: normalizeSupportOptions(body.supportOptions ?? ["easy_language", "step_breakdown", "help_sentence"]),
      },
      createdAt: now,
    };

    db.users.push(user);
    db.students.push(student);
    return student;
  });

  return NextResponse.json({ student: created }, { status: 201 });
}
