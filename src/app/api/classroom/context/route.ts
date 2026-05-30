import { NextResponse } from "next/server";
import { id, readDb, updateDb } from "@/lib/db";
import type { Classroom, School } from "@/lib/types";

export const runtime = "nodejs";

type ContextPatchBody = {
  school?: {
    schoolName?: string;
    schoolCode?: string;
    officeCode?: string;
    address?: string;
    schoolLevel?: string;
    source?: string;
  };
  classroom?: {
    grade?: string;
    classNo?: string;
  };
};

function latestPublishedCardId(db: Awaited<ReturnType<typeof readDb>>) {
  return [...db.executionCards]
    .filter((card) => card.status === "published")
    .sort((a, b) => {
      const left = new Date(a.publishedAt ?? a.updatedAt ?? a.createdAt).getTime();
      const right = new Date(b.publishedAt ?? b.updatedAt ?? b.createdAt).getTime();
      return right - left;
    })[0]?.id;
}

function buildContext(db: Awaited<ReturnType<typeof readDb>>) {
  const teacher = db.users.find((user) => user.role === "teacher") ?? null;
  const classroom = db.classrooms[0] ?? null;
  const school = classroom ? db.schools.find((item) => item.id === classroom.schoolId) ?? null : db.schools[0] ?? null;
  const activeCardId = latestPublishedCardId(db) ?? db.executionCards[0]?.id ?? null;
  const students = classroom
    ? db.students.filter((student) => student.classroomId === classroom.id)
    : db.students;
  const summariesByStudentId = Object.fromEntries(
    students.map((student) => [
      student.id,
      activeCardId
        ? db.studentTaskSummaries.find((summary) => summary.studentId === student.id && summary.cardId === activeCardId) ?? null
        : null,
    ]),
  );

  return {
    teacher,
    school,
    classroom,
    students,
    activeCardId,
    summariesByStudentId,
  };
}

export async function GET() {
  const db = await readDb();
  return NextResponse.json(buildContext(db));
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ContextPatchBody;

  const context = await updateDb((db) => {
    const teacher = db.users.find((user) => user.role === "teacher") ?? db.users[0];
    let school: School = db.schools[0] ?? {
      id: "school_demo",
      schoolName: "학교 연결 전",
      schoolCode: "",
      officeCode: "",
      address: "NEIS 학교 검색으로 연결해 주세요.",
      schoolLevel: "",
      source: "unconfigured",
    };

    if (!db.schools.some((item) => item.id === school.id)) {
      db.schools.push(school);
    }

    if (body.school) {
      school = {
        ...school,
        schoolName: body.school.schoolName?.trim() || school.schoolName,
        schoolCode: body.school.schoolCode ?? school.schoolCode,
        officeCode: body.school.officeCode ?? school.officeCode,
        address: body.school.address ?? school.address,
        schoolLevel: body.school.schoolLevel ?? school.schoolLevel,
        source: body.school.source ?? "NEIS",
      };
      const schoolIndex = db.schools.findIndex((item) => item.id === school.id);
      db.schools[schoolIndex] = school;
    }

    let classroom: Classroom = db.classrooms[0] ?? {
      id: id("classroom"),
      schoolId: school.id,
      grade: "4",
      classNo: "1",
      teacherId: teacher?.id ?? "teacher_001",
    };

    if (!db.classrooms.some((item) => item.id === classroom.id)) {
      db.classrooms.push(classroom);
    }

    classroom = {
      ...classroom,
      schoolId: school.id,
      grade: body.classroom?.grade?.trim() || classroom.grade,
      classNo: body.classroom?.classNo?.trim() || classroom.classNo,
    };
    const classroomIndex = db.classrooms.findIndex((item) => item.id === classroom.id);
    db.classrooms[classroomIndex] = classroom;

    return buildContext(db);
  });

  return NextResponse.json(context);
}
