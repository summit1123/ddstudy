import type { AppDb } from "./types";

const now = new Date().toISOString();

export const emptyDb: AppDb = {
  users: [],
  schools: [],
  classrooms: [],
  students: [],
  timetables: [],
  schoolSchedules: [],
  standards: [],
  learningResources: [],
  lessons: [],
  executionCards: [],
  executionSteps: [],
  studentStepLogs: [],
  studentTaskSummaries: [],
  reports: []
};

export const seedDb: AppDb = {
  ...emptyDb,
  users: [
    {
      id: "teacher_local",
      role: "teacher",
      name: "교사 계정",
      email: "teacher@example.local",
      createdAt: now
    }
  ],
  schools: [
    {
      id: "school_pending",
      schoolName: "학교 연결 전",
      schoolCode: "",
      officeCode: "",
      address: "NEIS 학교 검색으로 실제 학교를 연결해 주세요.",
      schoolLevel: "",
      source: "unconfigured"
    }
  ],
  classrooms: [
    {
      id: "classroom_default",
      schoolId: "school_pending",
      grade: "4",
      classNo: "2",
      teacherId: "teacher_local"
    }
  ],
  students: [],
  timetables: [],
  schoolSchedules: [],
  standards: [],
  learningResources: [],
  lessons: [],
  executionCards: [],
  executionSteps: [],
  studentStepLogs: [],
  studentTaskSummaries: [],
  reports: []
};
