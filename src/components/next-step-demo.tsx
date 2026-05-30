"use client";

import type * as React from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Search,
  School,
  Users,
} from "lucide-react";
import { demoDb } from "@/lib/demo-seed";
import {
  SUPPORT_OPTION_KEYS,
  SUPPORT_OPTION_LABELS,
  hasSupportOption,
  normalizeSupportOptions,
  supportOptionLabels,
  type SupportOptionKey,
} from "@/lib/support-options";

type TeacherView = "dashboard" | "prep" | "cards" | "reports";
type StudentView = "task" | "review" | "preview";
type RequestState = "idle" | "loading" | "saving" | "error";

type LessonStep = {
  id: string;
  title: string;
  visualHint: {
    type: "text_only" | "rectangle_dimension" | "number_line" | "sequence_checklist" | "image_asset";
    data?: Record<string, unknown> | null;
    assetUrl?: string | null;
    alt?: string | null;
  };
  checkQuestion: string;
  choices: string[];
  answer: string;
  quizExplanation?: string | null;
  helpSentence: string;
  teacherTip: string;
};

type ExecutionCard = {
  id: string;
  lessonId: string;
  subject: string;
  grade: string;
  title: string;
  topic: string;
  goal: string;
  easyExplanation: string;
  standard: {
    id?: string | null;
    code?: string | null;
    text: string;
    sourceType?: string | null;
    sourceName?: string | null;
    sourceUrl?: string | null;
    license?: string | null;
  };
  keywords: Array<{ word: string; easyMeaning: string }>;
  supportOptions: string[];
  review: {
    goodPoints: string[];
    nextReview: Array<{ title: string; type: "video" | "practice" | "card" | "text"; description: string; resourceId?: string | null }>;
    askTeacherSentence: string;
    homeMission?: string | null;
  };
  date: string;
  status: "draft" | "review" | "deployed";
  steps: LessonStep[];
};

type StudentProgress = {
  id: string;
  name: string;
  avatar: string;
  task: string;
  progress: number;
  blockedStep: string;
  status: "waiting" | "blocked" | "learning" | "smooth" | "done";
};

type ApiLesson = {
  id: string;
  grade: string;
  subject: string;
  topic: string;
  lessonDate: string;
  lessonContent: string;
  assignmentInstruction: string;
  supportOptionsJson: string[];
};

type ApiExecutionCard = {
  id: string;
  lessonId: string;
  title: string;
  goal: string;
  subject: string;
  grade: string;
  topic: string;
  standardJson: {
    id?: string | null;
    code?: string | null;
    text: string;
    sourceType?: string | null;
    sourceName?: string | null;
    sourceUrl?: string | null;
    license?: string | null;
  };
  easyExplanation: string;
  keywordsJson: Array<{ word: string; easyMeaning: string }>;
  supportOptionsJson: string[];
  reviewJson: {
    goodPoints: string[];
    nextReview: Array<{ title: string; type: "video" | "practice" | "card" | "text"; description: string; resourceId?: string | null }>;
    askTeacherSentence: string;
    homeMission?: string | null;
  };
  status: "draft" | "published";
  createdAt: string;
};

type ApiExecutionStep = {
  id: string;
  cardId: string;
  order: number;
  stepText: string;
  visualHintJson: {
    type: "text_only" | "rectangle_dimension" | "number_line" | "sequence_checklist" | "image_asset";
    data?: Record<string, unknown> | null;
    assetUrl?: string | null;
    alt?: string | null;
    labels?: string[];
  };
  microQuizJson: { question: string; choices: string[]; answer: string; explanation?: string | null };
  helpSentence: string;
  teacherTip: string;
};

type ApiTaskSummary = {
  completionRate: number;
  totalTimeSeconds: number;
  helpRequestCount: number;
  correctQuizCount: number;
  totalQuizCount: number;
  stuckStepCount: number;
  generatedReviewJson: {
    goodPoints: string[];
    nextReview: Array<{ title: string; type: "video" | "practice" | "card" | "text"; description: string; resourceId?: string | null }>;
    askTeacherSentence: string;
    homeMission?: string | null;
  };
};

type ApiReportPerStep = {
  step: {
    id: string;
    order: number;
    stepText: string;
  };
  isCompleted: boolean;
  confusedCount: number;
  simplifyCount: number;
  helpSentenceViewedCount?: number;
  quizAnswered: boolean;
  isCorrect: boolean;
  timeSeconds: number;
};

type ApiStudentReportResult = {
  report: {
    summary: string;
    difficultyTagsJson: string[];
    aiRecommendationsJson: string[];
    parentMemo: string;
    createdAt: string;
  };
  summary: ApiTaskSummary;
  perStep: ApiReportPerStep[];
};

type ApiStudent = {
  id: string;
  nickname: string;
  supportProfileJson?: Record<string, unknown>;
};

type ApiClassroomContext = {
  teacher: { id: string; name: string } | null;
  school: {
    id: string;
    schoolName: string;
    schoolCode: string;
    officeCode: string;
    address: string;
    schoolLevel: string;
    source: string;
  } | null;
  classroom: {
    id: string;
    schoolId: string;
    grade: string;
    classNo: string;
    teacherId: string;
  } | null;
  students: ApiStudent[];
  activeCardId?: string | null;
  summariesByStudentId?: Record<string, ApiTaskSummary | null>;
};

type ApiNeisSchool = {
  ATPT_OFCDC_SC_CODE: string;
  ATPT_OFCDC_SC_NM: string;
  SD_SCHUL_CODE: string;
  SCHUL_NM: string;
  SCHUL_KND_SC_NM: string;
  ORG_RDNMA?: string | null;
  LCTN_SC_NM?: string | null;
};

type ApiStudentTask = {
  studentId: string | null;
  student?: ApiStudent | null;
  students?: ApiStudent[];
  card: ApiExecutionCard;
  lesson: ApiLesson | null;
  steps: ApiExecutionStep[];
  summary?: ApiTaskSummary | null;
};

type ApiStandardSearchResult = {
  id: string;
  title: string;
  subject: string;
  gradeBand: string;
  summary: string;
  url?: string;
  standardCode?: string;
  sourceType?: "seed" | "official" | "crawled" | "uploaded" | "manual";
  sourceName?: string;
  sourceUrl?: string;
  license?: string;
  chunkType?: "standard" | "achievement_level" | "remediation" | "assessment" | "metadata";
  citations: Array<{ standardId: string; title: string; source: string; locator?: string; quote?: string }>;
  score?: number;
};

type DemoSnapshot = {
  schoolId: string;
  school: string;
  schoolCode: string;
  officeCode: string;
  schoolAddress: string;
  schoolSource: string;
  classroomId: string;
  className: string;
  classGrade: string;
  classNo: string;
  teacherName: string;
  dateLabel: string;
  lessonTopic: string;
  activeCardId: string;
  students: StudentProgress[];
  cards: ExecutionCard[];
};

type LessonPrepPayload = {
  schoolId: string;
  classroomId: string;
  grade: string;
  classNo: string;
  subject: string;
  lessonDate: string;
  topic: string;
  lessonContent: string;
  assignmentInstruction: string;
  selectedStandardId?: string;
  selectedStandardCode?: string;
  selectedStandardText?: string;
  selectedStandardSourceType?: string;
  selectedStandardSourceName?: string;
  selectedStandardSourceUrl?: string;
  selectedStandardLicense?: string;
  supportOptions: string[];
};

function normalizeLessonDateForInput(value: string) {
  const isoLike = value.match(/\d{4}[.-]\d{2}[.-]\d{2}/)?.[0];
  return isoLike?.replaceAll(".", "-") ?? new Date().toISOString().slice(0, 10);
}

function gradeBandFromGrade(grade: string) {
  return grade.startsWith("초") ? grade : `초${grade}`;
}

function sourceTypeLabel(sourceType?: ApiStandardSearchResult["sourceType"] | string | null) {
  if (sourceType === "official" || sourceType === "official_metadata") return "공식 메타데이터";
  if (sourceType === "crawled") return "크롤링";
  if (sourceType === "uploaded") return "업로드";
  if (sourceType === "manual") return "수동";
  return "데모 seed";
}

function sourceTypeClassName(sourceType?: ApiStandardSearchResult["sourceType"]) {
  return `dhg-source-badge is-${sourceType ?? "seed"}`;
}

function standardCode(standard: ApiStandardSearchResult) {
  return standard.standardCode ?? standard.citations[0]?.standardId ?? standard.id;
}

function standardSourceUrl(standard: ApiStandardSearchResult) {
  return standard.sourceUrl ?? standard.url;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0분";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}분 ${rest.toString().padStart(2, "0")}초` : `${rest}초`;
}

function teacherRoute(view: TeacherView, cardId?: string) {
  if (view === "dashboard") return "/teacher/dashboard";
  if (view === "prep") return "/teacher/lessons/new";
  if (view === "cards") return cardId ? `/teacher/cards/${encodeURIComponent(cardId)}/edit` : "/teacher/cards";
  if (view === "reports") return "/teacher/reports";
  return "/teacher/dashboard";
}

function studentRoute(view: StudentView, cardId?: string) {
  if (view === "preview") return "/student/preview";
  if (view === "review") return cardId ? `/student/tasks/${encodeURIComponent(cardId)}/review` : "/student/review";
  return cardId ? `/student/tasks/${encodeURIComponent(cardId)}` : "/student/task";
}

function withStudentQuery(path: string, studentId?: string) {
  return studentId ? `${path}${path.includes("?") ? "&" : "?"}studentId=${encodeURIComponent(studentId)}` : path;
}

function copyTextToClipboard(text: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) return;
  void navigator.clipboard.writeText(text);
}

function buildInitialSnapshot(): DemoSnapshot {
  const school = demoDb.schools[0];
  const classroom = demoDb.classrooms[0];
  const teacher = demoDb.users.find((user) => user.role === "teacher");
  const lessonsById = new Map(demoDb.lessons.map((lesson) => [lesson.id, lesson]));
  const firstLesson = demoDb.lessons[0];
  const cards = demoDb.executionCards.map((card) => {
    const lesson = lessonsById.get(card.lessonId);
    return {
      id: card.id,
      lessonId: card.lessonId,
      subject: card.subject || lesson?.subject || "",
      grade: gradeBandFromGrade(card.grade || lesson?.grade || ""),
      title: card.title,
      topic: card.topic || lesson?.topic || card.title,
      goal: card.goal,
      easyExplanation: card.easyExplanation,
      standard: card.standardJson,
      keywords: card.keywordsJson,
      supportOptions: normalizeSupportOptions(card.supportOptionsJson),
      review: card.reviewJson,
      date: lesson?.lessonDate.replaceAll("-", ".") ?? card.createdAt.slice(0, 10).replaceAll("-", "."),
      status: card.status === "published" ? "deployed" : "review",
      steps: demoDb.executionSteps
        .filter((step) => step.cardId === card.id)
        .sort((a, b) => a.order - b.order)
        .map((step) => ({
          id: step.id,
          title: step.stepText,
          visualHint: step.visualHintJson,
          checkQuestion: step.microQuizJson.question,
          choices: step.microQuizJson.choices,
          answer: step.microQuizJson.answer,
          quizExplanation: step.microQuizJson.explanation,
          helpSentence: step.helpSentence,
          teacherTip: step.teacherTip,
        })),
    } satisfies ExecutionCard;
  });

  return {
    schoolId: school?.id ?? "",
    school: school?.schoolName ?? "학교 연결 전",
    schoolCode: school?.schoolCode ?? "",
    officeCode: school?.officeCode ?? "",
    schoolAddress: school?.address ?? "",
    schoolSource: school?.source ?? "unconfigured",
    classroomId: classroom?.id ?? "",
    className: classroom ? `${classroom.grade}학년 ${classroom.classNo}반` : "데모 학급",
    classGrade: classroom?.grade ?? "4",
    classNo: classroom?.classNo ?? "1",
    teacherName: teacher?.name ?? "데모 교사",
    dateLabel: firstLesson?.lessonDate.replaceAll("-", ".") ?? normalizeLessonDateForInput(""),
    lessonTopic: firstLesson?.topic ?? cards[0]?.title ?? "",
    activeCardId: cards[0]?.id ?? "",
    students: demoDb.students.map((student, index) => ({
      id: student.id,
      name: student.nickname,
      avatar: ["👦🏻", "👧🏻", "👦🏽"][index % 3],
      task: firstLesson?.topic ?? cards[0]?.title ?? "",
      progress: 0,
      blockedStep: "로그 대기",
      status: "learning" as const,
    })),
    cards,
  };
}

const initialSnapshot: DemoSnapshot = buildInitialSnapshot();

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}${body ? `: ${body.slice(0, 160)}` : ""}`);
  }

  return response.json() as Promise<T>;
}

function mapApiStep(step: ApiExecutionStep): LessonStep {
  return {
    id: step.id,
    title: step.stepText,
    visualHint: {
      type: step.visualHintJson.type,
      data: step.visualHintJson.data ?? (step.visualHintJson.labels ? { labels: step.visualHintJson.labels } : undefined),
      assetUrl: step.visualHintJson.assetUrl,
      alt: step.visualHintJson.alt,
    },
    checkQuestion: step.microQuizJson.question,
    choices: step.microQuizJson.choices,
    answer: step.microQuizJson.answer,
    quizExplanation: step.microQuizJson.explanation,
    helpSentence: step.helpSentence,
    teacherTip: step.teacherTip,
  };
}

function mapApiCard(card: ApiExecutionCard, lesson: ApiLesson | undefined | null, steps: ApiExecutionStep[]): ExecutionCard {
  const gradeLabel = card.grade ? (card.grade.startsWith("초") ? card.grade : `초${card.grade}`) : lesson?.grade ? `초${lesson.grade}` : "";
  return {
    id: card.id,
    lessonId: card.lessonId,
    subject: card.subject || lesson?.subject || "",
    grade: gradeLabel,
    title: card.title,
    topic: card.topic || lesson?.topic || card.title,
    goal: card.goal,
    easyExplanation: card.easyExplanation,
    standard: card.standardJson,
    keywords: card.keywordsJson,
    supportOptions: normalizeSupportOptions(card.supportOptionsJson),
    review: card.reviewJson,
    date: lesson?.lessonDate?.replaceAll("-", ".") ?? card.createdAt.slice(0, 10).replaceAll("-", "."),
    status: card.status === "published" ? "deployed" : "review",
    steps: steps.map(mapApiStep),
  };
}

async function loadTeacherSnapshot(preferredCardId?: string): Promise<DemoSnapshot> {
  const [lessonResult, cardResult, context] = await Promise.all([
    requestJson<{ lessons: ApiLesson[] }>("/api/lessons"),
    requestJson<{ cards: ApiExecutionCard[] }>("/api/execution-cards"),
    requestJson<ApiClassroomContext>("/api/classroom/context"),
  ]);
  const lessonsById = new Map(lessonResult.lessons.map((lesson) => [lesson.id, lesson]));
  const cards = await Promise.all(
    cardResult.cards.map(async (card) => {
      const detail = await requestJson<{ card: ApiExecutionCard; steps: ApiExecutionStep[] }>(`/api/execution-cards/${encodeURIComponent(card.id)}`);
      return mapApiCard(detail.card, lessonsById.get(card.lessonId), detail.steps);
    }),
  );
  const activeCardId = preferredCardId && cards.some((card) => card.id === preferredCardId)
    ? preferredCardId
    : cards[0]?.id ?? "";
  const activeCard = cards.find((card) => card.id === activeCardId) ?? cards[0];
  const primaryLesson = activeCard ? lessonsById.get(activeCard.lessonId) : lessonResult.lessons[0];
  const classroom = context.classroom;
  const school = context.school;
  const students: StudentProgress[] = context.students.map((student, index) => {
    const summary = context.summariesByStudentId?.[student.id];
    const helpRequestCount = summary?.helpRequestCount ?? 0;
    const progress = summary?.completionRate ?? 0;
    return {
      id: student.id,
      name: student.nickname,
      avatar: ["👤", "👥", "🙂", "😊"][index % 4],
      task: activeCard?.title ?? "배포된 과제 없음",
      progress,
      blockedStep: helpRequestCount > 0 ? `도움 요청 ${helpRequestCount}회` : progress > 0 ? `${progress}% 완료` : "로그 대기",
      status: activeCard ? (progress >= 100 ? "done" : helpRequestCount > 0 ? "blocked" : progress > 0 ? "learning" : "smooth") : "waiting",
    };
  });

  return {
    ...initialSnapshot,
    schoolId: school?.id ?? classroom?.schoolId ?? initialSnapshot.schoolId,
    school: school?.schoolName ?? "학교 연결 전",
    schoolCode: school?.schoolCode ?? "",
    officeCode: school?.officeCode ?? "",
    schoolAddress: school?.address ?? "",
    schoolSource: school?.source ?? "unconfigured",
    classroomId: classroom?.id ?? initialSnapshot.classroomId,
    className: classroom ? `${classroom.grade}학년 ${classroom.classNo}반` : "학급 설정 필요",
    classGrade: classroom?.grade ?? initialSnapshot.classGrade,
    classNo: classroom?.classNo ?? initialSnapshot.classNo,
    teacherName: context.teacher?.name ?? initialSnapshot.teacherName,
    lessonTopic: primaryLesson?.topic ?? initialSnapshot.lessonTopic,
    students,
    cards,
    activeCardId,
  };
}

function statusLabel(status: StudentProgress["status"]) {
  if (status === "waiting") return "대기";
  if (status === "blocked") return "막힘";
  if (status === "learning") return "학습 중";
  if (status === "smooth") return "순조로움";
  return "완료";
}

function cardStatusLabel(status: ExecutionCard["status"]) {
  if (status === "draft") return "임시 저장";
  if (status === "review") return "검토 중";
  return "배포됨";
}

function useDemoSnapshot(preferredCardId?: string) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [error, setError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);

  async function refreshSnapshot(nextPreferredCardId = preferredCardId) {
    setRequestState("loading");
    const data = await loadTeacherSnapshot(nextPreferredCardId);
    setSnapshot(data);
    setError("");
    setHasLoaded(true);
    setRequestState("idle");
    return data;
  }

  useEffect(() => {
    let alive = true;
    setRequestState("loading");
    loadTeacherSnapshot(preferredCardId)
      .then((data) => {
        if (!alive) return;
        setSnapshot(data);
        setError("");
        setHasLoaded(true);
        setRequestState("idle");
      })
      .catch((reason: Error) => {
        if (!alive) return;
        setError(`초기 데이터 요청 실패: ${reason.message}`);
        setRequestState("error");
      });
    return () => {
      alive = false;
    };
  }, [preferredCardId]);

  return { snapshot, setSnapshot, requestState, error, setError, setRequestState, hasLoaded, refreshSnapshot };
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <div className="dhg-alert" role="alert">
      <strong>API 오류</strong>
      <span>{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          다시 시도
        </button>
      ) : null}
    </div>
  );
}

function LoadingStrip({ active }: { active: boolean }) {
  return active ? (
    <div className="dhg-loading" aria-live="polite">
      <span />
      데이터를 불러오는 중입니다.
    </div>
  ) : null;
}

function Brand() {
  return (
    <div className="dhg-brand" aria-label="다음한걸음">
      <span className="dhg-footmark">
        <Image src="/assets/generated/logo-mark.png" alt="" width={38} height={38} priority />
      </span>
      <strong>다음한걸음</strong>
    </div>
  );
}

function TeacherHeader({ snapshot, onOpenSetup }: { snapshot: DemoSnapshot; onOpenSetup: () => void }) {
  return (
    <header className="dhg-topbar">
      <button className="dhg-select" type="button" aria-label="학교 선택" onClick={onOpenSetup}>
        <School size={18} aria-hidden="true" />
        <span>{snapshot.school}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <button className="dhg-select" type="button" aria-label="학급 선택" onClick={onOpenSetup}>
        <Users size={18} aria-hidden="true" />
        <span>{snapshot.className}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <button className="dhg-date" type="button" aria-label="날짜 선택">
        <ChevronLeft size={18} aria-hidden="true" />
        <span>
          <CalendarDays size={18} aria-hidden="true" />
          {snapshot.dateLabel}
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      <label className="dhg-search">
        <Search size={18} aria-hidden="true" />
        <input placeholder="학생 또는 과제 검색" />
      </label>
      <button className="dhg-icon-button" type="button" aria-label="알림">
        <Bell size={21} aria-hidden="true" />
      </button>
      <button className="dhg-profile" type="button">
        <span>👩🏻</span>
        <span>{snapshot.teacherName}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
    </header>
  );
}

function TeacherSidebar({ activeView, setActiveView }: { activeView: TeacherView; setActiveView: (view: TeacherView) => void }) {
  const items: Array<{ id: TeacherView; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = [
    { id: "dashboard", label: "대시보드", icon: LayoutDashboard },
    { id: "prep", label: "수업 준비", icon: GraduationCap },
    { id: "cards", label: "실행카드", icon: ClipboardList },
    { id: "reports", label: "학생 리포트", icon: BarChart3 },
  ];

  return (
    <aside className="dhg-sidebar">
      <Brand />
      <nav aria-label="선생님 메뉴">
        {items.map((item) => {
          const Icon = item.icon;
          return (
          <button
            key={item.id}
            type="button"
            className={activeView === item.id ? "is-active" : ""}
            onClick={() => setActiveView(item.id)}
          >
            <span>
              <Icon size={21} strokeWidth={2.4} />
            </span>
            {item.label}
          </button>
          );
        })}
      </nav>
      <div className="dhg-chat-card">
        <Image src="/assets/generated/help-robot.png" alt="" width={76} height={76} />
        <p>도움이 필요하신가요?</p>
        <span>다음한걸음 AI 챗봇이 도와드릴게요.</span>
        <button type="button">채팅하기</button>
      </div>
    </aside>
  );
}

function TeacherSetupPanel({
  snapshot,
  refreshSnapshot,
}: {
  snapshot: DemoSnapshot;
  refreshSnapshot: () => Promise<DemoSnapshot>;
}) {
  const [schoolQuery, setSchoolQuery] = useState("");
  const [schoolRows, setSchoolRows] = useState<ApiNeisSchool[]>([]);
  const [setupMessage, setSetupMessage] = useState("");
  const [setupError, setSetupError] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [grade, setGrade] = useState(snapshot.classGrade || "4");
  const [classNo, setClassNo] = useState(snapshot.classNo || "1");
  const [studentName, setStudentName] = useState("");
  const [studentProfile, setStudentProfile] = useState("긴 문장 이해 어려움");

  useEffect(() => {
    setGrade(snapshot.classGrade || "4");
    setClassNo(snapshot.classNo || "1");
  }, [snapshot.classGrade, snapshot.classNo]);

  const profilePresets: Record<string, SupportOptionKey[]> = {
    "긴 문장 이해 어려움": ["easy_language", "help_sentence"],
    "순서 기억 어려움": ["step_breakdown", "repeat_check"],
    "시각 단서 필요": ["visual_hint", "life_example"],
    "반복 확인 필요": ["repeat_check", "easy_language"],
    "도움 요청 어려움": ["help_sentence", "step_breakdown"],
  };

  async function searchSchool() {
    if (!schoolQuery.trim()) {
      setSetupError("학교명을 입력해 주세요.");
      return;
    }
    setIsWorking(true);
    setSetupError("");
    setSetupMessage("");
    try {
      const result = await requestJson<{ rows: ApiNeisSchool[] }>(
        `/api/neis/schools/search?keyword=${encodeURIComponent(schoolQuery.trim())}&schoolKind=${encodeURIComponent("초등학교")}&pageSize=8`,
      );
      setSchoolRows(result.rows ?? []);
      setSetupMessage(result.rows?.length ? "NEIS 학교 검색 결과를 확인해 주세요." : "검색 결과가 없습니다. 학교명을 다시 확인해 주세요.");
    } catch (reason) {
      setSchoolRows([]);
      setSetupError(`NEIS 학교 검색 실패: ${(reason as Error).message}`);
    } finally {
      setIsWorking(false);
    }
  }

  async function connectSchool(row: ApiNeisSchool) {
    setIsWorking(true);
    setSetupError("");
    try {
      await requestJson<ApiClassroomContext>("/api/classroom/context", {
        method: "PATCH",
        body: JSON.stringify({
          school: {
            schoolName: row.SCHUL_NM,
            schoolCode: row.SD_SCHUL_CODE,
            officeCode: row.ATPT_OFCDC_SC_CODE,
            address: row.ORG_RDNMA ?? row.LCTN_SC_NM ?? "",
            schoolLevel: row.SCHUL_KND_SC_NM,
            source: "NEIS",
          },
          classroom: { grade, classNo },
        }),
      });
      await refreshSnapshot();
      setSchoolRows([]);
      setSetupMessage(`${row.SCHUL_NM} ${grade}학년 ${classNo}반으로 연결했습니다.`);
    } catch (reason) {
      setSetupError(`학교/학급 저장 실패: ${(reason as Error).message}`);
    } finally {
      setIsWorking(false);
    }
  }

  async function saveClassroomOnly() {
    setIsWorking(true);
    setSetupError("");
    try {
      await requestJson<ApiClassroomContext>("/api/classroom/context", {
        method: "PATCH",
        body: JSON.stringify({ classroom: { grade, classNo } }),
      });
      await refreshSnapshot();
      setSetupMessage(`${grade}학년 ${classNo}반으로 학급을 저장했습니다.`);
    } catch (reason) {
      setSetupError(`학급 저장 실패: ${(reason as Error).message}`);
    } finally {
      setIsWorking(false);
    }
  }

  async function addStudent() {
    if (!studentName.trim()) {
      setSetupError("등록할 학생 이름 또는 별칭을 입력해 주세요.");
      return;
    }
    setIsWorking(true);
    setSetupError("");
    try {
      await requestJson<{ student: ApiStudent }>("/api/students", {
        method: "POST",
        body: JSON.stringify({
          nickname: studentName.trim(),
          classroomId: snapshot.classroomId,
          profile: studentProfile,
          supportOptions: profilePresets[studentProfile],
        }),
      });
      setStudentName("");
      await refreshSnapshot();
      setSetupMessage(`${studentName.trim()} 학생을 등록했습니다.`);
    } catch (reason) {
      setSetupError(`학생 등록 실패: ${(reason as Error).message}`);
    } finally {
      setIsWorking(false);
    }
  }

  const schoolConnected = Boolean(snapshot.schoolCode && snapshot.officeCode && snapshot.schoolSource === "NEIS");

  return (
    <section className="dhg-panel dhg-setup-panel">
      <div className="dhg-panel-head">
        <h2>시연 시작 설정</h2>
        <span className={schoolConnected ? "dhg-setup-ok" : "dhg-setup-warn"}>
          {schoolConnected ? "NEIS 학교 연결됨" : "학교 연결 필요"}
        </span>
      </div>
      <div className="dhg-setup-grid">
        <div>
          <strong>1. 학교/학급 연결</strong>
          <p>
            현재: {snapshot.school} · {snapshot.className}
            {snapshot.schoolSource === "NEIS" ? " · NEIS" : " · 시연 설정"}
          </p>
          <div className="dhg-inline-form">
            <input value={schoolQuery} onChange={(event) => setSchoolQuery(event.target.value)} placeholder="NEIS 학교명 검색" />
            <select value={grade} onChange={(event) => setGrade(event.target.value)}>
              <option value="1">1학년</option>
              <option value="2">2학년</option>
              <option value="3">3학년</option>
              <option value="4">4학년</option>
              <option value="5">5학년</option>
              <option value="6">6학년</option>
            </select>
            <select value={classNo} onChange={(event) => setClassNo(event.target.value)}>
              {["1", "2", "3", "4", "5", "6"].map((value) => (
                <option key={value} value={value}>{value}반</option>
              ))}
            </select>
            <button type="button" disabled={isWorking} onClick={searchSchool}>검색</button>
            <button type="button" disabled={isWorking} onClick={saveClassroomOnly}>학급만 저장</button>
          </div>
          {schoolRows.length ? (
            <div className="dhg-school-results">
              {schoolRows.map((row) => (
                <button key={`${row.ATPT_OFCDC_SC_CODE}-${row.SD_SCHUL_CODE}`} type="button" onClick={() => connectSchool(row)}>
                  <strong>{row.SCHUL_NM}</strong>
                  <small>{row.ATPT_OFCDC_SC_NM} · {row.ORG_RDNMA ?? row.LCTN_SC_NM ?? "주소 정보 없음"}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <strong>2. 학생 등록</strong>
          <p>현재 등록 학생 {snapshot.students.length}명. 학생별 지원 프로필로 과제 화면과 리포트가 나뉩니다.</p>
          <div className="dhg-inline-form">
            <input value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="학생 이름 또는 별칭" />
            <select value={studentProfile} onChange={(event) => setStudentProfile(event.target.value)}>
              {Object.keys(profilePresets).map((profile) => (
                <option key={profile}>{profile}</option>
              ))}
            </select>
            <button type="button" disabled={isWorking} onClick={addStudent}>학생 등록</button>
          </div>
          <div className="dhg-registered-students">
            {snapshot.students.map((student) => (
              <span key={student.id}>{student.name}</span>
            ))}
          </div>
        </div>
      </div>
      {setupMessage ? <p className="dhg-setup-message">{setupMessage}</p> : null}
      {setupError ? <p className="dhg-setup-error">{setupError}</p> : null}
    </section>
  );
}

function TeacherDashboard({
  snapshot,
  setActiveView,
  refreshSnapshot,
}: {
  snapshot: DemoSnapshot;
  setActiveView: (view: TeacherView) => void;
  refreshSnapshot: () => Promise<DemoSnapshot>;
}) {
  const blockedCount = snapshot.students.filter((student) => student.status === "blocked").length;
  const todayLessonCount = snapshot.cards.length;
  const publishedTaskCount = snapshot.cards.filter((card) => card.status === "deployed").length;
  const activeCard = snapshot.cards.find((card) => card.id === snapshot.activeCardId) ?? snapshot.cards[0];
  const reportCount = activeCard ? snapshot.students.filter((student) => student.progress > 0 || student.status === "blocked").length : 0;
  const blockedStudent = snapshot.students.find((student) => student.status === "blocked") ?? snapshot.students[0];
  const timetableRows = snapshot.cards.slice(0, 3).map((card, index) => [
    `${index + 1}교시`,
    card.subject,
    card.status === "deployed" ? "진행 예정" : card.status === "review" ? "검토 중" : "준비 중",
    `${String(9 + index).padStart(2, "0")}:00 ~ ${String(9 + index).padStart(2, "0")}:40`,
  ]);

  return (
    <section className="dhg-teacher-page">
      <div className="dhg-page-title">
        <h1>오늘의 수업 준비</h1>
        <p>오늘도 아이들의 성장을 응원합니다. 차분하게 한 걸음씩 준비해 보세요.</p>
      </div>

      <TeacherSetupPanel snapshot={snapshot} refreshSnapshot={refreshSnapshot} />

      <div className="dhg-stat-grid">
        {[
          ["▣", "오늘 수업", `${todayLessonCount}개`, "시간표를 확인해 보세요", "prep"],
          ["✓", "실행 중 과제", `${publishedTaskCount}개`, "학생 과제 현황 보기", "cards"],
          ["♙", "도움이 필요한 학생", `${blockedCount}명`, "지원이 필요한 학생 보기", "reports"],
          ["▤", "이번 주 리포트", `${reportCount}개`, "리포트 확인하기", "reports"],
        ].map(([icon, label, value, hint, target]) => (
          <button key={label} className="dhg-stat-card" type="button" onClick={() => setActiveView(target as TeacherView)}>
            <span>{icon}</span>
            <div>
              <p>{label}</p>
              <strong>{value}</strong>
              <small>{hint}</small>
            </div>
            <b>›</b>
          </button>
        ))}
      </div>

      <div className="dhg-dashboard-grid">
        <div className="dhg-panel">
          <div className="dhg-panel-head">
            <h2>오늘 시간표</h2>
            <button type="button" onClick={() => setActiveView("prep")}>
              전체 시간표 보기 ›
            </button>
          </div>
          <div className="dhg-timetable">
            {timetableRows.length ? timetableRows.map((row) => (
              <div key={row[0]}>
                <span>{row[0]}</span>
                <strong>{row[1]}</strong>
                <em>{row[2]}</em>
                <time>{row[3]}</time>
              </div>
            )) : (
              <div>
                <span>-</span>
                <strong>아직 준비된 수업 없음</strong>
                <em>수업 준비에서 생성</em>
                <time>대기</time>
              </div>
            )}
          </div>
        </div>

        <div className="dhg-panel dhg-next-lesson">
          <div className="dhg-panel-head">
            <h2>다음 수업 입력</h2>
          </div>
          <p className="dhg-panel-copy">
            수업 준비 화면에서 과목, 주제, 성취기준, 과제 지시문, 학생 지원 옵션을 입력하면 실행카드가 생성됩니다.
          </p>
          <button className="dhg-primary" type="button" onClick={() => setActiveView("prep")}>
            수업 준비로 이동
          </button>
          <div className="dhg-mini-preview" aria-label="실행카드 미리보기">
            <span>{activeCard?.subject ?? "과목"} · {activeCard?.grade ?? "학년"}</span>
            <strong>{snapshot.lessonTopic}</strong>
            <small>{activeCard?.topic ?? "수업 주제를 입력하세요"}</small>
          </div>
        </div>

        <div className="dhg-panel">
          <div className="dhg-panel-head">
            <h2>학생 진행 현황</h2>
            <button type="button" onClick={() => setActiveView("reports")}>
              전체 보기
            </button>
          </div>
          <div className="dhg-progress-table">
            {snapshot.students.map((student) => (
              <button key={student.id} type="button">
                <span>{student.avatar}</span>
                <strong>{student.name}</strong>
                <small>{student.task}</small>
                <meter min="0" max="100" value={student.progress} />
                <em className={`tone-${student.status}`}>{statusLabel(student.status)}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="dhg-panel dhg-ai-panel">
          <div className="dhg-panel-head">
            <h2>AI 추천</h2>
            <button type="button" onClick={() => setActiveView("reports")}>
              리포트에서 보기 ›
            </button>
          </div>
          {(activeCard ? [
            ["개념 다시 보기", `${activeCard.title}에서 어려웠던 핵심 개념을 짧게 다시 확인해요.`, "보기"],
            ["단계별 연습 제공", `${blockedStudent?.blockedStep ?? "막힌 단계"}에서 멈춘 학생에게 맞춤 연습을 추천해요.`, "문제 보기"],
            ["짧은 피드백 보내기", `${blockedStudent?.name ?? "학생"}에게 격려와 힌트를 담은 피드백을 보내보세요.`, "보내기"],
          ] : [
            ["수업 준비 시작", "아직 배포된 과제가 없습니다. 먼저 수업 준비에서 실행카드를 만들고 학생에게 배포해 주세요.", "만들기"],
          ]).map(([title, body, action]) => (
            <article key={title} className="dhg-reco-row">
              <span>✦</span>
              <div>
                <strong>{title}</strong>
                <p>{body}</p>
              </div>
              <button type="button" onClick={() => setActiveView(action === "보내기" ? "reports" : "prep")}>
                {action}
              </button>
            </article>
          ))}
        </div>

        <div className="dhg-panel dhg-recent-cards">
          <div className="dhg-panel-head">
            <h2>최근 생성한 실행카드</h2>
            <button type="button" onClick={() => setActiveView("cards")}>
              전체 보기
            </button>
          </div>
          <div>
            {snapshot.cards.length ? snapshot.cards.map((card) => (
              <button key={card.id} type="button" onClick={() => setActiveView("cards")}>
                <span>{card.subject}</span>
                <strong>{card.title}</strong>
                <small>{card.date}</small>
                <em>{cardStatusLabel(card.status)}</em>
              </button>
            )) : <p className="dhg-muted-empty">아직 생성된 실행카드가 없습니다.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function TeacherPrep({
  snapshot,
  onGenerate,
  isSaving,
}: {
  snapshot: DemoSnapshot;
  onGenerate: (payload: LessonPrepPayload) => void;
  isSaving: boolean;
}) {
  const [topic, setTopic] = useState(snapshot.lessonTopic);
  const [subject, setSubject] = useState(snapshot.cards[0]?.subject || "수학");
  const [grade, setGrade] = useState(snapshot.cards[0]?.grade.replace(/^초/, "") || "4");
  const [classNo, setClassNo] = useState(snapshot.className.match(/(\d+)반/)?.[1] ?? "2");
  const [lessonDate, setLessonDate] = useState(normalizeLessonDateForInput(snapshot.dateLabel));
  const [lessonContent, setLessonContent] = useState("");
  const [assignmentInstruction, setAssignmentInstruction] = useState("");
  const [standards, setStandards] = useState<ApiStandardSearchResult[]>([]);
  const [selectedStandard, setSelectedStandard] = useState<ApiStandardSearchResult | null>(null);
  const [supportOptions, setSupportOptions] = useState<SupportOptionKey[]>([
    "easy_language",
    "step_breakdown",
    "visual_hint",
    "repeat_check",
    "help_sentence",
  ]);
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  useEffect(() => {
    if (!topic.trim()) return;
    const controller = new AbortController();
    requestJson<{ results: ApiStandardSearchResult[] }>(
      `/api/standards/search?q=${encodeURIComponent(`${subject} ${grade} ${topic}`)}&subject=${encodeURIComponent(subject)}&gradeBand=${encodeURIComponent(`초${grade}`)}&limit=3`,
      { signal: controller.signal },
    )
      .then((data) => {
        setStandards(data.results);
        setSelectedStandard((current) => current ?? data.results[0] ?? null);
      })
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setStandards([]);
      });
    return () => controller.abort();
  }, [grade, subject, topic]);

  function toggleOption(option: SupportOptionKey) {
    setSupportOptions((current) => (current.includes(option) ? current.filter((item) => item !== option) : [...current, option]));
  }

  return (
    <section className="dhg-teacher-page">
      <div className="dhg-page-title">
        <h1>수업 준비</h1>
        <p>학생이 잘 이해하고 참여할 수 있도록, 다음 수업을 준비해보세요.</p>
      </div>
      <div className="dhg-two-column">
        <form
          className="dhg-panel dhg-prep-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedStandard) return;
            onGenerate({
              schoolId: snapshot.schoolId,
              classroomId: snapshot.classroomId,
              grade,
              classNo,
              subject,
              lessonDate,
              topic,
              lessonContent,
              assignmentInstruction,
              selectedStandardId: selectedStandard.citations[0]?.standardId ?? selectedStandard.id,
              selectedStandardCode: standardCode(selectedStandard),
              selectedStandardText: selectedStandard.summary,
              selectedStandardSourceType: selectedStandard.sourceType,
              selectedStandardSourceName: selectedStandard.sourceName ?? selectedStandard.citations[0]?.source,
              selectedStandardSourceUrl: standardSourceUrl(selectedStandard),
              selectedStandardLicense: selectedStandard.license,
              supportOptions,
            });
          }}
        >
          <div className="dhg-panel-head">
            <h2>다음 수업 지원 콘텐츠 만들기</h2>
          </div>
          <div className="dhg-form-grid">
            {[
              ["학교", snapshot.school],
            ].map(([label, value]) => (
              <label key={label}>
                {label}
                <select defaultValue={value}>
                  <option>{value}</option>
                </select>
              </label>
            ))}
            <label>
              학년
              <select value={grade} onChange={(event) => setGrade(event.target.value)}>
                <option value="3">3학년</option>
                <option value="4">4학년</option>
                <option value="5">5학년</option>
              </select>
            </label>
            <label>
              반
              <select value={classNo} onChange={(event) => setClassNo(event.target.value)}>
                <option value="1">1반</option>
                <option value="2">2반</option>
                <option value="3">3반</option>
              </select>
            </label>
            <label>
              과목
              <select value={subject} onChange={(event) => setSubject(event.target.value)}>
                <option>수학</option>
                <option>국어</option>
                <option>과학</option>
              </select>
            </label>
            <label>
              수업일
              <input value={lessonDate} onChange={(event) => setLessonDate(event.target.value)} />
            </label>
            <label className="span-3">
              주제
              <input value={topic} onChange={(event) => setTopic(event.target.value)} />
            </label>
          </div>
          <label className="dhg-field">
            성취기준 검색/선택
            <div className="dhg-search-field">
              <input placeholder="성취기준을 검색해보세요. (예: 직사각형, 둘레)" />
              <span>⌕</span>
            </div>
          </label>
          {selectedStandard ? (
            <button className="dhg-selected-standard" type="button" onClick={() => setSelectedStandard(null)}>
              <span className="dhg-standard-meta-row">
                <b>{standardCode(selectedStandard)}</b>
                <strong className={sourceTypeClassName(selectedStandard.sourceType)}>{sourceTypeLabel(selectedStandard.sourceType)}</strong>
                <small>{selectedStandard.sourceName ?? selectedStandard.citations[0]?.source ?? "출처 미확인"}</small>
              </span>
              <span>{selectedStandard.summary} ×</span>
            </button>
          ) : null}
          <label className="dhg-field">
            수업 내용 입력
            <textarea value={lessonContent} onChange={(event) => setLessonContent(event.target.value)} placeholder="학생에게 다룰 수업 내용을 입력하세요." />
          </label>
          <label className="dhg-field">
            과제 지시문 입력
            <textarea value={assignmentInstruction} onChange={(event) => setAssignmentInstruction(event.target.value)} placeholder="학생이 수행할 과제 지시문을 입력하세요." />
          </label>
          <div className="dhg-option-grid" role="group" aria-label="학생 지원 옵션">
            {SUPPORT_OPTION_KEYS.map((option) => (
              <button
                key={option}
                type="button"
                className={supportOptions.includes(option) ? "is-selected" : ""}
                onClick={() => toggleOption(option)}
              >
                <span>{supportOptions.includes(option) ? "✓" : "+"}</span>
                {SUPPORT_OPTION_LABELS[option]}
              </button>
            ))}
          </div>
          <div className="dhg-action-row">
            <button
              className="dhg-secondary"
              type="button"
              onClick={() => {
                setIsDraftSaved(true);
                copyTextToClipboard(`수업 주제: ${topic}\n성취기준: ${selectedStandard?.summary ?? ""}\n지원 옵션: ${supportOptionLabels(supportOptions).join(", ")}`);
              }}
            >
              {isDraftSaved ? "임시 저장됨" : "임시 저장"}
            </button>
            <button className="dhg-primary" type="submit" disabled={isSaving || !topic.trim() || !lessonContent.trim() || !assignmentInstruction.trim() || !selectedStandard}>
              {isSaving ? "생성 중..." : "실행카드 생성"}
            </button>
          </div>
        </form>

        <aside className="dhg-side-stack">
          <div className="dhg-panel">
            <div className="dhg-panel-head">
              <h2>추천 성취기준</h2>
              <button type="button" onClick={() => setSelectedStandard(standards[0] ?? null)}>
                새로고침
              </button>
            </div>
            {standards.map((standard) => (
              <div
                key={standard.id}
                className="dhg-standard-card"
                role="button"
                tabIndex={0}
                onClick={() => setSelectedStandard(standard)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedStandard(standard);
                  }
                }}
              >
                <div className="dhg-standard-meta-row">
                  <span>{standardCode(standard)}</span>
                  <strong className={sourceTypeClassName(standard.sourceType)}>{sourceTypeLabel(standard.sourceType)}</strong>
                  <em>{typeof standard.score === "number" ? `유사도 ${standard.score}` : "검색 결과"}</em>
                </div>
                <p>{standard.summary}</p>
                <div className="dhg-source-row">
                  <small>{standard.sourceName ?? standard.citations[0]?.source ?? "출처 미확인"}</small>
                  {standardSourceUrl(standard) ? (
                    <a href={standardSourceUrl(standard)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                      출처
                    </a>
                  ) : null}
                </div>
                {standard.license ? <small className="dhg-license-note">{standard.license}</small> : null}
              </div>
            ))}
          </div>
          <div className="dhg-panel dhg-student-preview-card">
            <div className="dhg-panel-head">
              <h2>수업 전 미리보기</h2>
              <button type="button" onClick={() => setPreviewExpanded((current) => !current)}>
                {previewExpanded ? "간단히 보기" : "자세히 보기"}
              </button>
            </div>
            <span>{subject}</span>
            <h3>{topic || "수업 주제"}</h3>
            <div className="dhg-keyword-row">
              {(selectedStandard?.summary.match(/[가-힣A-Za-z0-9]+/g)?.slice(0, 5) ?? [subject, `초${grade}`, topic]).map((word) => (
                <b key={word}>{word}</b>
              ))}
            </div>
            <ul>
              <li>{selectedStandard?.summary ?? "성취기준을 선택해요."}</li>
              <li>{lessonContent || "수업 내용을 입력해요."}</li>
              <li>{assignmentInstruction || "과제 지시문을 입력해요."}</li>
              {previewExpanded ? (
                <>
                  <li>선택한 성취기준과 과제 지시문을 기준으로 단계가 나뉩니다.</li>
                  <li>지원 옵션: {supportOptionLabels(supportOptions).join(", ")}</li>
                </>
              ) : null}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

function TeacherCards({
  snapshot,
  setSnapshot,
  onPersist,
  onRegenerate,
  isSaving,
}: {
  snapshot: DemoSnapshot;
  setSnapshot: React.Dispatch<React.SetStateAction<DemoSnapshot>>;
  onPersist: (kind: "save" | "deploy") => void;
  onRegenerate: () => void;
  isSaving: boolean;
}) {
  const card = snapshot.cards.find((item) => item.id === snapshot.activeCardId);
  const steps = card?.steps ?? [];

  if (!card) {
    return (
      <section className="dhg-teacher-page dhg-card-editor-page">
        <div className="dhg-empty">
          <strong>실행카드를 찾을 수 없습니다.</strong>
          <p>URL의 cardId에 해당하는 카드가 DB에 있는지 확인해 주세요.</p>
        </div>
      </section>
    );
  }
  const activeCard = card;

  function updateStep(stepId: string, field: keyof LessonStep, value: string) {
    setSnapshot((current) => ({
      ...current,
      cards: current.cards.map((item) =>
        item.id === activeCard.id
          ? {
              ...item,
              steps: steps.map((step) => (step.id === stepId ? { ...step, [field]: value } : step)),
            }
          : item,
      ),
    }));
  }

  function deleteStep(stepId: string) {
    setSnapshot((current) => ({
      ...current,
      cards: current.cards.map((item) =>
        item.id === activeCard.id ? { ...item, steps: steps.filter((step) => step.id !== stepId) } : item,
      ),
    }));
  }

  function moveStep(stepId: string) {
    const index = steps.findIndex((step) => step.id === stepId);
    if (index < 0 || steps.length < 2) return;
    const targetIndex = index === steps.length - 1 ? index - 1 : index + 1;
    const reordered = [...steps];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setSnapshot((current) => ({
      ...current,
      cards: current.cards.map((item) => (item.id === activeCard.id ? { ...item, steps: reordered } : item)),
    }));
  }

  function addStep() {
    const next: LessonStep = {
      id: `step-${Date.now()}`,
      title: "새 단계 내용을 입력해요.",
      visualHint: { type: "text_only", data: { text: "새 단계 시각 단서를 입력하세요." } },
      checkQuestion: "학생에게 확인할 질문을 입력하세요.",
      choices: ["확인했어요", "다시 볼래요"],
      answer: "확인했어요",
      helpSentence: "도움 요청 시 보여줄 문장을 입력하세요.",
      teacherTip: "교사용 지도 팁을 입력하세요.",
    };
    setSnapshot((current) => ({
      ...current,
      cards: current.cards.map((item) => (item.id === activeCard.id ? { ...item, steps: [...steps, next] } : item)),
    }));
  }

  return (
    <section className="dhg-teacher-page dhg-card-editor-page">
      <div className="dhg-page-title">
        <p>실행카드 목록 › 실행카드 편집</p>
        <h1>실행카드 편집</h1>
      </div>
      <div className="dhg-editor-grid">
        <div className="dhg-editor-main">
          <section className="dhg-panel dhg-original-prompt">
            <div className="dhg-panel-head">
              <h2>원문 지시문</h2>
              <button
                type="button"
                onClick={() =>
                  copyTextToClipboard(
                    `${card.subject} ${card.grade} ${card.title}\n목표: ${card.goal}\n쉬운 설명: ${card.easyExplanation}`,
                  )
                }
              >
                복사
              </button>
            </div>
            <p>
              <span>{card.subject}</span> <span>{card.grade}</span> {card.title}
            </p>
            <div className="dhg-standard-meta-row">
              {card.standard.code ? <span>{card.standard.code}</span> : null}
              <strong className={sourceTypeClassName(card.standard.sourceType as ApiStandardSearchResult["sourceType"] | undefined)}>
                {sourceTypeLabel(card.standard.sourceType)}
              </strong>
              <small>{card.standard.sourceName ?? "출처 미확인"}</small>
            </div>
            <h3>{card.goal}</h3>
            <small>{card.easyExplanation}</small>
          </section>
          <section className="dhg-editor-steps">
            <div className="dhg-panel-head">
              <h2>AI 생성 결과</h2>
              <div className="dhg-quality-pills">
                {supportOptionLabels(activeCard.supportOptions).slice(0, 3).map((label) => (
                  <span key={label}>{label} ✓</span>
                ))}
              </div>
            </div>
            {steps.map((step, index) => (
              <article key={step.id} className="dhg-step-card">
                <div className="dhg-step-index">{index + 1}</div>
                <label>
                  단계 제목
                  <input value={step.title} onChange={(event) => updateStep(step.id, "title", event.target.value)} />
                </label>
                <label>
                  확인 질문
                  <input value={step.checkQuestion} onChange={(event) => updateStep(step.id, "checkQuestion", event.target.value)} />
                </label>
                <label>
                  도움 요청 문장
                  <input value={step.helpSentence} onChange={(event) => updateStep(step.id, "helpSentence", event.target.value)} />
                </label>
                <label>
                  교사용 팁
                  <input value={step.teacherTip} onChange={(event) => updateStep(step.id, "teacherTip", event.target.value)} />
                </label>
                <div className="dhg-step-actions">
                  <button type="button" onClick={() => moveStep(step.id)}>
                    순서 변경
                  </button>
                  <button type="button" onClick={() => deleteStep(step.id)}>
                    삭제
                  </button>
                </div>
              </article>
            ))}
            <button className="dhg-add-step" type="button" onClick={addStep}>
              + 단계 추가
            </button>
          </section>
        </div>
        <aside className="dhg-panel dhg-phone-preview-panel">
          <div className="dhg-panel-head">
            <h2>학생 화면 미리보기</h2>
            <button type="button" onClick={() => setSnapshot((current) => ({ ...current }))}>
              새로고침
            </button>
          </div>
          <StudentPhonePreview card={card} step={steps[1] ?? steps[0]} />
        </aside>
      </div>
      <div className="dhg-bottom-actions">
        <button className="dhg-secondary" type="button" disabled={isSaving} onClick={onRegenerate}>
          다시 생성
        </button>
        <button className="dhg-secondary blue" type="button" disabled={isSaving} onClick={() => onPersist("save")}>
          {isSaving ? "저장 중..." : "저장"}
        </button>
        <button className="dhg-primary blue" type="button" disabled={isSaving} onClick={() => onPersist("deploy")}>
          학생에게 배포
        </button>
      </div>
    </section>
  );
}

function TeacherReports({ snapshot, setActiveView, studentId }: { snapshot: DemoSnapshot; setActiveView: (view: TeacherView) => void; studentId?: string }) {
  const [showTable, setShowTable] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(studentId ?? snapshot.students[0]?.id ?? "");
  const selected = snapshot.students.find((student) => student.id === selectedStudentId) ?? snapshot.students[0];
  const activeCard = snapshot.cards.find((card) => card.id === snapshot.activeCardId) ?? snapshot.cards[0];
  const [reportData, setReportData] = useState<ApiStudentReportResult | null>(null);
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    if (studentId) setSelectedStudentId(studentId);
  }, [studentId]);

  useEffect(() => {
    if (!selected?.id || !activeCard?.id) return;
    let alive = true;
    setReportError("");
    requestJson<ApiStudentReportResult>(
      `/api/reports/students/${encodeURIComponent(selected.id)}?cardId=${encodeURIComponent(activeCard.id)}`,
    )
      .then((data) => {
        if (!alive) return;
        setReportData(data);
      })
      .catch((reason: Error) => {
        if (!alive) return;
        setReportError(`리포트 API 요청 실패: ${reason.message}`);
        setReportData(null);
      });
    return () => {
      alive = false;
    };
  }, [activeCard?.id, selected?.id]);

  const summary = reportData?.summary;
  const stages = reportData?.perStep ?? [];
  const completedStepCount = stages.filter((stage) => stage.isCompleted).length;
  const averageSeconds = completedStepCount ? Math.round((summary?.totalTimeSeconds ?? 0) / completedStepCount) : 0;
  const parentMemo = reportData?.report.parentMemo ?? "아직 저장된 수행 로그가 없어 보호자 공유 메모를 생성하지 못했습니다.";
  const stats = [
    ["✓", "완료율", `${summary?.completionRate ?? 0}%`, "학생 로그 기반"],
    ["◷", "평균 소요 시간", formatDuration(averageSeconds), "단계 시작/완료 로그 기반"],
    ["♙", "도움 요청 횟수", `${summary?.helpRequestCount ?? 0}회`, "모르겠어요/쉬운 설명/도움 문장"],
    ["!", "막힌 단계 수", `${summary?.stuckStepCount ?? 0}개`, "도움 요청 또는 오답 기준"],
  ];
  const recommendations = reportData?.report.aiRecommendationsJson ?? [];

  function downloadReport() {
    const content = [
      `학생 리포트 - ${selected.name}`,
      `과제: ${activeCard?.title ?? "선택된 과제 없음"}`,
      `완료율: ${summary?.completionRate ?? 0}%`,
      `도움 요청 횟수: ${summary?.helpRequestCount ?? 0}회`,
      `막힌 단계 수: ${summary?.stuckStepCount ?? 0}개`,
      "",
      parentMemo,
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected.name}-report.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="dhg-teacher-page">
      <div className="dhg-page-title dhg-title-row">
        <div>
          <h1>학생 리포트</h1>
          <p>학생의 학습 수행 데이터를 분석하여 맞춤 지원 전략을 확인해 보세요.</p>
        </div>
        <button className="dhg-secondary" type="button" onClick={downloadReport}>
          리포트 다운로드
        </button>
      </div>
      <div className="dhg-student-select">
        <span>{selected.avatar}</span>
        <strong>{selected.name}</strong>
        <small>{snapshot.className}</small>
        <div>
          {snapshot.students.map((student) => (
            <button
              key={student.id}
              className={student.id === selected.id ? "is-active" : ""}
              type="button"
              onClick={() => setSelectedStudentId(student.id)}
            >
              {student.name}
            </button>
          ))}
        </div>
      </div>
      <ErrorBanner message={reportError} />
      <div className="dhg-report-stats">
        {stats.map(([icon, label, value, diff]) => (
          <article key={label} className="dhg-stat-card">
            <span>{icon}</span>
            <div>
              <p>{label}</p>
              <strong>{value}</strong>
              <small>{diff}</small>
            </div>
          </article>
        ))}
      </div>
      <div className="dhg-two-column reports">
        <div className="dhg-side-stack">
          <section className="dhg-panel">
            <div className="dhg-panel-head">
              <h2>단계별 수행 흐름</h2>
              <button type="button" onClick={() => setShowTable((current) => !current)}>
                {showTable ? "차트 보기" : "표 보기"}
              </button>
            </div>
            {showTable ? (
              <div className="dhg-record-table compact">
                {stages.map((stage) => (
                  <button key={stage.step.id} type="button" onClick={() => setActiveView("cards")}>
                    <strong>{stage.step.order}단계</strong>
                    <span>{stage.isCompleted ? "완료" : "미완료"} · 도움 {stage.confusedCount + stage.simplifyCount + (stage.helpSentenceViewedCount ?? 0)}회</span>
                    <em>{formatDuration(stage.timeSeconds)}</em>
                    <b>›</b>
                  </button>
                ))}
              </div>
            ) : (
              <div className="dhg-chart" aria-label="단계별 완료율 차트">
                {stages.map((stage) => {
                  const value = stage.isCompleted ? 100 : stage.quizAnswered || stage.confusedCount || stage.simplifyCount ? 50 : 15;
                  return (
                  <div key={stage.step.id} style={{ "--bar": `${value}%` } as React.CSSProperties}>
                    <span>{formatDuration(stage.timeSeconds)}</span>
                    <b />
                    <em>{stage.step.order}단계</em>
                  </div>
                );})}
              </div>
            )}
            <p className="dhg-info-note">{reportData?.report.summary ?? "학생 수행 로그가 쌓이면 단계별 흐름이 표시됩니다."}</p>
          </section>
          <section className="dhg-panel">
            <div className="dhg-panel-head">
              <h2>최근 과제 수행 기록</h2>
              <button type="button" onClick={() => setActiveView("cards")}>
                전체 과제 보기 ›
              </button>
            </div>
            <div className="dhg-record-table">
              {snapshot.cards.map((card) => {
                const isActive = card.id === activeCard?.id;
                const completion = isActive ? summary?.completionRate ?? 0 : 0;
                const stuckLabel = isActive && stages.find((stage) => !stage.isCompleted || stage.confusedCount || stage.simplifyCount)
                  ? `${stages.find((stage) => !stage.isCompleted || stage.confusedCount || stage.simplifyCount)?.step.order}단계`
                  : card.status === "deployed"
                    ? "로그 대기"
                    : "초안";
                return (
                <button key={card.id} type="button" onClick={() => setActiveView("cards")}>
                  <strong>{card.title}</strong>
                  <span>{card.date}</span>
                  <meter min="0" max="100" value={completion} />
                  <em>{stuckLabel}</em>
                  <b>›</b>
                </button>
              );})}
            </div>
          </section>
        </div>
        <aside className="dhg-side-stack">
          <section className="dhg-panel dhg-ai-panel">
            <div className="dhg-panel-head">
              <h2>AI 추천 지원전략</h2>
            </div>
            {(recommendations.length ? recommendations : ["학생 로그가 쌓이면 맞춤 지원전략이 생성됩니다."]).map((body, index) => (
              <article key={`${body}-${index}`} className="dhg-reco-row numbered">
                <span>{index + 1}</span>
                <div>
                  <strong>{reportData?.report.difficultyTagsJson[index] ?? "지원전략"}</strong>
                  <p>{body}</p>
                </div>
                <button type="button" onClick={() => setActiveView(index === 1 ? "prep" : "reports")}>
                  보기
                </button>
              </article>
            ))}
            <button className="dhg-primary" type="button" onClick={() => setActiveView("prep")}>
              맞춤 활동 카드 만들기
            </button>
          </section>
          <section className="dhg-panel dhg-memo-panel">
            <div className="dhg-panel-head">
              <h2>보호자 공유 메모</h2>
              <button type="button" onClick={() => copyTextToClipboard(parentMemo)}>
                복사
              </button>
            </div>
            <p>{parentMemo}</p>
            <small>생성일: {reportData?.report.createdAt.slice(0, 10) ?? "로그 대기"} · 로그 기반 메모예요.</small>
          </section>
        </aside>
      </div>
    </section>
  );
}

function StudentPhonePreview({ card, step }: { card?: ExecutionCard; step?: LessonStep }) {
  return (
    <div className="dhg-phone-frame compact">
      <div className="dhg-phone-top">
        <Brand />
        <Bell size={20} aria-hidden="true" />
      </div>
      <div className="dhg-phone-progress">
        <span>과제 1/4</span>
        <b />
        <b className="is-active" />
        <b />
        <b />
      </div>
      <section className="dhg-mobile-card">
        <p>
          <span>{card?.subject ?? "과목"}</span>
          <span>{card?.grade ?? "학년"}</span>
        </p>
        <h2>{card?.title ?? "실행카드"}</h2>
      </section>
      <section className="dhg-mobile-task-card">
        <span className="dhg-step-badge">2단계</span>
        <h3>{step?.title ?? "단계를 선택해 주세요."}</h3>
        <VisualHintView hint={step?.visualHint ?? { type: "text_only", data: { text: "시각 단서가 여기에 표시됩니다." } }} />
        <aside>
          <strong>힌트</strong>
          <p>{step?.helpSentence ?? "학생에게 보여줄 힌트가 여기에 표시됩니다."}</p>
        </aside>
        <button type="button">완료했어요</button>
      </section>
    </div>
  );
}

export function TeacherDemoApp({
  initialView = "dashboard",
  initialCardId,
  initialStudentId,
}: {
  initialView?: TeacherView;
  initialCardId?: string;
  initialStudentId?: string;
}) {
  const { snapshot, setSnapshot, requestState, error, setError, setRequestState, hasLoaded, refreshSnapshot } = useDemoSnapshot(initialCardId);
  const [activeView, setActiveView] = useState<TeacherView>(initialView);
  const router = useRouter();

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  function navigateTeacher(view: TeacherView, cardId = snapshot.activeCardId) {
    setActiveView(view);
    router.push(teacherRoute(view, cardId));
  }

  async function createQuickCard(input: LessonPrepPayload | string = snapshot.lessonTopic) {
    setRequestState("saving");
    try {
      const activeCard = snapshot.cards.find((card) => card.id === snapshot.activeCardId) ?? snapshot.cards[0];
      const payload: LessonPrepPayload =
        typeof input === "string"
          ? {
              schoolId: snapshot.schoolId,
              classroomId: snapshot.classroomId,
              grade: activeCard?.grade?.replace(/^초/, "") || "4",
              classNo: snapshot.className.match(/(\d+)반/)?.[1] ?? "2",
              subject: activeCard?.subject || "수학",
              lessonDate: normalizeLessonDateForInput(snapshot.dateLabel),
              topic: input,
              lessonContent: activeCard?.goal || input,
              assignmentInstruction: activeCard?.easyExplanation || input,
              selectedStandardId: activeCard?.standard.id ?? activeCard?.standard.code ?? undefined,
              selectedStandardCode: activeCard?.standard.code ?? undefined,
              selectedStandardText: activeCard?.standard.text,
              selectedStandardSourceType: activeCard?.standard.sourceType ?? undefined,
              selectedStandardSourceName: activeCard?.standard.sourceName ?? undefined,
              selectedStandardSourceUrl: activeCard?.standard.sourceUrl ?? undefined,
              selectedStandardLicense: activeCard?.standard.license ?? undefined,
              supportOptions: ["easy_language", "step_breakdown", "visual_hint"],
            }
          : input;
      const gradeBand = gradeBandFromGrade(payload.grade);
      const lessonResult = await requestJson<{ lesson: ApiLesson }>("/api/lessons", {
        method: "POST",
        body: JSON.stringify({
          teacherId: "teacher_001",
          classroomId: payload.classroomId,
          schoolId: payload.schoolId,
          subject: payload.subject,
          gradeBand,
          topic: payload.topic,
          title: payload.topic,
          lessonDate: payload.lessonDate,
          lessonContent: payload.lessonContent,
          assignmentInstruction: payload.assignmentInstruction,
          selectedStandardId: payload.selectedStandardId,
          selectedStandardText: payload.selectedStandardText,
          selectedStandardSourceType: payload.selectedStandardSourceType,
          selectedStandardSourceName: payload.selectedStandardSourceName,
          selectedStandardSourceUrl: payload.selectedStandardSourceUrl,
          selectedStandardLicense: payload.selectedStandardLicense,
          supportOptions: payload.supportOptions,
          objectives: [payload.selectedStandardText || payload.topic],
        }),
      });
      const saved = await requestJson<{ card: ApiExecutionCard; steps: ApiExecutionStep[] }>("/api/execution-cards/generate", {
        method: "POST",
        body: JSON.stringify({
          lessonId: lessonResult.lesson.id,
          subject: payload.subject,
          grade: gradeBand,
          gradeBand,
          topic: payload.topic,
          title: payload.topic,
          lessonContent: payload.lessonContent,
          assignmentInstruction: payload.assignmentInstruction,
          selectedStandardId: payload.selectedStandardId,
          selectedStandardCode: payload.selectedStandardCode,
          selectedStandardText: payload.selectedStandardText,
          selectedStandardSourceType: payload.selectedStandardSourceType,
          selectedStandardSourceName: payload.selectedStandardSourceName,
          selectedStandardSourceUrl: payload.selectedStandardSourceUrl,
          selectedStandardLicense: payload.selectedStandardLicense,
          supportOptions: payload.supportOptions,
          objectives: [payload.selectedStandardText || payload.topic],
          save: true,
        }),
      });
      const card = mapApiCard(saved.card, lessonResult.lesson, saved.steps);
      setSnapshot((current) => ({
        ...current,
        activeCardId: card.id,
        lessonTopic: payload.topic,
        cards: [card, ...current.cards.filter((item) => item.id !== card.id)],
      }));
      navigateTeacher("cards", card.id);
      setError("");
      setRequestState("idle");
    } catch (reason) {
      setError(`실행카드 생성 요청 실패: ${(reason as Error).message}`);
      setRequestState("error");
    }
  }

  async function persistCard(kind: "save" | "deploy") {
    const card = snapshot.cards.find((item) => item.id === snapshot.activeCardId);
    if (!card) return;
    setRequestState("saving");
    try {
      const payload = {
        lessonId: card.lessonId,
        title: card.title,
        goal: card.goal,
        subject: card.subject,
        grade: card.grade.replace(/^초/, ""),
        topic: card.topic,
        standard: {
          id: card.standard.id ?? undefined,
          code: card.standard.code ?? undefined,
          text: card.standard.text,
          sourceType: card.standard.sourceType ?? undefined,
          sourceName: card.standard.sourceName ?? undefined,
          sourceUrl: card.standard.sourceUrl ?? undefined,
          license: card.standard.license ?? undefined,
        },
        keywords: card.keywords,
        easyExplanation: card.easyExplanation,
        review: card.review,
        steps: card.steps.map((step, index) => ({
          id: step.id,
          order: index + 1,
          stepText: step.title,
          visualHint: step.visualHint,
          microQuiz: {
            question: step.checkQuestion,
            choices: step.choices.length ? step.choices : ["확인했어요"],
            answer: step.answer || step.choices[0] || "확인했어요",
            explanation: step.quizExplanation ?? undefined,
          },
          helpSentence: step.helpSentence,
          teacherTip: step.teacherTip,
        })),
        status: kind === "deploy" ? "published" : "draft",
      };
      const saved = await requestJson<{ card: ApiExecutionCard; steps: ApiExecutionStep[] }>(`/api/execution-cards/${encodeURIComponent(card.id)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (kind === "deploy") {
        await requestJson(`/api/execution-cards/${encodeURIComponent(card.id)}/publish`, { method: "POST" });
      }
      const mapped = mapApiCard(
        { ...saved.card, status: kind === "deploy" ? "published" : saved.card.status },
        null,
        saved.steps,
      );
      setSnapshot((current) => ({
        ...current,
        cards: current.cards.map((item) => (item.id === current.activeCardId ? mapped : item)),
      }));
      setError("");
      setRequestState("idle");
    } catch (reason) {
      setError(`${kind === "deploy" ? "배포" : "저장"} 요청 실패: ${(reason as Error).message}`);
      setRequestState("error");
    }
  }

  let view: React.ReactNode;
  if (activeView === "prep") view = <TeacherPrep snapshot={snapshot} onGenerate={createQuickCard} isSaving={requestState === "saving"} />;
  else if (activeView === "cards")
    view = (
      <TeacherCards
        snapshot={snapshot}
        setSnapshot={setSnapshot}
        onPersist={persistCard}
        onRegenerate={() => createQuickCard(snapshot.lessonTopic)}
        isSaving={requestState === "saving"}
      />
    );
  else if (activeView === "reports") view = <TeacherReports snapshot={snapshot} setActiveView={navigateTeacher} studentId={initialStudentId} />;
  else view = <TeacherDashboard snapshot={snapshot} setActiveView={navigateTeacher} refreshSnapshot={() => refreshSnapshot(snapshot.activeCardId)} />;

  return (
    <main className="dhg-app dhg-teacher-app">
      <TeacherSidebar activeView={activeView} setActiveView={navigateTeacher} />
      <div className="dhg-main">
        <LoadingStrip active={requestState === "loading"} />
        <ErrorBanner message={error} onRetry={() => window.location.reload()} />
        {hasLoaded ? (
          <>
            <TeacherHeader snapshot={snapshot} onOpenSetup={() => navigateTeacher("dashboard")} />
            {view}
          </>
        ) : requestState === "loading" ? null : (
          <section className="dhg-teacher-page">
            <div className="dhg-empty">
              <strong>데이터를 불러오지 못했습니다.</strong>
              <p>API 오류를 확인한 뒤 다시 시도해 주세요.</p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function StudentTop({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`dhg-student-top ${compact ? "compact" : ""}`}>
      <Brand />
      <button type="button" aria-label="알림">
        ♢
      </button>
    </header>
  );
}

function StudentBottomNav({ activeView, setActiveView }: { activeView: StudentView; setActiveView: (view: StudentView) => void }) {
  const items: Array<[StudentView, string, string]> = [
    ["preview", "⌂", "홈"],
    ["task", "▣", "과제"],
    ["review", "↺", "복습"],
    ["review", "▥", "내 기록"],
  ];

  return (
    <nav className="dhg-student-nav" aria-label="학생 하단 메뉴">
      {items.map(([id, icon, label], index) => (
        <button key={`${id}-${label}-${index}`} className={activeView === id ? "is-active" : ""} type="button" onClick={() => setActiveView(id)}>
          <span>{icon}</span>
          {label}
        </button>
      ))}
    </nav>
  );
}

function StudentSwitcher({
  students,
  selectedStudentId,
  onChange,
}: {
  students: ApiStudent[];
  selectedStudentId: string;
  onChange: (studentId: string) => void;
}) {
  if (students.length < 2) return null;
  return (
    <div className="dhg-student-switcher" aria-label="학생 선택">
      {students.map((student) => (
        <button
          key={student.id}
          className={student.id === selectedStudentId ? "is-active" : ""}
          type="button"
          onClick={() => onChange(student.id)}
        >
          {student.nickname}
        </button>
      ))}
    </div>
  );
}

function VisualHintView({ hint }: { hint: LessonStep["visualHint"] }) {
  const data = hint.data ?? {};
  if (hint.type === "rectangle_dimension") {
    const labels = Array.isArray(data.labels) ? data.labels.map(String) : ["위쪽 변", "옆쪽 변"];
    return (
      <div className="dhg-rectangle-demo" aria-label={hint.alt ?? "도형 치수 시각 단서"}>
        <b className="width">{labels[0] ?? "위쪽 변"}</b>
        <b className="height">{labels[1] ?? "옆쪽 변"}</b>
      </div>
    );
  }
  if (hint.type === "sequence_checklist") {
    const items = Array.isArray(data.items) ? data.items.map(String) : [];
    return (
      <ol className="dhg-visual-list">
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ol>
    );
  }
  if (hint.type === "number_line") {
    const start = typeof data.start === "number" ? data.start : 0;
    const end = typeof data.end === "number" ? data.end : 10;
    return (
      <div className="dhg-number-line" aria-label={hint.alt ?? "수직선"}>
        <span>{start}</span>
        <b />
        <span>{end}</span>
      </div>
    );
  }
  if (hint.type === "image_asset" && hint.assetUrl) {
    return <Image className="dhg-visual-asset" src={hint.assetUrl} alt={hint.alt ?? ""} width={240} height={150} />;
  }
  return <div className="dhg-text-visual">{typeof data.text === "string" ? data.text : hint.alt ?? "단서를 확인해요."}</div>;
}

function StudentTaskScreen({
  setActiveView,
  cardTitle,
  subject,
  grade,
  supportOptions,
  keywords,
  easyExplanation,
  stepCount,
  currentStepIndex,
  onSelectStep,
  stepText,
  visualHint,
  helpSentence,
  askTeacherSentence,
  quiz,
  completeStep,
  requestHelp,
  requestSimplify,
  requestHelpSentence,
  answerQuiz,
  helpCount,
  homeMission,
}: {
  setActiveView: (view: StudentView) => void;
  cardTitle: string;
  subject: string;
  grade: string;
  supportOptions: string[];
  keywords: Array<{ word: string; easyMeaning: string }>;
  easyExplanation: string;
  stepCount: number;
  currentStepIndex: number;
  onSelectStep: (index: number) => void;
  stepText: string;
  visualHint: LessonStep["visualHint"];
  helpSentence: string;
  askTeacherSentence: string;
  quiz: { question: string; choices: string[]; answer: string };
  completeStep: () => void;
  requestHelp: () => void;
  requestSimplify: () => void;
  requestHelpSentence: () => void;
  answerQuiz: (answer: string) => void;
  helpCount: number;
  homeMission?: string | null;
}) {
  const [answer, setAnswer] = useState("");
  const profile = normalizeSupportOptions(supportOptions);
  const showVisualFirst = hasSupportOption(profile, "visual_hint");
  const showKeywords = hasSupportOption(profile, "easy_language") && keywords.length > 0;
  const showHelpSentence = hasSupportOption(profile, "help_sentence");
  const showRepeatCheck = hasSupportOption(profile, "repeat_check");
  const showLifeMission = hasSupportOption(profile, "life_example") && homeMission;

  useEffect(() => {
    setAnswer("");
  }, [currentStepIndex, stepText]);

  return (
    <section className="dhg-student-screen">
      <StudentTop />
      <div className={`dhg-task-progress ${hasSupportOption(profile, "step_breakdown") ? "is-step-focused" : ""}`}>
        <strong>
          과제 <span>{currentStepIndex + 1}</span>/{stepCount}
        </strong>
        {Array.from({ length: stepCount }).map((_, index) => (
          <button
            key={index + 1}
            className={index === currentStepIndex ? "is-active" : index < currentStepIndex ? "is-done" : ""}
            type="button"
            onClick={() => onSelectStep(index)}
          >
            <b>{index + 1}</b>
            <span>{["읽기", "이해하기", "연습하기", "마무리"][index] ?? `${index + 1}단계`}</span>
          </button>
        ))}
      </div>
      <section className="dhg-mobile-card">
        <p>
          <span>{subject}</span>
          <span>{grade}</span>
        </p>
        <h1>{cardTitle}</h1>
        <Image className="dhg-mascot-asset" src="/assets/generated/student-mascot.png" alt="" width={108} height={108} />
      </section>
      {showKeywords ? (
        <section className="dhg-support-card easy-language">
          <h2>쉬운 말로 먼저 볼게요</h2>
          <p>{easyExplanation}</p>
          <div>
            {keywords.slice(0, 4).map((keyword) => (
              <span key={keyword.word}>
                <b>{keyword.word}</b>
                {keyword.easyMeaning}
              </span>
            ))}
          </div>
        </section>
      ) : null}
      <section className="dhg-mobile-task-card">
        <span className="dhg-step-badge">{currentStepIndex + 1}단계</span>
        <h2>{stepText}</h2>
        {showVisualFirst ? <VisualHintView hint={visualHint} /> : null}
        <aside>
          <strong>힌트</strong>
          <p>{helpSentence}</p>
        </aside>
        {!showVisualFirst ? <VisualHintView hint={visualHint} /> : null}
        <button type="button" onClick={completeStep}>
          완료했어요
        </button>
        <div className="dhg-mobile-actions">
          <button type="button" onClick={requestHelp}>
            모르겠어요 {helpCount > 0 ? helpCount : ""}
          </button>
          <button
            type="button"
            onClick={() => {
              requestSimplify();
            }}
          >
            다시 쉽게 말해줘
          </button>
        </div>
      </section>
      {showHelpSentence ? (
        <button className="dhg-question-card is-emphasis" type="button" onClick={requestHelpSentence}>
          <span>•••</span>
          <strong>선생님께 이렇게 말할 수 있어요</strong>
          <small>{askTeacherSentence}</small>
          <b>›</b>
        </button>
      ) : (
        <button className="dhg-question-card" type="button" onClick={requestHelpSentence}>
          <span>•••</span>
          <strong>도움 문장 보기</strong>
          <small>{askTeacherSentence}</small>
          <b>›</b>
        </button>
      )}
      <section className={`dhg-quiz-card ${showRepeatCheck ? "is-repeat" : ""}`}>
        <h2>{showRepeatCheck ? "한 번 더 확인해볼게요" : "확인해볼게요"}</h2>
        <p>{quiz.question}</p>
        <div>
          {(quiz.choices.length ? quiz.choices : ["확인했어요", "다시 볼래요"]).map((item) => (
            <button
              key={item}
              className={answer === item ? "is-selected" : ""}
              type="button"
              onClick={() => {
                setAnswer(item);
                answerQuiz(item);
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </section>
      {showLifeMission ? (
        <section className="dhg-support-card life-mission">
          <h2>생활 속 미션</h2>
          <p>{homeMission}</p>
        </section>
      ) : null}
      <button className="dhg-cheer-card" type="button" onClick={() => setActiveView("review")}>
        잘하고 있어요! 한 걸음씩 차근차근 해봐요! 💙
      </button>
    </section>
  );
}

function StudentReviewScreen({
  setActiveView,
  cardTitle,
  subject,
  grade,
  stepCount,
  summary,
  review,
}: {
  setActiveView: (view: StudentView) => void;
  cardTitle: string;
  subject: string;
  grade: string;
  stepCount: number;
  summary?: ApiTaskSummary | null;
  review: ApiExecutionCard["reviewJson"];
}) {
  const totalSteps = Math.max(1, stepCount);
  const completedSteps = Math.round(((summary?.completionRate ?? 0) / 100) * totalSteps);
  const nextReview = summary?.generatedReviewJson.nextReview?.length ? summary.generatedReviewJson.nextReview : review.nextReview;
  const askTeacherSentence = summary?.generatedReviewJson.askTeacherSentence || review.askTeacherSentence;
  const homeMission = summary?.generatedReviewJson.homeMission || review.homeMission;
  return (
    <section className="dhg-student-screen review">
      <StudentTop compact />
      <div className="dhg-review-hero">
        <div>
          <h1>오늘 과제 돌아보기</h1>
          <p>수고했어요! 오늘의 학습을 함께 돌아볼까요?</p>
        </div>
        <span>🔎</span>
      </div>
      <button className="dhg-review-task-card" type="button">
        <span>+−×÷</span>
        <div>
          <p>
            <b>{subject}</b>
            <b>{grade}</b>
          </p>
          <strong>{cardTitle}</strong>
          <small>{summary ? `${Math.round(summary.totalTimeSeconds / 60)}분 수행` : "아직 수행 기록 없음"}</small>
        </div>
        <em>›</em>
      </button>
      <section className="dhg-review-summary">
        <h2>오늘 결과 요약 🎉</h2>
        <div>
          <article>
            <span>✓</span>
            <p>완료 단계</p>
            <strong>{completedSteps}/{totalSteps}</strong>
          </article>
          <article>
            <span>•••</span>
            <p>도움 요청</p>
            <strong>{summary?.helpRequestCount ?? 0}회</strong>
          </article>
          <article>
            <span>★</span>
            <p>확인 퀴즈</p>
            <strong>{summary?.correctQuizCount ?? 0}/{summary?.totalQuizCount ?? 0} 정답</strong>
          </article>
        </div>
      </section>
      <section className="dhg-pill-section">
        <h2>오늘 잘한 점 ⭐</h2>
        <div>
          {(summary?.generatedReviewJson.goodPoints?.length ? summary.generatedReviewJson.goodPoints : review.goodPoints).map((point) => (
            <span key={point}>✓ {point}</span>
          ))}
        </div>
      </section>
      <section className="dhg-next-review">
        <h2>다음에 다시 보기</h2>
        <div>
          {nextReview.map((item) => (
            <button key={`${item.type}-${item.title}`} type="button" onClick={() => setActiveView(item.type === "practice" ? "task" : "preview")}>
              {item.title} <small>{item.description}</small>
            </button>
          ))}
        </div>
      </section>
      <button
        className="dhg-question-card"
        type="button"
        onClick={() =>
          copyTextToClipboard(askTeacherSentence)
        }
      >
        <span>•••</span>
        <strong>선생님께 이렇게 물어보면 좋아요</strong>
        <small>{askTeacherSentence}</small>
        <b>›</b>
      </button>
      {homeMission ? (
        <section className="dhg-support-card life-mission">
          <h2>생활 속 미션</h2>
          <p>{homeMission}</p>
        </section>
      ) : null}
      <div className="dhg-mobile-cta-stack">
        <button className="dhg-primary blue" type="button" onClick={() => setActiveView("task")}>
          다시 연습하기
        </button>
        <button className="dhg-secondary blue" type="button" onClick={() => setActiveView("preview")}>
          복습 카드 보기
        </button>
      </div>
    </section>
  );
}

function StudentPreviewScreen({
  setActiveView,
  cardTitle,
  subject,
  grade,
  lessonDate,
  keywords,
  review,
}: {
  setActiveView: (view: StudentView) => void;
  cardTitle: string;
  subject: string;
  grade: string;
  lessonDate?: string;
  keywords: Array<{ word: string; easyMeaning: string }>;
  review: ApiExecutionCard["reviewJson"];
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const todos = [
    keywords[0] ? `${keywords[0].word} 뜻 확인하기` : `${cardTitle} 핵심 낱말 확인하기`,
    `${cardTitle} 과제 순서 살펴보기`,
    "문제 풀고 내 풀이 확인하기",
  ];
  const conceptKeywords = keywords.length
    ? keywords
    : [{ word: cardTitle, easyMeaning: "선생님이 준비한 과제의 핵심 내용" }];
  const askQuestions = [
    review.askTeacherSentence || `선생님, ${cardTitle}에서 어려운 부분을 다시 설명해 주세요.`,
    `${cardTitle}을/를 비슷한 예로 한 번 더 보여주세요.`,
  ];

  function toggle(item: string) {
    setChecked((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]));
  }

  return (
    <section className="dhg-student-screen preview">
      <StudentTop />
      <p className="dhg-date-line">▣ {(lessonDate ?? new Date().toISOString().slice(0, 10)).replaceAll("-", ".")}</p>
      <div className="dhg-preview-title">
        <h1>내일 수업 미리보기</h1>
        <p>내일 배울 내용을 미리 확인해봐요.</p>
        <Image src="/assets/generated/student-mascot.png" alt="" width={140} height={140} />
      </div>
      <section className="dhg-mobile-card">
        <p>
          <span>{subject}</span>
          <span>{grade}</span>
        </p>
        <h2>{cardTitle}</h2>
      </section>
      <section className="dhg-concept-card">
        <h2>먼저 알아두기</h2>
        <div>
          {conceptKeywords.map((keyword) => (
            <article key={keyword.word}>
              <strong>{keyword.word}</strong>
              <p>{keyword.easyMeaning}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="dhg-todo-card">
        <h2>내일 수업에서 할 일</h2>
        {todos.map((item, index) => (
          <button key={item} type="button" onClick={() => toggle(item)}>
            <span>{index + 1}</span>
            <strong>{item}</strong>
            <b className={checked.includes(item) ? "is-checked" : ""}>✓</b>
          </button>
        ))}
      </section>
      <section className="dhg-question-list">
        <h2>어려우면 이렇게 물어봐요</h2>
        {askQuestions.map((question) => (
          <button key={question} type="button" onClick={() => copyTextToClipboard(question)}>
            {question} <span>›</span>
          </button>
        ))}
      </section>
      {review.homeMission ? (
        <section className="dhg-support-card life-mission">
          <h2>생활 속 미션</h2>
          <p>{review.homeMission}</p>
        </section>
      ) : null}
      <button className="dhg-cheer-card" type="button" onClick={() => setActiveView("task")}>
        내일도 차근차근, 함께 해봐요! 💙
      </button>
    </section>
  );
}

export function StudentDemoApp({ initialView = "task", initialCardId }: { initialView?: StudentView; initialCardId?: string }) {
  const [activeView, setActiveView] = useState<StudentView>(initialView);
  const [requestState, setRequestState] = useState<RequestState>("loading");
  const [error, setError] = useState("");
  const [completedSteps, setCompletedSteps] = useState(0);
  const [helpCount, setHelpCount] = useState(0);
  const [task, setTask] = useState<ApiStudentTask | null>(null);
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("studentId") ?? "",
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  function navigateStudent(view: StudentView) {
    setActiveView(view);
    router.push(withStudentQuery(studentRoute(view, task?.card.id), selectedStudentId));
  }

  function switchStudent(studentId: string) {
    setSelectedStudentId(studentId);
    setTask(null);
    setRequestState("loading");
    setCurrentStepIndex(0);
    setCompletedSteps(0);
    setHelpCount(0);
    router.push(withStudentQuery(studentRoute(activeView, task?.card.id ?? initialCardId), studentId));
  }

  useEffect(() => {
    const query = selectedStudentId ? `?studentId=${encodeURIComponent(selectedStudentId)}` : "";
    requestJson<{ studentId: string | null; student?: ApiStudent | null; students?: ApiStudent[]; tasks?: ApiStudentTask[] } & Partial<ApiStudentTask>>(
      initialCardId ? `/api/student/tasks/${encodeURIComponent(initialCardId)}${query}` : `/api/student/tasks${query}`,
    )
      .then((data) => {
        setStudents(data.students ?? []);
        if (data.studentId && data.studentId !== selectedStudentId) setSelectedStudentId(data.studentId);
        const firstTask = initialCardId
          ? ({
              studentId: data.studentId,
              student: data.student ?? null,
              students: data.students ?? [],
              card: data.card,
              lesson: data.lesson ?? null,
              steps: data.steps ?? [],
              summary: data.summary,
            } as ApiStudentTask)
          : data.tasks?.[0];
        if (!firstTask) {
          setTask(null);
          setRequestState("idle");
          setError("");
          return;
        }
        setTask(firstTask);
        const stepTotal = Math.max(1, firstTask.steps.length);
        const completed = firstTask.summary?.completionRate ? Math.max(1, Math.round((firstTask.summary.completionRate / 100) * stepTotal)) : 1;
        setCompletedSteps(completed);
        setHelpCount(firstTask.summary?.helpRequestCount ?? 0);
        setCurrentStepIndex(Math.min(Math.max(0, completed - 1), Math.max(0, firstTask.steps.length - 1)));
        setRequestState("idle");
        setError("");
      })
      .catch((reason: Error) => {
        setRequestState("error");
        setError(`${initialCardId ? `/api/student/tasks/${initialCardId}` : "/api/student/tasks"} 요청 실패: ${reason.message}`);
      });
  }, [initialCardId, selectedStudentId]);

  const currentStep = task?.steps[currentStepIndex] ?? task?.steps[0] ?? null;
  const taskCardId = task?.card.id;
  const currentStepId = currentStep?.id;

  useEffect(() => {
    if (!taskCardId || !currentStepId || activeView !== "task") return;
    requestJson(withStudentQuery(`/api/student/tasks/${encodeURIComponent(taskCardId)}/steps/${encodeURIComponent(currentStepId)}/start`, selectedStudentId), {
      method: "POST",
    }).catch((reason: Error) => {
      setError(`과제 시작 로그 저장 실패: ${reason.message}`);
    });
  }, [activeView, currentStepId, selectedStudentId, taskCardId]);

  if (!task) {
    const noRegisteredStudents = requestState !== "loading" && !error && students.length === 0;
    return (
      <main className="dhg-student-app">
        <div className="dhg-student-device">
          <LoadingStrip active={requestState === "loading"} />
          <ErrorBanner message={error} />
          <StudentSwitcher students={students} selectedStudentId={selectedStudentId} onChange={switchStudent} />
          {requestState !== "loading" && !error ? (
            <div className="dhg-empty">
              <strong>{noRegisteredStudents ? "등록된 학생이 없습니다." : "배포된 과제가 없습니다."}</strong>
              <p>
                {noRegisteredStudents
                  ? "선생님 화면에서 학생을 먼저 등록한 뒤 과제를 배포해 주세요."
                  : "선생님 화면에서 실행카드를 먼저 배포해 주세요."}
              </p>
            </div>
          ) : null}
          <StudentBottomNav activeView={activeView} setActiveView={navigateStudent} />
        </div>
      </main>
    );
  }

  if (!currentStep) {
    return (
      <main className="dhg-student-app">
        <div className="dhg-student-device">
          <ErrorBanner message="과제 단계가 없습니다. 실행카드를 다시 생성해 주세요." />
          <StudentBottomNav activeView={activeView} setActiveView={navigateStudent} />
        </div>
      </main>
    );
  }
  const currentQuiz = currentStep.microQuizJson;
  const loadedTask = task;
  const loadedStep = currentStep;

  function updateSummary(summary?: ApiTaskSummary) {
    if (!summary) return;
    setTask((current) => (current ? { ...current, summary } : current));
    setCompletedSteps(Math.max(1, Math.round((summary.completionRate / 100) * Math.max(1, loadedTask.steps.length || 4))));
    setHelpCount(summary.helpRequestCount);
  }

  async function completeStep() {
    try {
      const result = await requestJson<{ summary: ApiTaskSummary }>(
        withStudentQuery(`/api/student/tasks/${encodeURIComponent(loadedTask.card.id)}/steps/${encodeURIComponent(loadedStep.id)}/complete`, selectedStudentId),
        { method: "POST" },
      );
      updateSummary(result.summary);
      if (currentStepIndex < loadedTask.steps.length - 1) {
        setCurrentStepIndex((index) => Math.min(index + 1, loadedTask.steps.length - 1));
      } else {
        navigateStudent("review");
      }
      setError("");
    } catch (reason) {
      setError(`진도 저장 실패: ${(reason as Error).message}`);
    }
  }

  async function requestHelp() {
    try {
      const result = await requestJson<{ summary: ApiTaskSummary }>(
        withStudentQuery(`/api/student/tasks/${encodeURIComponent(loadedTask.card.id)}/steps/${encodeURIComponent(loadedStep.id)}/confused`, selectedStudentId),
        { method: "POST" },
      );
      updateSummary(result.summary);
      setError("");
    } catch (reason) {
      setError(`도움 요청 저장 실패: ${(reason as Error).message}`);
    }
  }

  async function requestSimplify() {
    try {
      const result = await requestJson<{ summary: ApiTaskSummary; easyText?: string }>(
        withStudentQuery(`/api/student/tasks/${encodeURIComponent(loadedTask.card.id)}/steps/${encodeURIComponent(loadedStep.id)}/simplify`, selectedStudentId),
        { method: "POST" },
      );
      updateSummary(result.summary);
      if (result.easyText) {
        setTask((current) =>
          current
            ? {
                ...current,
                steps: current.steps.map((step) => (step.id === loadedStep.id ? { ...step, stepText: result.easyText ?? step.stepText } : step)),
              }
            : current,
        );
      }
      setError("");
    } catch (reason) {
      setError(`쉬운 설명 요청 실패: ${(reason as Error).message}`);
    }
  }

  async function requestHelpSentence() {
    try {
      const result = await requestJson<{ summary: ApiTaskSummary; helpSentence?: string }>(
        withStudentQuery(`/api/student/tasks/${encodeURIComponent(loadedTask.card.id)}/steps/${encodeURIComponent(loadedStep.id)}/help-sentence`, selectedStudentId),
        { method: "POST" },
      );
      updateSummary(result.summary);
      copyTextToClipboard(result.helpSentence || loadedStep.helpSentence);
      setError("");
    } catch (reason) {
      setError(`도움 문장 로그 저장 실패: ${(reason as Error).message}`);
    }
  }

  async function answerQuiz(answer: string) {
    try {
      const result = await requestJson<{ summary: ApiTaskSummary; isCorrect: boolean }>(
        withStudentQuery(`/api/student/tasks/${encodeURIComponent(loadedTask.card.id)}/steps/${encodeURIComponent(loadedStep.id)}/quiz`, selectedStudentId),
        {
          method: "POST",
          body: JSON.stringify({ answer }),
        },
      );
      updateSummary(result.summary);
      setError(result.isCorrect ? "" : "퀴즈 답이 맞지 않았어요. 다시 확인해보세요.");
    } catch (reason) {
      setError(`퀴즈 저장 실패: ${(reason as Error).message}`);
    }
  }

  return (
    <main className="dhg-student-app">
      <div className="dhg-student-device">
        <LoadingStrip active={requestState === "loading"} />
        <ErrorBanner message={error} />
        <StudentSwitcher students={students} selectedStudentId={selectedStudentId || task.studentId || ""} onChange={switchStudent} />
        {activeView === "review" ? (
          <StudentReviewScreen
            setActiveView={navigateStudent}
            cardTitle={task.card.title}
            subject={task.lesson?.subject ?? task.card.subject}
            grade={task.lesson?.grade ? gradeBandFromGrade(task.lesson.grade) : task.card.grade}
            stepCount={task.steps.length}
            summary={task.summary}
            review={task.card.reviewJson}
          />
        ) : activeView === "preview" ? (
          <StudentPreviewScreen
            setActiveView={navigateStudent}
            cardTitle={task.card.title}
            subject={task.lesson?.subject ?? task.card.subject}
            grade={task.lesson?.grade ? gradeBandFromGrade(task.lesson.grade) : task.card.grade}
            lessonDate={task.lesson?.lessonDate}
            keywords={task.card.keywordsJson}
            review={task.card.reviewJson}
          />
        ) : (
          <StudentTaskScreen
            setActiveView={navigateStudent}
            cardTitle={task.card.title}
            subject={task.lesson?.subject ?? task.card.subject}
            grade={task.lesson?.grade ? gradeBandFromGrade(task.lesson.grade) : task.card.grade}
            supportOptions={task.card.supportOptionsJson}
            keywords={task.card.keywordsJson}
            easyExplanation={task.card.easyExplanation}
            stepCount={task.steps.length}
            currentStepIndex={currentStepIndex}
            onSelectStep={setCurrentStepIndex}
            stepText={currentStep.stepText}
            visualHint={mapApiStep(currentStep).visualHint}
            helpSentence={currentStep.helpSentence}
            askTeacherSentence={task.card.reviewJson.askTeacherSentence || currentStep.helpSentence}
            quiz={currentQuiz}
            completeStep={completeStep}
            requestHelp={requestHelp}
            requestSimplify={requestSimplify}
            requestHelpSentence={requestHelpSentence}
            answerQuiz={answerQuiz}
            helpCount={helpCount}
            homeMission={task.card.reviewJson.homeMission}
          />
        )}
        <div className="dhg-step-toast" aria-live="polite">
          완료 단계 {completedSteps}/{task.steps.length}
        </div>
        <StudentBottomNav activeView={activeView} setActiveView={navigateStudent} />
      </div>
    </main>
  );
}
