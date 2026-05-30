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

export const demoDb: AppDb = {
  ...emptyDb,
  users: [
    {
      id: "teacher_001",
      role: "teacher",
      name: "교사 계정",
      email: "teacher@example.local",
      createdAt: now
    },
    {
      id: "student_a",
      role: "student",
      name: "학생 A",
      email: null,
      createdAt: now
    },
    {
      id: "student_b",
      role: "student",
      name: "학생 B",
      email: null,
      createdAt: now
    },
    {
      id: "student_c",
      role: "student",
      name: "학생 C",
      email: null,
      createdAt: now
    }
  ],
  schools: [
    {
      id: "school_demo",
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
      id: "classroom_4_2",
      schoolId: "school_demo",
      grade: "4",
      classNo: "2",
      teacherId: "teacher_001"
    }
  ],
  students: [
    {
      id: "student_a",
      classroomId: "classroom_4_2",
      nickname: "학생 A",
      supportProfileJson: {
        profile: "긴 문장 이해 어려움",
        supportOptions: ["easy_language", "help_sentence"],
        preferredTone: "calm"
      },
      createdAt: now
    },
    {
      id: "student_b",
      classroomId: "classroom_4_2",
      nickname: "학생 B",
      supportProfileJson: {
        profile: "순서 기억 어려움",
        supportOptions: ["step_breakdown", "repeat_check"],
        preferredTone: "structured"
      },
      createdAt: now
    },
    {
      id: "student_c",
      classroomId: "classroom_4_2",
      nickname: "학생 C",
      supportProfileJson: {
        profile: "시각 단서 필요",
        supportOptions: ["visual_hint", "life_example"],
        preferredTone: "visual"
      },
      createdAt: now
    }
  ],
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
