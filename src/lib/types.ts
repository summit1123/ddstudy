export type Role = "teacher" | "student" | "parent";
export type CardStatus = "draft" | "published";
export type StudentEventType =
  | "started"
  | "completed"
  | "confused"
  | "simplify"
  | "help_sentence_viewed"
  | "quiz_answered";

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string | null;
  createdAt: string;
}

export interface School {
  id: string;
  schoolName: string;
  schoolCode: string;
  officeCode: string;
  address: string;
  schoolLevel: string;
  source: string;
}

export interface Classroom {
  id: string;
  schoolId: string;
  grade: string;
  classNo: string;
  teacherId: string;
}

export interface Student {
  id: string;
  classroomId: string;
  nickname: string;
  supportProfileJson: Record<string, unknown>;
  createdAt: string;
}

export interface Timetable {
  id: string;
  schoolId: string;
  grade: string;
  classNo: string;
  date: string;
  period: number;
  subject: string;
  source: string;
}

export interface SchoolSchedule {
  id: string;
  schoolId: string;
  date: string;
  eventName: string;
  eventType: string;
  source: string;
}

export interface Standard {
  id: string;
  grade: string;
  subject: string;
  domain: string;
  standardCode: string;
  standardText: string;
  achievementLevelText: string;
  keywords: string[];
  sourceUrl: string;
  license: string;
  embedding?: number[];
}

export interface LearningResource {
  id: string;
  grade: string;
  subject: string;
  title: string;
  description: string;
  resourceType: string;
  relatedStandardId: string;
  url: string;
  sourceUrl: string;
  license: string;
  embedding?: number[];
}

export interface Lesson {
  id: string;
  teacherId: string;
  classroomId: string;
  schoolId: string;
  grade: string;
  subject: string;
  topic: string;
  lessonDate: string;
  lessonContent: string;
  assignmentInstruction: string;
  selectedStandardId: string | null;
  supportOptionsJson: string[];
  createdAt: string;
}

export interface Keyword {
  word: string;
  easyMeaning: string;
}

export type VisualHintType =
  | "text_only"
  | "rectangle_dimension"
  | "number_line"
  | "sequence_checklist"
  | "image_asset";

export interface VisualHint {
  type: VisualHintType;
  data?: Record<string, unknown>;
  assetUrl?: string;
  alt?: string;
  labels?: string[];
}

export interface MicroQuiz {
  question: string;
  choices: string[];
  answer: string;
  explanation?: string;
}

export interface CardStandard {
  id?: string;
  code?: string;
  text: string;
  sourceType?: string;
  sourceName?: string;
  sourceUrl?: string;
  license?: string;
}

export interface ReviewResource {
  title: string;
  type: "video" | "practice" | "card" | "text";
  description: string;
  resourceId?: string;
}

export interface CardReview {
  goodPoints: string[];
  nextReview: ReviewResource[];
  askTeacherSentence: string;
  homeMission?: string;
}

export interface ExecutionCard {
  id: string;
  lessonId: string;
  title: string;
  goal: string;
  subject: string;
  grade: string;
  topic: string;
  standardJson: CardStandard;
  easyExplanation: string;
  keywordsJson: Keyword[];
  supportOptionsJson: string[];
  reviewJson: CardReview;
  status: CardStatus;
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string;
}

export interface ExecutionStep {
  id: string;
  cardId: string;
  order: number;
  stepText: string;
  visualHintJson: VisualHint;
  microQuizJson: MicroQuiz;
  helpSentence: string;
  teacherTip: string;
}

export interface StudentStepLog {
  id: string;
  studentId: string;
  cardId: string;
  stepId: string;
  eventType: StudentEventType;
  payloadJson: Record<string, unknown>;
  createdAt: string;
}

export interface StudentTaskSummary {
  id: string;
  studentId: string;
  cardId: string;
  completionRate: number;
  totalTimeSeconds: number;
  helpRequestCount: number;
  correctQuizCount: number;
  totalQuizCount: number;
  stuckStepCount: number;
  generatedReviewJson: {
    goodPoints: string[];
    nextReview: ReviewResource[];
    askTeacherSentence: string;
    homeMission?: string;
  };
}

export interface Report {
  id: string;
  studentId: string;
  cardId: string | null;
  summary: string;
  difficultyTagsJson: string[];
  aiRecommendationsJson: string[];
  parentMemo: string;
  createdAt: string;
}

export interface AppDb {
  users: User[];
  schools: School[];
  classrooms: Classroom[];
  students: Student[];
  timetables: Timetable[];
  schoolSchedules: SchoolSchedule[];
  standards: Standard[];
  learningResources: LearningResource[];
  lessons: Lesson[];
  executionCards: ExecutionCard[];
  executionSteps: ExecutionStep[];
  studentStepLogs: StudentStepLog[];
  studentTaskSummaries: StudentTaskSummary[];
  reports: Report[];
}
