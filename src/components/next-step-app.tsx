"use client";
/* eslint-disable @next/next/no-img-element, react-hooks/exhaustive-deps */

import type * as React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Headphones,
  LayoutDashboard,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  SUPPORT_OPTION_KEYS,
  SUPPORT_OPTION_LABELS,
  hasSupportOption,
  normalizeSupportOptions,
  type SupportOptionKey,
} from "@/lib/support-options";

type TeacherView = "dashboard" | "prep" | "cards" | "reports";
type StudentView = "task" | "review" | "preview";
type LoadState = "idle" | "loading" | "saving" | "error";

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

type ApiStudent = {
  id: string;
  nickname: string;
  supportProfileJson?: Record<string, unknown>;
};

type ApiLesson = {
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
};

type VisualHint = {
  type: "text_only" | "rectangle_dimension" | "number_line" | "sequence_checklist" | "image_asset";
  data?: Record<string, unknown> | null;
  assetUrl?: string | null;
  alt?: string | null;
};

type MicroQuiz = {
  question: string;
  choices: string[];
  answer: string;
  explanation?: string | null;
};

type ApiExecutionStep = {
  id: string;
  cardId: string;
  order: number;
  stepText: string;
  visualHintJson: VisualHint;
  microQuizJson: MicroQuiz;
  helpSentence: string;
  teacherTip: string;
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
  updatedAt?: string;
  publishedAt?: string;
};

type CardBundle = {
  card: ApiExecutionCard;
  lesson: ApiLesson | null;
  steps: ApiExecutionStep[];
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

type ApiStudentLog = {
  id: string;
  studentId: string;
  cardId: string;
  stepId: string;
  eventType: "started" | "completed" | "confused" | "simplify" | "help_sentence_viewed" | "quiz_answered";
  payloadJson: Record<string, unknown>;
  createdAt: string;
};

type ApiStudentTask = CardBundle & {
  studentId: string | null;
  student: ApiStudent | null;
  students: ApiStudent[];
  logs: ApiStudentLog[];
  summary?: ApiTaskSummary | null;
};

type ApiNeisSchool = {
  ATPT_OFCDC_SC_CODE: string;
  ATPT_OFCDC_SC_NM: string;
  SD_SCHUL_CODE: string;
  SCHUL_NM: string;
  SCHUL_KND_SC_NM: string;
  ORG_RDNMA?: string | null;
};

type ApiReport = {
  report: {
    summary: string;
    difficultyTagsJson: string[];
    aiRecommendationsJson: string[];
    parentMemo: string;
    createdAt: string;
  };
  summary: ApiTaskSummary;
  perStep: Array<{
    step: { id: string; order: number; stepText: string };
    isCompleted: boolean;
    confusedCount: number;
    simplifyCount: number;
    helpSentenceViewedCount?: number;
    quizAnswered: boolean;
    isCorrect: boolean;
    studentResponse?: string | null;
    timeSeconds: number;
  }>;
};

type ApiTeacherAssistant = {
  student: {
    id: string;
    nickname: string;
    profile: string;
    supportOptions: string[];
  };
  card: { id: string; title: string; subject: string; grade: string } | null;
  answer: {
    answer: string;
    nextActions: string[];
    questionToAskStudent: string;
    evidence: string[];
  };
};

const PROFILE_PRESETS = [
  {
    label: "긴 문장 이해 어려움",
    options: ["easy_language", "step_breakdown", "help_sentence"] satisfies string[],
  },
  {
    label: "순서 기억 어려움",
    options: ["step_breakdown", "visual_hint", "repeat_check"] satisfies string[],
  },
  {
    label: "시각 단서 필요",
    options: ["visual_hint", "step_breakdown", "life_example"] satisfies string[],
  },
  {
    label: "반복 점검 선호",
    options: ["repeat_check", "easy_language", "help_sentence"] satisfies string[],
  },
  {
    label: "도움 요청 어려움",
    options: ["help_sentence", "easy_language", "step_breakdown"] satisfies string[],
  },
];

const DEFAULT_ASSETS = {
  logo: "/assets/generated/logo-mark.png",
  mascot: "/assets/generated/student-mascot.png",
  robot: "/assets/generated/help-robot.png",
};

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.error === "string"
          ? payload.error
          : typeof payload?.error?.message === "string"
            ? payload.error.message
            : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return payload as T;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date?: string) {
  if (!date) return today().replaceAll("-", ".");
  return date.slice(0, 10).replaceAll("-", ".");
}

function gradeBand(grade?: string | null) {
  const value = (grade ?? "").replace("학년", "").trim();
  if (!value) return "";
  return value.startsWith("초") ? value : `초${value}`;
}

function sourceTypeLabel(sourceType?: string | null) {
  if (sourceType === "official" || sourceType === "official_metadata") return "교육과정 기준";
  if (sourceType === "crawled") return "교육과정 자료";
  if (sourceType === "uploaded") return "등록 자료";
  if (sourceType === "manual") return "교사 입력 기준";
  return "예시 기준";
}

function sourceTypeClass(sourceType?: string | null) {
  if (sourceType === "official" || sourceType === "official_metadata") return "is-official";
  if (sourceType === "seed" || !sourceType) return "is-seed";
  return "is-public";
}

function cleanSourceName(sourceName?: string | null) {
  if (!sourceName) return "교육과정 자료";
  const label = sourceName
    .replaceAll("성취기준 공개 REST", "성취기준")
    .replace(/metadata/gi, "자료")
    .replace(/seed/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!label || /확인 필요|약관|재이용|재배포/i.test(label)) return "교육과정 자료";
  return label;
}

function cleanLicenseLabel(license?: string | null) {
  if (!license) return "";
  const label = license.trim();
  if (/확인 필요|약관|재이용|재배포|metadata|seed|corpus|원문|저작권 정책/i.test(label)) return "";
  if (label.length > 30) return "";
  return label;
}

function supportOptionsFromStudent(student?: ApiStudent | null) {
  const options = student?.supportProfileJson?.supportOptions;
  return Array.isArray(options)
    ? normalizeSupportOptions(options.filter((item): item is string => typeof item === "string"))
    : normalizeSupportOptions(["easy_language", "step_breakdown", "help_sentence"]);
}

function profileFromStudent(student?: ApiStudent | null) {
  const profile = student?.supportProfileJson?.profile;
  return typeof profile === "string" && profile.trim() ? profile : "지원 프로필 미설정";
}

function studentQuery(studentId?: string | null) {
  return studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
}

function formatSeconds(seconds?: number) {
  if (!seconds) return "0분";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}분 ${String(rest).padStart(2, "0")}초` : `${rest}초`;
}

function getStepItems(value?: Record<string, unknown> | null) {
  const items = value?.items;
  if (Array.isArray(items)) return items.filter((item): item is string => typeof item === "string");
  const labels = value?.labels;
  if (Array.isArray(labels)) return labels.filter((item): item is string => typeof item === "string");
  return [];
}

function getHintText(value?: Record<string, unknown> | null) {
  const text = value?.text ?? value?.description ?? value?.hint;
  return typeof text === "string" ? text : "";
}

function TeacherNav({
  view,
  onMove,
  context,
  bundles,
  onOpenReport,
}: {
  view: TeacherView;
  onMove: (next: TeacherView) => void;
  context: ApiClassroomContext | null;
  bundles: CardBundle[];
  onOpenReport: (studentId: string) => void;
}) {
  const items: Array<{ id: TeacherView; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { id: "dashboard", label: "교실 운영", icon: LayoutDashboard },
    { id: "prep", label: "수업 준비", icon: ClipboardList },
    { id: "cards", label: "실행카드", icon: Pencil },
    { id: "reports", label: "학생 리포트", icon: BarChart3 },
  ];
  return (
    <aside className="mvp-sidebar">
      <div className="mvp-brand">
        <img src={DEFAULT_ASSETS.logo} alt="" />
        <strong>다음한걸음</strong>
      </div>
      <nav>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={view === item.id ? "is-active" : ""}
              onClick={() => onMove(item.id)}
              type="button"
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <TeacherSidebarAssistant context={context} bundles={bundles} onOpenReport={onOpenReport} />
    </aside>
  );
}

function TeacherSidebarAssistant({
  context,
  bundles,
  onOpenReport,
}: {
  context: ApiClassroomContext | null;
  bundles: CardBundle[];
  onOpenReport: (studentId: string) => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [question, setQuestion] = useState("이 학생이 막힌 단계에서 바로 해볼 지원은 무엇인가요?");
  const [assistant, setAssistant] = useState<ApiTeacherAssistant | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId && context?.students[0]?.id) setStudentId(context.students[0].id);
  }, [context?.students, studentId]);

  const student = context?.students.find((item) => item.id === studentId) ?? context?.students[0] ?? null;
  const activeCardId =
    context?.activeCardId && bundles.some((bundle) => bundle.card.id === context.activeCardId)
      ? context.activeCardId
      : bundles.find((bundle) => bundle.card.status === "published")?.card.id ?? bundles[0]?.card.id ?? "";
  const summary = student ? context?.summariesByStudentId?.[student.id] ?? null : null;

  async function askAssistant() {
    if (!student) {
      setError("먼저 학생을 등록해 주세요.");
      return;
    }
    setState("loading");
    setError("");
    try {
      const result = await requestJson<ApiTeacherAssistant>("/api/teacher/assistant", {
        method: "POST",
        body: JSON.stringify({
          studentId: student.id,
          cardId: activeCardId || undefined,
          question,
        }),
      });
      setAssistant(result);
      setState("idle");
    } catch (error) {
      setAssistant(null);
      setState("error");
      setError(error instanceof Error ? error.message : "학생 지원 답변을 만들지 못했습니다.");
    }
  }

  return (
    <section className="mvp-sidebar-assistant" aria-label="학생별 지원 챗봇">
      <div className="mvp-sidebar-assistant-head">
        <img src={DEFAULT_ASSETS.robot} alt="" />
        <div>
          <strong>학생별 지원 챗봇</strong>
          <p>학생이 막힌 단계와 도움 요청은 리포트에서 바로 확인할 수 있습니다.</p>
        </div>
      </div>
      {student ? (
        <>
          <label>
            학생
            <select
              value={student.id}
              onChange={(event) => {
                setStudentId(event.target.value);
                setAssistant(null);
              }}
            >
              {context?.students.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nickname}
                </option>
              ))}
            </select>
          </label>
          <div className="mvp-sidebar-student-card">
            <b>{profileFromStudent(student)}</b>
            <span>
              완료 {summary?.completionRate ?? 0}% · 도움 {summary?.helpRequestCount ?? 0}회 · 막힌 단계{" "}
              {summary?.stuckStepCount ?? 0}개
            </span>
          </div>
          <label>
            질문
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={3}
            />
          </label>
          <button className="mvp-primary" onClick={askAssistant} type="button" disabled={state === "loading"}>
            {state === "loading" ? <Loader2 size={16} className="mvp-spin" /> : <Send size={16} />}
            프로필 질문하기
          </button>
          <button className="mvp-secondary" onClick={() => onOpenReport(student.id)} type="button">
            리포트 보기
          </button>
          {error ? <p className="mvp-sidebar-error">{error}</p> : null}
          {assistant ? (
            <div className="mvp-sidebar-answer">
              <strong>추천 지원</strong>
              <p>{assistant.answer.answer}</p>
              <ul>
                {assistant.answer.nextActions.slice(0, 2).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mvp-sidebar-empty">학생을 등록하면 지원 질문과 리포트 연결이 활성화됩니다.</p>
      )}
    </section>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="mvp-empty">
      <img src={DEFAULT_ASSETS.robot} alt="" />
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
        {action}
      </div>
    </section>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <div className="mvp-error" role="alert">
      <span>{message}</span>
      {onRetry ? (
        <button onClick={onRetry} type="button">
          다시 시도
        </button>
      ) : null}
    </div>
  );
}

function TopBar({
  context,
  state,
  onRefresh,
}: {
  context: ApiClassroomContext | null;
  state: LoadState;
  onRefresh: () => void;
}) {
  const school = context?.school;
  const classroom = context?.classroom;
  return (
    <header className="mvp-topbar">
      <div>
        <strong>{school?.schoolCode ? school.schoolName : "학교 연결 필요"}</strong>
        <span>
          {classroom ? `${classroom.grade}학년 ${classroom.classNo}반` : "학급 설정 필요"}
          {school?.source ? ` · ${school.source}` : ""}
        </span>
      </div>
      <button className="mvp-icon-button" onClick={onRefresh} type="button" aria-label="새로고침">
        {state === "loading" ? <Loader2 size={18} className="mvp-spin" /> : <RefreshCw size={18} />}
      </button>
    </header>
  );
}

function TeacherSetupPanel({
  context,
  onRefresh,
  onError,
}: {
  context: ApiClassroomContext | null;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState(context?.classroom?.grade ?? "4");
  const [classNo, setClassNo] = useState(context?.classroom?.classNo ?? "1");
  const [schoolResults, setSchoolResults] = useState<ApiNeisSchool[]>([]);
  const [studentName, setStudentName] = useState("");
  const [profile, setProfile] = useState(PROFILE_PRESETS[0].label);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    setGrade(context?.classroom?.grade ?? "4");
    setClassNo(context?.classroom?.classNo ?? "1");
  }, [context?.classroom?.grade, context?.classroom?.classNo]);

  const profilePreset = PROFILE_PRESETS.find((item) => item.label === profile) ?? PROFILE_PRESETS[0];
  const connected = Boolean(context?.school?.schoolCode);

  async function searchSchools() {
    if (query.trim().length < 2) {
      onError("학교명은 두 글자 이상 입력해 주세요.");
      return;
    }
    setBusy("school-search");
    try {
      const result = await requestJson<{ rows: ApiNeisSchool[] }>(
        `/api/neis/schools/search?keyword=${encodeURIComponent(query.trim())}&pageSize=8`,
      );
      setSchoolResults(result.rows ?? []);
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "학교 검색에 실패했습니다.");
    } finally {
      setBusy("");
    }
  }

  async function connectSchool(school: ApiNeisSchool) {
    setBusy(school.SD_SCHUL_CODE);
    try {
      await requestJson("/api/classroom/context", {
        method: "PATCH",
        body: JSON.stringify({
          school: {
            schoolName: school.SCHUL_NM,
            schoolCode: school.SD_SCHUL_CODE,
            officeCode: school.ATPT_OFCDC_SC_CODE,
            address: school.ORG_RDNMA ?? "",
            schoolLevel: school.SCHUL_KND_SC_NM,
            source: "NEIS",
          },
          classroom: { grade, classNo },
        }),
      });
      await onRefresh();
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "학교/학급 저장에 실패했습니다.");
    } finally {
      setBusy("");
    }
  }

  async function saveClassOnly() {
    setBusy("class");
    try {
      await requestJson("/api/classroom/context", {
        method: "PATCH",
        body: JSON.stringify({ classroom: { grade, classNo } }),
      });
      await onRefresh();
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "학급 저장에 실패했습니다.");
    } finally {
      setBusy("");
    }
  }

  async function registerStudent() {
    if (!studentName.trim()) {
      onError("학생 이름 또는 별칭을 입력해 주세요.");
      return;
    }
    setBusy("student");
    try {
      await requestJson("/api/students", {
        method: "POST",
        body: JSON.stringify({
          nickname: studentName.trim(),
          classroomId: context?.classroom?.id,
          profile,
          supportOptions: profilePreset.options,
        }),
      });
      setStudentName("");
      await onRefresh();
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "학생 등록에 실패했습니다.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="mvp-panel mvp-setup">
      <div className="mvp-panel-head">
        <div>
          <p className="mvp-eyebrow">교실 설정</p>
          <h2>먼저 학교와 학생을 실제 데이터로 연결하세요</h2>
        </div>
        <span className={connected ? "mvp-status is-good" : "mvp-status"}>{connected ? "NEIS 학교 연결됨" : "연결 전"}</span>
      </div>
      <div className="mvp-setup-grid">
        <div>
          <h3>1. 학교/학급</h3>
          <p className="mvp-muted">
            현재: {context?.school?.schoolCode ? context.school.schoolName : "학교 연결 전"} ·{" "}
            {context?.classroom ? `${context.classroom.grade}학년 ${context.classroom.classNo}반` : "학급 설정 전"}
          </p>
          <div className="mvp-inline-form">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="학교명 검색" />
            <select value={grade} onChange={(event) => setGrade(event.target.value)} aria-label="학년">
              {["1", "2", "3", "4", "5", "6"].map((item) => (
                <option key={item} value={item}>
                  {item}학년
                </option>
              ))}
            </select>
            <select value={classNo} onChange={(event) => setClassNo(event.target.value)} aria-label="반">
              {["1", "2", "3", "4", "5", "6"].map((item) => (
                <option key={item} value={item}>
                  {item}반
                </option>
              ))}
            </select>
            <button className="mvp-secondary" onClick={() => void searchSchools()} type="button">
              {busy === "school-search" ? <Loader2 size={16} className="mvp-spin" /> : <Search size={16} />}
              검색
            </button>
            <button className="mvp-secondary" onClick={() => void saveClassOnly()} type="button">
              학급 저장
            </button>
          </div>
          <div className="mvp-school-results">
            {schoolResults.length === 0 ? (
              <p>학교명을 검색하면 NEIS 결과가 여기에 표시됩니다.</p>
            ) : (
              schoolResults.map((school) => (
                <button key={`${school.ATPT_OFCDC_SC_CODE}-${school.SD_SCHUL_CODE}`} onClick={() => void connectSchool(school)} type="button">
                  <strong>{school.SCHUL_NM}</strong>
                  <span>{school.ORG_RDNMA ?? school.ATPT_OFCDC_SC_NM}</span>
                  {busy === school.SD_SCHUL_CODE ? <Loader2 size={15} className="mvp-spin" /> : <ChevronRight size={16} />}
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          <h3>2. 학생 등록</h3>
          <p className="mvp-muted">학생 프로필은 실행카드 문장 길이, 시각 단서, 도움 문장 노출 방식에 반영됩니다.</p>
          <div className="mvp-inline-form">
            <input value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="학생 이름 또는 별칭" />
            <select value={profile} onChange={(event) => setProfile(event.target.value)} aria-label="지원 프로필">
              {PROFILE_PRESETS.map((item) => (
                <option key={item.label} value={item.label}>
                  {item.label}
                </option>
              ))}
            </select>
            <button className="mvp-primary" onClick={() => void registerStudent()} type="button">
              {busy === "student" ? <Loader2 size={16} className="mvp-spin" /> : <UserPlus size={16} />}
              학생 등록
            </button>
          </div>
          <div className="mvp-student-chips">
            {context?.students.length ? (
              context.students.map((student) => (
                <span key={student.id}>
                  {student.nickname} · {profileFromStudent(student)}
                </span>
              ))
            ) : (
              <p>등록된 학생이 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function FlowStrip({
  context,
  bundles,
}: {
  context: ApiClassroomContext | null;
  bundles: CardBundle[];
}) {
  const hasSchool = Boolean(context?.school?.schoolCode);
  const hasStudent = Boolean(context?.students.length);
  const hasDraft = bundles.some((bundle) => bundle.card.status === "draft");
  const hasPublished = bundles.some((bundle) => bundle.card.status === "published");
  const hasReport = Object.values(context?.summariesByStudentId ?? {}).some(Boolean);
  const steps = [
    ["학교 연결", hasSchool],
    ["학생 등록", hasStudent],
    ["수업 준비", bundles.length > 0 || hasDraft],
    ["학생 배포", hasPublished],
    ["리포트 확인", hasReport],
  ] as const;
  return (
    <section className="mvp-flow">
      {steps.map(([label, done]) => (
        <div key={label} className={done ? "is-done" : ""}>
          <span>{done ? <Check size={16} /> : null}</span>
          <strong>{label}</strong>
        </div>
      ))}
    </section>
  );
}

function DashboardView({
  context,
  bundles,
  state,
  onMove,
  onRefresh,
  onError,
}: {
  context: ApiClassroomContext | null;
  bundles: CardBundle[];
  state: LoadState;
  onMove: (view: TeacherView, cardId?: string) => void;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const published = bundles.filter((bundle) => bundle.card.status === "published");
  const latest = bundles[0];
  const helpStudents = context?.students.filter((student) => {
    const summary = context.summariesByStudentId?.[student.id];
    return summary && summary.helpRequestCount > 0;
  }).length ?? 0;

  return (
    <>
      <section className="mvp-hero">
        <div>
          <p className="mvp-eyebrow">교실 운영</p>
          <h1>선생님이 만든 실행카드가 학생 화면과 리포트까지 이어져야 합니다</h1>
          <p>학교, 학급, 학생을 정하면 오늘 수업 준비부터 학생 수행 기록과 리포트까지 이어집니다.</p>
        </div>
        <button className="mvp-primary" onClick={() => onMove("prep")} disabled={!context?.students.length || !context?.school?.schoolCode} type="button">
          수업 준비 시작
          <ChevronRight size={18} />
        </button>
      </section>
      <TeacherSetupPanel context={context} onRefresh={onRefresh} onError={onError} />
      <FlowStrip context={context} bundles={bundles} />
      <section className="mvp-metrics">
        <MetricCard icon={Users} label="등록 학생" value={`${context?.students.length ?? 0}명`} detail="학생별 지원 프로필 연결" />
        <MetricCard icon={ClipboardList} label="실행카드" value={`${bundles.length}개`} detail="교사가 생성한 카드" />
        <MetricCard icon={Send} label="배포 과제" value={`${published.length}개`} detail="학생 화면에 노출" />
        <MetricCard icon={BarChart3} label="도움 필요" value={`${helpStudents}명`} detail="로그 기반 집계" />
      </section>
      <section className="mvp-two-col">
        <div className="mvp-panel">
          <div className="mvp-panel-head">
            <div>
              <p className="mvp-eyebrow">최근 실행카드</p>
              <h2>{latest ? latest.card.title : "아직 생성된 카드가 없습니다"}</h2>
            </div>
            {latest ? <span className={latest.card.status === "published" ? "mvp-status is-good" : "mvp-status"}>{latest.card.status === "published" ? "배포됨" : "초안"}</span> : null}
          </div>
          {latest ? (
            <div className="mvp-card-preview">
              <p>{latest.lesson?.assignmentInstruction ?? latest.card.easyExplanation}</p>
              <div className="mvp-badges">
                <span>{latest.card.subject}</span>
                <span>{gradeBand(latest.card.grade)}</span>
                <span className={sourceTypeClass(latest.card.standardJson.sourceType)}>
                  {sourceTypeLabel(latest.card.standardJson.sourceType)}
                </span>
              </div>
              <button className="mvp-secondary" onClick={() => onMove("cards", latest.card.id)} type="button">
                실행카드 편집
              </button>
            </div>
          ) : (
            <EmptyState
              title="수업 준비가 먼저입니다"
              body="학생을 등록한 뒤 수업 내용과 과제 지시문을 입력하면 AI가 실행카드를 생성합니다."
              action={
                <button className="mvp-secondary" onClick={() => onMove("prep")} type="button">
                  수업 준비로 이동
                </button>
              }
            />
          )}
        </div>
        <div className="mvp-panel">
          <div className="mvp-panel-head">
            <div>
              <p className="mvp-eyebrow">수업 흐름</p>
              <h2>학생 수행까지 이어지는 순서</h2>
            </div>
          </div>
          <ol className="mvp-check-list">
            <li>학생이 보는 과제 제목이 교사가 만든 카드와 같아야 합니다.</li>
            <li>완료, 모르겠어요, 다시 쉽게 말해줘, 도움 문장 버튼이 로그로 저장되어야 합니다.</li>
            <li>리포트 수치가 학생 수행 뒤 바뀌어야 합니다.</li>
          </ol>
          <button className="mvp-secondary" onClick={() => void onRefresh()} type="button">
            {state === "loading" ? <Loader2 size={16} className="mvp-spin" /> : <RefreshCw size={16} />}
            현재 데이터 다시 읽기
          </button>
        </div>
      </section>
    </>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article>
      <span>
        <Icon size={20} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function SupportOptionToggles({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const normalized = normalizeSupportOptions(value);
  function toggle(option: SupportOptionKey) {
    const next = normalized.includes(option)
      ? normalized.filter((item) => item !== option)
      : [...normalized, option];
    onChange(normalizeSupportOptions(next));
  }
  return (
    <div className="mvp-option-grid">
      {SUPPORT_OPTION_KEYS.map((option) => (
        <button
          key={option}
          type="button"
          className={normalized.includes(option) ? "is-selected" : ""}
          onClick={() => toggle(option)}
        >
          <Check size={15} />
          {SUPPORT_OPTION_LABELS[option]}
        </button>
      ))}
    </div>
  );
}

function GenerationOverlay({
  subject,
  topic,
  studentName,
}: {
  subject: string;
  topic: string;
  studentName?: string;
}) {
  return (
    <div className="mvp-generation-overlay" role="status" aria-live="polite">
      <div className="mvp-generation-card">
        <img src={DEFAULT_ASSETS.mascot} alt="" />
        <div>
          <p>실행카드를 만들고 있어요</p>
          <h2>{topic || "오늘 수업"} · {subject || "과목"}</h2>
          <span>{studentName ? `${studentName} 학생에게 맞게 조정 중` : "학생 지원 옵션 반영 중"}</span>
        </div>
        <ol>
          <li>교육과정 기준을 자동으로 찾는 중</li>
          <li>개념 → 기초 → 응용 단계로 나누는 중</li>
          <li>확인 질문과 도움 문장을 만드는 중</li>
        </ol>
      </div>
    </div>
  );
}

function LessonPrepView({
  context,
  onGenerated,
  onError,
}: {
  context: ApiClassroomContext | null;
  onGenerated: (cardId: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const firstStudent = context?.students[0] ?? null;
  const [studentId, setStudentId] = useState(firstStudent?.id ?? "");
  const selectedStudent = context?.students.find((student) => student.id === studentId) ?? firstStudent;
  const [subject, setSubject] = useState("");
  const [lessonDate, setLessonDate] = useState(today());
  const [topic, setTopic] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [assignmentInstruction, setAssignmentInstruction] = useState("");
  const [supportOptions, setSupportOptions] = useState<string[]>(supportOptionsFromStudent(firstStudent));
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!studentId && firstStudent?.id) setStudentId(firstStudent.id);
  }, [firstStudent?.id, studentId]);

  useEffect(() => {
    setSupportOptions(supportOptionsFromStudent(selectedStudent));
  }, [selectedStudent?.id]);

  const canGenerate =
    Boolean(context?.teacher?.id && context?.classroom?.id && context?.school?.id) &&
    Boolean(selectedStudent) &&
    subject.trim().length > 0 &&
    topic.trim().length > 0 &&
    lessonContent.trim().length > 0 &&
    assignmentInstruction.trim().length > 0;

  async function generateCard() {
    if (!canGenerate) {
      onError("학생, 과목, 주제, 수업 내용, 과제 지시문을 모두 입력해 주세요.");
      return;
    }
    setBusy("generate");
    try {
      const classroom = context?.classroom;
      const lesson = await requestJson<{ lesson: ApiLesson }>("/api/lessons", {
        method: "POST",
        body: JSON.stringify({
          teacherId: context?.teacher?.id,
          classroomId: classroom?.id,
          schoolId: context?.school?.id,
          gradeBand: gradeBand(classroom?.grade),
          subject: subject.trim(),
          topic: topic.trim(),
          title: topic.trim(),
          lessonDate,
          lessonContent: lessonContent.trim(),
          assignmentInstruction: assignmentInstruction.trim(),
          supportOptions,
          objectives: [lessonContent.trim(), assignmentInstruction.trim()],
        }),
      });

      const generated = await requestJson<{ card: ApiExecutionCard }>("/api/execution-cards/generate", {
        method: "POST",
        body: JSON.stringify({
          lessonId: lesson.lesson.id,
          subject: subject.trim(),
          grade: gradeBand(classroom?.grade),
          gradeBand: gradeBand(classroom?.grade),
          topic: topic.trim(),
          title: topic.trim(),
          lessonContent: lesson.lesson.lessonContent,
          assignmentInstruction: lesson.lesson.assignmentInstruction,
          supportOptions,
          save: true,
        }),
      });
      await onGenerated(generated.card.id);
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "실행카드 생성에 실패했습니다.");
    } finally {
      setBusy("");
    }
  }

  if (!context?.school?.schoolCode || !context.students.length) {
    return (
      <EmptyState
        title="수업 준비 전에 학교와 학생이 필요합니다"
        body="교실 운영 화면에서 학교와 학급을 연결하고 이번 수업을 함께 볼 학생을 먼저 등록하세요."
      />
    );
  }

  return (
    <section className="mvp-panel mvp-prep">
      <div className="mvp-panel-head">
        <div>
          <p className="mvp-eyebrow">수업 준비</p>
          <h1>학생 한 명을 기준으로 실행카드를 만듭니다</h1>
          <p>수업 내용과 과제 지시문을 입력하면 교육과정 기준은 AI가 자동으로 찾아 연결합니다.</p>
        </div>
        <button className="mvp-primary" onClick={() => void generateCard()} disabled={!canGenerate || busy === "generate"} type="button">
          {busy === "generate" ? <Loader2 size={17} className="mvp-spin" /> : <Send size={17} />}
          실행카드 생성
        </button>
      </div>
      {busy === "generate" ? (
        <GenerationOverlay subject={subject.trim()} topic={topic.trim()} studentName={selectedStudent?.nickname} />
      ) : null}
      <div className="mvp-form-grid">
        <label>
          학생
          <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
            {context.students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.nickname} · {profileFromStudent(student)}
              </option>
            ))}
          </select>
        </label>
        <label>
          과목
          <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="과목 입력" />
        </label>
        <label>
          수업일
          <input type="date" value={lessonDate} onChange={(event) => setLessonDate(event.target.value)} />
        </label>
        <label>
          주제
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="수업 주제 입력" />
        </label>
      </div>
      <label className="mvp-wide-label">
        수업 내용
        <textarea value={lessonContent} onChange={(event) => setLessonContent(event.target.value)} placeholder="오늘 수업에서 다룰 개념과 활동을 입력하세요." rows={4} />
      </label>
      <label className="mvp-wide-label">
        과제 지시문
        <textarea value={assignmentInstruction} onChange={(event) => setAssignmentInstruction(event.target.value)} placeholder="학생이 실제로 수행해야 하는 과제 지시문을 입력하세요." rows={4} />
      </label>
      <div className="mvp-split">
        <section>
          <div className="mvp-mini-head">
            <h3>교육과정 기준 자동 연결</h3>
            <p>별도 검색 없이 주제, 수업 내용, 과제 지시문을 벡터 검색해 가장 가까운 기준을 연결합니다.</p>
          </div>
          <div className="mvp-auto-rag-note">
            <span>자동 RAG</span>
            <strong>{subject.trim() || "과목"} · {topic.trim() || "수업 주제"}</strong>
            <p>생성 후 실행카드 편집 화면에서 연결된 교육과정 기준을 확인할 수 있습니다.</p>
          </div>
        </section>
        <section>
          <div className="mvp-mini-head">
            <h3>학생 지원 옵션</h3>
            <p>{selectedStudent ? `${selectedStudent.nickname}: ${profileFromStudent(selectedStudent)}` : "학생을 선택하세요."}</p>
          </div>
          <SupportOptionToggles value={supportOptions} onChange={setSupportOptions} />
        </section>
      </div>
    </section>
  );
}

type EditableCard = {
  title: string;
  goal: string;
  subject: string;
  grade: string;
  topic: string;
  standard: ApiExecutionCard["standardJson"];
  easyExplanation: string;
  keywords: ApiExecutionCard["keywordsJson"];
  review: ApiExecutionCard["reviewJson"];
  steps: Array<{
    id?: string;
    stepText: string;
    visualHint: VisualHint;
    microQuiz: MicroQuiz;
    helpSentence: string;
    teacherTip: string;
  }>;
};

function editableFromBundle(bundle?: CardBundle | null): EditableCard | null {
  if (!bundle) return null;
  return {
    title: bundle.card.title,
    goal: bundle.card.goal,
    subject: bundle.card.subject,
    grade: bundle.card.grade,
    topic: bundle.card.topic,
    standard: bundle.card.standardJson,
    easyExplanation: bundle.card.easyExplanation,
    keywords: bundle.card.keywordsJson,
    review: bundle.card.reviewJson,
    steps: bundle.steps.map((step) => ({
      id: step.id,
      stepText: step.stepText,
      visualHint: step.visualHintJson,
      microQuiz: step.microQuizJson,
      helpSentence: step.helpSentence,
      teacherTip: step.teacherTip,
    })),
  };
}

function CardEditorView({
  bundle,
  onSaved,
  onMove,
  onError,
}: {
  bundle: CardBundle | null;
  onSaved: (cardId: string) => Promise<void>;
  onMove: (view: TeacherView, cardId?: string) => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState<EditableCard | null>(() => editableFromBundle(bundle));
  const [selectedStep, setSelectedStep] = useState(0);
  const [state, setState] = useState<LoadState>("idle");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(editableFromBundle(bundle));
    setSelectedStep(0);
    setDirty(false);
  }, [bundle?.card.id]);

  if (!bundle || !draft) {
    return (
      <EmptyState
        title="편집할 실행카드가 없습니다"
        body="수업 준비 화면에서 먼저 학생별 실행카드를 생성하세요."
        action={
          <button className="mvp-secondary" onClick={() => onMove("prep")} type="button">
            수업 준비로 이동
          </button>
        }
      />
    );
  }
  const currentBundle = bundle;
  const currentDraft = draft;

  function patchDraft(next: Partial<EditableCard>) {
    setDraft((current) => (current ? { ...current, ...next } : current));
    setDirty(true);
  }

  function updateStep(index: number, next: Partial<EditableCard["steps"][number]>) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        steps: current.steps.map((step, stepIndex) => (stepIndex === index ? { ...step, ...next } : step)),
      };
    });
    setDirty(true);
  }

  function updateQuiz(index: number, next: Partial<MicroQuiz>) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        steps: current.steps.map((step, stepIndex) =>
          stepIndex === index ? { ...step, microQuiz: { ...step.microQuiz, ...next } } : step,
        ),
      };
    });
    setDirty(true);
  }

  function moveStep(index: number, direction: -1 | 1) {
    setDraft((current) => {
      if (!current) return current;
      const target = index + direction;
      if (target < 0 || target >= current.steps.length) return current;
      const steps = [...current.steps];
      const [item] = steps.splice(index, 1);
      steps.splice(target, 0, item);
      setSelectedStep(target);
      return { ...current, steps };
    });
    setDirty(true);
  }

  function deleteStep(index: number) {
    if (currentDraft.steps.length <= 3) {
      onError("실행카드는 최소 3단계를 유지해야 합니다.");
      return;
    }
    setDraft((current) => current ? { ...current, steps: current.steps.filter((_, stepIndex) => stepIndex !== index) } : current);
    setSelectedStep((current) => Math.max(0, Math.min(current, currentDraft.steps.length - 2)));
    setDirty(true);
  }

  function addStep() {
    if (currentDraft.steps.length >= 5) {
      onError("실행카드는 최대 5단계까지 유지합니다.");
      return;
    }
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        steps: [
          ...current.steps,
          {
            stepText: "학생이 바로 할 수 있는 다음 행동을 입력하세요.",
            visualHint: { type: "text_only", data: { text: "현재 단계에서 볼 단서" } },
            microQuiz: { question: "지금 확인할 것은 무엇인가요?", choices: ["현재 단계", "다른 과제"], answer: "현재 단계" },
            helpSentence: "선생님, 이 단계를 다시 확인하고 싶어요.",
            teacherTip: "학생이 혼자 시작할 수 있도록 첫 행동만 짚어 주세요.",
          },
        ],
      };
    });
    setSelectedStep(currentDraft.steps.length);
    setDirty(true);
  }

  async function save(status?: "draft" | "published") {
    setState("saving");
    try {
      const body = {
        title: currentDraft.title,
        goal: currentDraft.goal,
        subject: currentDraft.subject,
        grade: currentDraft.grade,
        topic: currentDraft.topic,
        standard: currentDraft.standard,
        keywords: currentDraft.keywords,
        easyExplanation: currentDraft.easyExplanation,
        review: currentDraft.review,
        status,
        steps: currentDraft.steps.map((step, index) => ({
          id: step.id,
          order: index + 1,
          stepText: step.stepText,
          visualHint: step.visualHint,
          microQuiz: step.microQuiz,
          helpSentence: step.helpSentence,
          teacherTip: step.teacherTip,
        })),
      };
      await requestJson(`/api/execution-cards/${currentBundle.card.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (status === "published") {
        await requestJson(`/api/execution-cards/${currentBundle.card.id}/publish`, { method: "POST" });
      }
      await onSaved(currentBundle.card.id);
      setDirty(false);
      setState("idle");
      onError("");
    } catch (error) {
      setState("error");
      onError(error instanceof Error ? error.message : "실행카드 저장에 실패했습니다.");
    }
  }

  const previewStep = currentDraft.steps[selectedStep] ?? currentDraft.steps[0];
  const studentLink = `/student/tasks/${encodeURIComponent(currentBundle.card.id)}`;

  return (
    <section className="mvp-editor">
      <div className="mvp-editor-main">
        <div className="mvp-panel">
          <div className="mvp-panel-head">
            <div>
              <p className="mvp-eyebrow">실행카드 편집</p>
              <h1>{draft.title}</h1>
              <p>교사가 수정한 내용은 저장 후 새로고침해도 유지되고, 배포하면 학생 화면에 바로 반영됩니다.</p>
            </div>
            <div className="mvp-editor-actions">
              <span className={bundle.card.status === "published" ? "mvp-status is-good" : "mvp-status"}>
                {bundle.card.status === "published" ? "배포됨" : dirty ? "수정 중" : "초안"}
              </span>
              <button className="mvp-secondary" onClick={() => void save()} disabled={state === "saving"} type="button">
                <Save size={16} />
                저장
              </button>
              <button className="mvp-primary" onClick={() => void save("published")} disabled={state === "saving"} type="button">
                <Send size={16} />
                학생에게 배포
              </button>
            </div>
          </div>
          <div className="mvp-form-grid">
            <label>
              제목
              <input value={draft.title} onChange={(event) => patchDraft({ title: event.target.value })} />
            </label>
          </div>
          <label className="mvp-wide-label">
            학생이 볼 자료/문제
            <textarea value={draft.goal} onChange={(event) => patchDraft({ goal: event.target.value })} rows={5} />
          </label>
          <label className="mvp-wide-label">
            쉬운 설명
            <textarea value={draft.easyExplanation} onChange={(event) => patchDraft({ easyExplanation: event.target.value })} rows={3} />
          </label>
          <div className="mvp-standard-box">
            <strong>{draft.standard.code ?? draft.standard.id ?? "선택한 성취기준"}</strong>
            <p>{draft.standard.text}</p>
            <span className={sourceTypeClass(draft.standard.sourceType)}>{sourceTypeLabel(draft.standard.sourceType)}</span>
            <small>
              {cleanSourceName(draft.standard.sourceName)}
              {cleanLicenseLabel(draft.standard.license) ? ` · ${cleanLicenseLabel(draft.standard.license)}` : ""}
            </small>
          </div>
          <div className="mvp-step-toolbar">
            <h2>단계 {draft.steps.length}개</h2>
            <button className="mvp-secondary" onClick={addStep} type="button">
              <Plus size={16} />
              단계 추가
            </button>
          </div>
          <div className="mvp-step-list">
            {draft.steps.map((step, index) => (
              <article key={step.id ?? index} className={selectedStep === index ? "is-active" : ""}>
                <button className="mvp-step-selector" onClick={() => setSelectedStep(index)} type="button">
                  <span>{index + 1}</span>
                  <strong>{step.stepText}</strong>
                </button>
                <div className="mvp-step-fields">
                  <label>
                    학생 행동
                    <input value={step.stepText} onChange={(event) => updateStep(index, { stepText: event.target.value })} />
                  </label>
                  <label>
                    확인 질문
                    <input value={step.microQuiz.question} onChange={(event) => updateQuiz(index, { question: event.target.value })} />
                  </label>
                  <label>
                    선택지
                    <input value={step.microQuiz.choices.join(" / ")} onChange={(event) => updateQuiz(index, { choices: event.target.value.split("/").map((item) => item.trim()).filter(Boolean) })} />
                  </label>
                  <label>
                    정답
                    <input value={step.microQuiz.answer} onChange={(event) => updateQuiz(index, { answer: event.target.value })} />
                  </label>
                  <label>
                    도움 문장
                    <input value={step.helpSentence} onChange={(event) => updateStep(index, { helpSentence: event.target.value })} />
                  </label>
                  <label>
                    교사용 팁
                    <input value={step.teacherTip} onChange={(event) => updateStep(index, { teacherTip: event.target.value })} />
                  </label>
                </div>
                <div className="mvp-row-actions">
                  <button onClick={() => moveStep(index, -1)} disabled={index === 0} type="button">
                    위로
                  </button>
                  <button onClick={() => moveStep(index, 1)} disabled={index === draft.steps.length - 1} type="button">
                    아래로
                  </button>
                  <button onClick={() => deleteStep(index)} disabled={draft.steps.length <= 3} type="button">
                    <Trash2 size={15} />
                    삭제
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
      <aside className="mvp-editor-side">
        <StudentMiniPreview card={draft} step={previewStep} stepIndex={selectedStep} />
        {bundle.card.status === "published" ? (
          <a className="mvp-student-link" href={studentLink}>
            학생 화면 열기
            <ChevronRight size={16} />
          </a>
        ) : (
          <p className="mvp-muted">배포 전에는 학생 화면에 노출되지 않습니다.</p>
        )}
      </aside>
    </section>
  );
}

function StudentMiniPreview({
  card,
  step,
  stepIndex,
}: {
  card: EditableCard;
  step: EditableCard["steps"][number];
  stepIndex: number;
}) {
  return (
    <div className="mvp-mini-phone">
      <div className="mvp-mini-brand">
        <img src={DEFAULT_ASSETS.logo} alt="" />
        <strong>다음한걸음</strong>
      </div>
      <div className="mvp-mini-card">
        <div className="mvp-badges">
          <span>{card.subject}</span>
          <span>{gradeBand(card.grade)}</span>
        </div>
        <h3>{card.title}</h3>
        <p>{card.easyExplanation}</p>
      </div>
      <div className="mvp-mini-material">
        {card.goal.split("\n").filter(Boolean).slice(0, 3).join("\n")}
      </div>
      <div className="mvp-mini-step">
        <span>{stepIndex + 1}단계</span>
        <h4>{step.stepText}</h4>
        <VisualHintView hint={step.visualHint} compact />
        <button type="button">완료했어요</button>
      </div>
    </div>
  );
}

function ReportsView({
  context,
  bundles,
  initialStudentId,
  onError,
}: {
  context: ApiClassroomContext | null;
  bundles: CardBundle[];
  initialStudentId?: string;
  onError: (message: string) => void;
}) {
  const [studentId, setStudentId] = useState(initialStudentId ?? context?.students[0]?.id ?? "");
  const [cardId, setCardId] = useState(context?.activeCardId ?? bundles[0]?.card.id ?? "");
  const [report, setReport] = useState<ApiReport | null>(null);
  const [state, setState] = useState<LoadState>("idle");

  useEffect(() => {
    if (initialStudentId) setStudentId(initialStudentId);
  }, [initialStudentId]);

  useEffect(() => {
    if (!studentId && context?.students[0]?.id) setStudentId(context.students[0].id);
    if (!cardId && bundles[0]?.card.id) setCardId(bundles[0].card.id);
  }, [context?.students, bundles, cardId, studentId]);

  useEffect(() => {
    if (!studentId || !cardId) return;
    let alive = true;
    setState("loading");
    requestJson<ApiReport>(`/api/reports/students/${encodeURIComponent(studentId)}?cardId=${encodeURIComponent(cardId)}`)
      .then((next) => {
        if (!alive) return;
        setReport(next);
        setState("idle");
        onError("");
      })
      .catch((error) => {
        if (!alive) return;
        setReport(null);
        setState("error");
        onError(error instanceof Error ? error.message : "리포트를 불러오지 못했습니다.");
      });
    return () => {
      alive = false;
    };
  }, [studentId, cardId, onError]);

  if (!context?.students.length || !bundles.length) {
    return (
      <EmptyState
        title="리포트에 필요한 학생과 카드가 없습니다"
        body="학생을 등록하고 실행카드를 배포한 뒤 학생 화면에서 수행 로그를 남기세요."
      />
    );
  }

  return (
    <section className="mvp-panel mvp-report">
      <div className="mvp-panel-head">
        <div>
          <p className="mvp-eyebrow">학생 리포트</p>
          <h1>수행 로그가 학생 지원 전략으로 바뀝니다</h1>
        </div>
        {state === "loading" ? <Loader2 size={20} className="mvp-spin" /> : null}
      </div>
      <div className="mvp-form-grid">
        <label>
          학생
          <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
            {context.students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.nickname}
              </option>
            ))}
          </select>
        </label>
        <label>
          실행카드
          <select value={cardId} onChange={(event) => setCardId(event.target.value)}>
            {bundles.map((bundle) => (
              <option key={bundle.card.id} value={bundle.card.id}>
                {bundle.card.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {report ? (
        <>
          <section className="mvp-metrics">
            <MetricCard icon={Check} label="완료율" value={`${report.summary.completionRate}%`} detail="완료 단계 / 전체 단계" />
            <MetricCard icon={Headphones} label="도움 요청" value={`${report.summary.helpRequestCount}회`} detail="막힘, 쉬운 설명, 도움 문장" />
            <MetricCard icon={BookOpen} label="퀴즈" value={`${report.summary.correctQuizCount}/${report.summary.totalQuizCount}`} detail="정답 / 응답" />
            <MetricCard icon={BarChart3} label="막힌 단계" value={`${report.summary.stuckStepCount}개`} detail={formatSeconds(report.summary.totalTimeSeconds)} />
          </section>
          <section className="mvp-report-summary-card">
            <strong>리포트 요약</strong>
            <p>{report.report.summary}</p>
          </section>
          <div className="mvp-split">
            <section>
              <h3>단계별 수행 흐름</h3>
              <div className="mvp-report-steps">
                {report.perStep.map((item) => {
                  const helpCount = item.confusedCount + item.simplifyCount + (item.helpSentenceViewedCount ?? 0);
                  const attention = helpCount > 0 || (item.quizAnswered && !item.isCorrect) || !item.isCompleted;
                  return (
                    <article key={item.step.id} className={attention ? "is-attention" : ""}>
                      <span>{item.step.order}</span>
                      <div>
                        <strong>{item.step.stepText}</strong>
                        <small>
                          {item.isCompleted ? "완료됨" : "진행 전"} · 도움 {helpCount}회 · 퀴즈{" "}
                          {item.quizAnswered ? (item.isCorrect ? "정답" : "오답") : "미응답"} · 소요{" "}
                          {formatSeconds(item.timeSeconds)}
                        </small>
                        {attention ? (
                          <div className="mvp-step-flags">
                            {item.confusedCount ? <b>모르겠어요 {item.confusedCount}회</b> : null}
                            {item.simplifyCount ? <b>쉬운 설명 {item.simplifyCount}회</b> : null}
                            {item.helpSentenceViewedCount ? <b>도움 문장 {item.helpSentenceViewedCount}회</b> : null}
                            {item.quizAnswered && !item.isCorrect ? <b>퀴즈 오답</b> : null}
                            {!item.isCompleted ? <b>미완료</b> : null}
                          </div>
                        ) : null}
                        {item.studentResponse ? <em>학생 답: {item.studentResponse}</em> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
            <section>
              <h3>AI 추천 지원</h3>
              <div className="mvp-tag-row">
                {report.report.difficultyTagsJson.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <ul className="mvp-recommendations">
                {report.report.aiRecommendationsJson.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="mvp-parent-memo">
                <strong>보호자 공유 메모</strong>
                <p>{report.report.parentMemo}</p>
              </div>
            </section>
          </div>
        </>
      ) : (
        <EmptyState title="아직 분석할 로그가 없습니다" body="학생 화면에서 한 단계 이상 수행하면 리포트가 갱신됩니다." />
      )}
    </section>
  );
}

export function TeacherApp({
  initialView = "dashboard",
  initialCardId,
  initialStudentId,
}: {
  initialView?: TeacherView;
  initialCardId?: string;
  initialStudentId?: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<TeacherView>(initialView);
  const [context, setContext] = useState<ApiClassroomContext | null>(null);
  const [bundles, setBundles] = useState<CardBundle[]>([]);
  const [activeCardId, setActiveCardId] = useState(initialCardId ?? "");
  const [reportStudentId, setReportStudentId] = useState(initialStudentId ?? "");
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");

  async function refresh(preferredCardId = activeCardId) {
    setState("loading");
    try {
      const [contextResult, lessonResult, cardResult] = await Promise.all([
        requestJson<ApiClassroomContext>("/api/classroom/context"),
        requestJson<{ lessons: ApiLesson[] }>("/api/lessons"),
        requestJson<{ cards: ApiExecutionCard[] }>("/api/execution-cards"),
      ]);
      const lessonMap = new Map(lessonResult.lessons.map((lesson) => [lesson.id, lesson]));
      const details = await Promise.all(
        cardResult.cards.map(async (card) => {
          const detail = await requestJson<{ card: ApiExecutionCard; steps: ApiExecutionStep[] }>(
            `/api/execution-cards/${encodeURIComponent(card.id)}`,
          );
          return { card: detail.card, steps: detail.steps, lesson: lessonMap.get(detail.card.lessonId) ?? null };
        }),
      );
      setContext(contextResult);
      setBundles(details);
      const nextActive = preferredCardId && details.some((bundle) => bundle.card.id === preferredCardId)
        ? preferredCardId
        : contextResult.activeCardId && details.some((bundle) => bundle.card.id === contextResult.activeCardId)
          ? contextResult.activeCardId
          : details[0]?.card.id ?? "";
      setActiveCardId(nextActive);
      setError("");
      setState("idle");
    } catch (error) {
      setState("error");
      setError(error instanceof Error ? error.message : "초기 데이터를 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    setView(initialView);
    if (initialCardId) setActiveCardId(initialCardId);
    if (initialStudentId) setReportStudentId(initialStudentId);
  }, [initialView, initialCardId]);

  useEffect(() => {
    void refresh(initialCardId);
  }, []);

  function move(next: TeacherView, cardId?: string) {
    setView(next);
    if (cardId) setActiveCardId(cardId);
    if (next === "dashboard") router.push("/teacher/dashboard");
    if (next === "prep") router.push("/teacher/lessons/new");
    if (next === "cards") router.push(cardId ? `/teacher/cards/${encodeURIComponent(cardId)}/edit` : "/teacher/cards");
    if (next === "reports") {
      const studentId = initialStudentId ?? context?.students[0]?.id;
      if (studentId) setReportStudentId(studentId);
      router.push(studentId ? `/teacher/reports/${encodeURIComponent(studentId)}` : "/teacher/reports");
    }
  }

  function openStudentReport(studentId: string) {
    setReportStudentId(studentId);
    setView("reports");
    router.push(`/teacher/reports/${encodeURIComponent(studentId)}`);
  }

  const activeBundle = bundles.find((bundle) => bundle.card.id === activeCardId) ?? bundles[0] ?? null;

  return (
    <main className="mvp-app mvp-teacher-app">
      <TeacherNav view={view} onMove={move} context={context} bundles={bundles} onOpenReport={openStudentReport} />
      <section className="mvp-teacher-main">
        <TopBar context={context} state={state} onRefresh={() => void refresh(activeCardId)} />
        <ErrorBanner message={error} onRetry={() => void refresh(activeCardId)} />
        {view === "dashboard" ? (
          <DashboardView context={context} bundles={bundles} state={state} onMove={move} onRefresh={() => refresh(activeCardId)} onError={setError} />
        ) : null}
        {view === "prep" ? (
          <LessonPrepView
            context={context}
            onError={setError}
            onGenerated={async (cardId) => {
              await refresh(cardId);
              move("cards", cardId);
            }}
          />
        ) : null}
        {view === "cards" ? (
          <CardEditorView bundle={activeBundle} onError={setError} onMove={move} onSaved={(cardId) => refresh(cardId)} />
        ) : null}
        {view === "reports" ? (
          <ReportsView context={context} bundles={bundles} initialStudentId={reportStudentId || initialStudentId} onError={setError} />
        ) : null}
      </section>
    </main>
  );
}

function StudentTop({ student }: { student?: ApiStudent | null }) {
  return (
    <header className="mvp-phone-top">
      <div className="mvp-brand">
        <img src={DEFAULT_ASSETS.logo} alt="" />
        <strong>다음한걸음</strong>
      </div>
      <span>{student?.nickname ?? "학생"}</span>
    </header>
  );
}

function StudentBottom({
  active,
  onMove,
}: {
  active: StudentView;
  onMove: (view: StudentView) => void;
}) {
  return (
    <nav className="mvp-phone-bottom">
      {[
        ["task", "과제", ClipboardList],
        ["review", "돌아보기", BarChart3],
      ].map(([id, label, Icon]) => (
        <button key={id as string} className={active === id ? "is-active" : ""} onClick={() => onMove(id as StudentView)} type="button">
          <Icon size={19} />
          {label as string}
        </button>
      ))}
    </nav>
  );
}

function VisualHintView({ hint, compact = false }: { hint?: VisualHint | null; compact?: boolean }) {
  if (!hint) return null;
  if (hint.type === "image_asset" && hint.assetUrl) {
    return <img className="mvp-hint-image" src={hint.assetUrl} alt={hint.alt ?? "시각 단서"} />;
  }
  if (hint.type === "rectangle_dimension") {
    const labels = getStepItems(hint.data);
    const [firstLabel, secondLabel] = labels.length >= 2 ? labels : ["긴 변", "짧은 변"];
    return (
      <div className={compact ? "mvp-visual is-compact" : "mvp-visual"}>
        <svg viewBox="0 0 320 180" role="img" aria-label={hint.alt ?? "도형 시각 단서"}>
          <rect x="48" y="58" width="210" height="82" fill="#f8fbff" stroke="#147eea" strokeWidth="4" rx="5" />
          <line x1="52" y1="38" x2="254" y2="38" stroke="#147eea" strokeWidth="4" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
          <line x1="278" y1="62" x2="278" y2="136" stroke="#00a6a8" strokeWidth="4" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#147eea" />
            </marker>
          </defs>
          <text x="155" y="28" textAnchor="middle" fill="#147eea" fontWeight="800" fontSize="22">{firstLabel}</text>
          <text x="300" y="106" textAnchor="middle" fill="#00a6a8" fontWeight="800" fontSize="22">{secondLabel}</text>
        </svg>
      </div>
    );
  }
  if (hint.type === "number_line") {
    return (
      <div className={compact ? "mvp-visual is-compact" : "mvp-visual"}>
        <svg viewBox="0 0 320 120" role="img" aria-label={hint.alt ?? "수직선 시각 단서"}>
          <line x1="38" y1="64" x2="282" y2="64" stroke="#147eea" strokeWidth="5" strokeLinecap="round" />
          {[0, 1, 2, 3, 4].map((item) => (
            <g key={item}>
              <line x1={38 + item * 61} y1="52" x2={38 + item * 61} y2="76" stroke="#0f172a" strokeWidth="3" />
              <text x={38 + item * 61} y="102" textAnchor="middle" fontSize="18" fontWeight="800">
                {item === 0 ? "0" : `${item}/4`}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  }
  if (hint.type === "sequence_checklist") {
    const items = getStepItems(hint.data);
    return (
      <div className="mvp-sequence-hint">
        {(items.length ? items : ["첫 행동 확인", "다음 행동 선택", "답 확인"]).slice(0, 5).map((item, index) => (
          <span key={`${item}-${index}`}>
            <b>{index + 1}</b>
            {item}
          </span>
        ))}
      </div>
    );
  }
  const text = getHintText(hint.data);
  return <div className="mvp-text-hint">{text || hint.alt || "이 단계에서 볼 단서를 확인해요."}</div>;
}

function materialLabelFor(card: ApiExecutionCard) {
  const key = `${card.subject} ${card.topic} ${card.title}`;
  if (key.includes("국어") || key.includes("인물") || key.includes("문장")) return "읽을 글";
  if (key.includes("수학") || key.includes("계산") || key.includes("둘레") || key.includes("분수")) return "풀 문제";
  if (key.includes("과학") || key.includes("식물") || key.includes("관찰")) return "살펴볼 자료";
  if (key.includes("생활") || key.includes("준비물") || key.includes("규칙")) return "상황";
  return "학습 자료";
}

function responseForStep(logs: ApiStudentLog[], stepId: string) {
  const log = [...logs].reverse().find((item) => item.stepId === stepId && item.eventType === "completed");
  const value = log?.payloadJson.studentResponse;
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function stepNeedsWrittenResponse(step: ApiExecutionStep) {
  const text = [step.stepText, step.microQuizJson.question].join(" ");
  return /써|쓰기|적|기록|문장|이유|답|생각|설명|계산|구해|구분|찾/.test(text);
}

function responsePlaceholder(step: ApiExecutionStep, task: ApiStudentTask) {
  const text = `${task.card.subject} ${task.card.topic} ${step.stepText}`;
  if (/국어|글|문장|인물|마음/.test(text)) return "내가 찾은 문장과 이유를 짧게 적어요.";
  if (/수학|계산|문제|분수|비례|도형|둘레/.test(text)) return "식이나 답을 한 줄로 적어요.";
  if (/과학|관찰|실험|자료/.test(text)) return "본 것과 알게 된 점을 적어요.";
  return "내가 한 생각이나 답을 짧게 적어요.";
}

function StudentTaskScreen({
  task,
  reload,
  goReview,
  onError,
}: {
  task: ApiStudentTask;
  reload: () => Promise<void>;
  goReview: () => void;
  onError: (message: string) => void;
}) {
  const completed = new Set(task.logs.filter((log) => log.eventType === "completed").map((log) => log.stepId));
  const currentIndex = Math.max(0, task.steps.findIndex((step) => !completed.has(step.id)));
  const allDone = task.steps.length > 0 && task.steps.every((step) => completed.has(step.id));
  const step = allDone ? task.steps[task.steps.length - 1] : task.steps[currentIndex] ?? task.steps[0];
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [voiceState, setVoiceState] = useState("");
  const [currentResponse, setCurrentResponse] = useState("");
  const [revealedHelpStepId, setRevealedHelpStepId] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!step?.id || allDone) return;
    const hasStarted = task.logs.some((log) => log.stepId === step.id && log.eventType === "started");
    if (hasStarted) return;
    void requestJson(`/api/student/tasks/${task.card.id}/steps/${step.id}/start${studentQuery(task.studentId)}`, { method: "POST" }).catch(() => undefined);
  }, [task.card.id, task.studentId, task.logs, step?.id, allDone]);

  useEffect(() => {
    if (!step?.id) return;
    setCurrentResponse(responseForStep(task.logs, step.id));
    setSelectedAnswer("");
    setFeedback("");
    setRevealedHelpStepId("");
  }, [step?.id]);

  async function action(kind: "confused" | "simplify" | "help-sentence" | "complete") {
    if (!step) return;
    const needsResponse = stepNeedsWrittenResponse(step);
    if (kind === "complete" && needsResponse && !currentResponse.trim()) {
      setFeedback("한 문장만 적고 완료해요.");
      return;
    }
    setBusy(kind);
    try {
      const result = await requestJson<{ easyText?: string; helpSentence?: string }>(
        `/api/student/tasks/${task.card.id}/steps/${step.id}/${kind}${studentQuery(task.studentId)}`,
        kind === "complete"
          ? { method: "POST", body: JSON.stringify({ studentResponse: currentResponse.trim() }) }
          : { method: "POST" },
      );
      if (kind === "simplify") setFeedback(result.easyText ?? "한 번에 한 행동만 확인해요.");
      if (kind === "help-sentence") {
        setRevealedHelpStepId(step.id);
        setFeedback("도움 문장을 열었어요. 이 기록은 선생님 리포트에 남아요.");
      }
      if (kind === "confused") setFeedback("괜찮아요. 지금 막힌 순간이 선생님 리포트에 기록됐어요.");
      if (kind === "complete") {
        setFeedback("");
        setSelectedAnswer("");
      }
      await reload();
      onError("");
      if (kind === "complete" && task.steps.every((item) => item.id === step.id || completed.has(item.id))) {
        await requestJson(`/api/student/tasks/${task.card.id}/review${studentQuery(task.studentId)}`, { method: "POST" });
        goReview();
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "학생 로그 저장에 실패했습니다.");
    } finally {
      setBusy("");
    }
  }

  async function submitQuiz(answer: string) {
    if (!step) return;
    setSelectedAnswer(answer);
    setBusy("quiz");
    try {
      const result = await requestJson<{ isCorrect: boolean }>(
        `/api/student/tasks/${task.card.id}/steps/${step.id}/quiz${studentQuery(task.studentId)}`,
        {
          method: "POST",
          body: JSON.stringify({ answer }),
        },
      );
      setFeedback(result.isCorrect ? "맞았어요. 이제 완료 버튼을 눌러도 좋아요." : step.microQuizJson.explanation ?? "다시 쉽게 설명을 보고 한 번 더 확인해요.");
      await reload();
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "퀴즈 응답 저장에 실패했습니다.");
    } finally {
      setBusy("");
    }
  }

  async function playVoice() {
    if (!step?.helpSentence) return;
    setVoiceState("loading");
    try {
      const response = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: step.helpSentence }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error?.message ?? "음성 생성에 실패했습니다.");
      }
      const blob = await response.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      await audio.play();
      setVoiceState("played");
    } catch (error) {
      setVoiceState(error instanceof Error ? error.message : "음성 생성에 실패했습니다.");
    }
  }

  async function retryTask() {
    setBusy("retry");
    try {
      await requestJson(`/api/student/tasks/${task.card.id}/retry${studentQuery(task.studentId)}`, { method: "POST" });
      setFeedback("");
      setSelectedAnswer("");
      await reload();
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "과제를 다시 시작하지 못했습니다.");
    } finally {
      setBusy("");
    }
  }

  if (!step) {
    return <EmptyState title="배포된 단계가 없습니다" body="선생님이 실행카드를 배포하면 여기에 표시됩니다." />;
  }

  const progress = task.steps.length ? Math.round((completed.size / task.steps.length) * 100) : 0;
  const supportOptions = normalizeSupportOptions(task.card.supportOptionsJson);
  const needsResponse = stepNeedsWrittenResponse(step);
  const helpSentenceViewed = task.logs.some(
    (log) => log.stepId === step.id && log.eventType === "help_sentence_viewed",
  );
  const showHelpSentence = revealedHelpStepId === step.id || helpSentenceViewed;

  if (allDone) {
    const completedStepCount = completed.size;
    const helpCount = task.summary?.helpRequestCount ?? task.logs.filter((log) =>
      ["confused", "simplify", "help_sentence_viewed"].includes(log.eventType)
    ).length;
    const correctQuizCount = task.summary?.correctQuizCount ?? task.logs.filter((log) =>
      log.eventType === "quiz_answered" && log.payloadJson?.isCorrect === true
    ).length;
    const totalQuizCount = task.summary?.totalQuizCount ?? task.logs.filter((log) => log.eventType === "quiz_answered").length;
    const review = task.summary?.generatedReviewJson ?? task.card.reviewJson;
    const reviewPoints = review.goodPoints.length ? review.goodPoints : ["오늘 과제를 끝까지 해냈어요."];
    const nextReview = review.nextReview[0];
    const writtenResponses = task.steps
      .map((item) => ({ step: item, response: responseForStep(task.logs, item.id) }))
      .filter((item) => item.response);

    return (
      <section className="mvp-student-complete">
        <div className="mvp-complete-hero">
          <img src={DEFAULT_ASSETS.mascot} alt="" />
          <div>
            <p>과제 완료</p>
            <h1>오늘 한 걸음을 끝냈어요</h1>
            <strong>{task.card.title}</strong>
          </div>
        </div>
        <div className="mvp-complete-metrics">
          <span>
            <b>{completedStepCount}/{task.steps.length}</b>
            완료 단계
          </span>
          <span>
            <b>{helpCount}회</b>
            도움 기록
          </span>
          <span>
            <b>{correctQuizCount}/{totalQuizCount || task.steps.length}</b>
            확인 퀴즈
          </span>
        </div>
        <div className="mvp-complete-steps">
          <p>오늘 한 일</p>
          {task.steps.map((item) => (
            <span key={item.id}>
              <CheckCircle2 size={15} />
              {item.stepText}
            </span>
          ))}
        </div>
        {writtenResponses.length ? (
          <div className="mvp-complete-responses">
            <p>내가 쓴 답</p>
            {writtenResponses.map(({ step: item, response }) => (
              <span key={item.id}>
                <b>{item.order}단계</b>
                {response}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mvp-complete-review">
          <p>돌아보기</p>
          {reviewPoints.slice(0, 2).map((item) => (
            <span key={item}>{item}</span>
          ))}
          {nextReview ? <span>다음에 다시 보기: {nextReview.description}</span> : null}
          <strong>{review.askTeacherSentence}</strong>
        </div>
        <div className="mvp-complete-actions">
          <button onClick={() => void retryTask()} disabled={Boolean(busy)} type="button">
            처음부터 다시 하기
          </button>
          <button className="mvp-primary" onClick={goReview} disabled={Boolean(busy)} type="button">
            돌아보기 열기
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mvp-student-task">
      <div className="mvp-task-head">
        <div>
          <p>{formatDate(task.lesson?.lessonDate)} · {task.card.subject} · {gradeBand(task.card.grade)}</p>
          <h1>{task.card.title}</h1>
        </div>
        <img src={DEFAULT_ASSETS.mascot} alt="" />
      </div>
      <div className="mvp-progress">
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="mvp-progress-label">완료 단계 {completed.size}/{task.steps.length}</p>

      <section className="mvp-mission-card">
        <p>오늘 과제</p>
        <strong>{task.lesson?.assignmentInstruction ?? task.card.title}</strong>
        <small>
          <b>쉬운 설명</b>
          {task.card.easyExplanation}
        </small>
      </section>

      {task.card.goal ? (
        <section className="mvp-material-card">
          <p>{materialLabelFor(task.card)}</p>
          <div>{task.card.goal}</div>
        </section>
      ) : null}

      <article className="mvp-current-step">
        <span>지금 할 일 · {currentIndex + 1}단계</span>
        <h2>{step.stepText}</h2>
        <VisualHintView hint={step.visualHintJson} />
        {needsResponse ? (
          <label className="mvp-step-response" htmlFor={`student-response-${step.id}`}>
            <span>내 답 적기</span>
            <textarea
              id={`student-response-${step.id}`}
              value={currentResponse}
              onChange={(event) => setCurrentResponse(event.target.value)}
              placeholder={responsePlaceholder(step, task)}
              rows={3}
            />
          </label>
        ) : null}
        {feedback ? <p className="mvp-feedback">{feedback}</p> : null}
      </article>

      {hasSupportOption(supportOptions, "easy_language") && task.card.keywordsJson.length > 0 ? (
        <div className="mvp-keywords" aria-label="쉬운 말 뜻">
          {task.card.keywordsJson.slice(0, 3).map((keyword) => (
            <span key={keyword.word}>
              <strong>{keyword.word}</strong>
              {keyword.easyMeaning}
            </span>
          ))}
        </div>
      ) : null}

      {hasSupportOption(supportOptions, "repeat_check") ? (
        <section className="mvp-quiz">
          <h3>{step.microQuizJson.question}</h3>
          <div>
            {step.microQuizJson.choices.map((choice) => (
              <button
                key={choice}
                className={selectedAnswer === choice ? "is-selected" : ""}
                onClick={() => void submitQuiz(choice)}
                disabled={busy === "quiz"}
                type="button"
              >
                {choice}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {hasSupportOption(supportOptions, "help_sentence") ? (
        <section className={showHelpSentence ? "mvp-help-sentence is-open" : "mvp-help-sentence"}>
          <p>선생님께 이렇게 말할 수 있어요</p>
          {showHelpSentence ? (
            <div className="mvp-help-reveal">
              <span>말해볼 문장</span>
              <strong>{step.helpSentence}</strong>
            </div>
          ) : (
            <small className="mvp-help-preview">막혔을 때 누르면 선생님께 말할 문장이 크게 열리고, 리포트에 도움 요청 기록이 남아요.</small>
          )}
          <div className="mvp-help-actions">
            <button onClick={() => void action("help-sentence")} type="button">
              <Megaphone size={16} />
              {showHelpSentence ? "도움 문장 다시 기록" : "도움 문장 열기"}
            </button>
            <button onClick={() => void playVoice()} type="button">
              <Headphones size={16} />
              문장 듣기
            </button>
          </div>
          {voiceState && voiceState !== "played" && voiceState !== "loading" ? <small>{voiceState}</small> : null}
          {voiceState === "loading" ? <small>음성을 생성하는 중입니다.</small> : null}
        </section>
      ) : null}

      <div className="mvp-student-actions">
        <button onClick={() => void action("confused")} disabled={Boolean(busy)} type="button">
          모르겠어요
        </button>
        <button onClick={() => void action("simplify")} disabled={Boolean(busy)} type="button">
          다시 쉽게 말해줘
        </button>
        <button className="mvp-primary" onClick={() => void action("complete")} disabled={Boolean(busy)} type="button">
          완료했어요
        </button>
      </div>
    </section>
  );
}

function StudentReviewScreen({ task }: { task: ApiStudentTask }) {
  const [review, setReview] = useState<ApiTaskSummary | null>(task.summary ?? null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let alive = true;
    requestJson<{ summary: ApiTaskSummary }>(`/api/student/tasks/${task.card.id}/review${studentQuery(task.studentId)}`)
      .then((result) => {
        if (!alive) return;
        setReview(result.summary);
        setState("idle");
      })
      .catch(() => {
        if (!alive) return;
        setState("error");
      });
    return () => {
      alive = false;
    };
  }, [task.card.id, task.studentId]);

  const summary = review ?? task.summary;
  if (!summary) {
    return <EmptyState title="복구노트를 만드는 중입니다" body={state === "error" ? "수행 로그가 아직 부족합니다." : "잠시만 기다려 주세요."} />;
  }

  return (
    <section className="mvp-review">
      <div className="mvp-review-hero">
        <img src={DEFAULT_ASSETS.mascot} alt="" />
        <div>
          <p>과제 돌아보기</p>
          <h1>{task.card.title}</h1>
        </div>
      </div>
      <section className="mvp-review-metrics">
        <article>
          <span>완료</span>
          <strong>{summary.completionRate}%</strong>
        </article>
        <article>
          <span>도움 요청</span>
          <strong>{summary.helpRequestCount}회</strong>
        </article>
        <article>
          <span>퀴즈</span>
          <strong>{summary.correctQuizCount}/{summary.totalQuizCount}</strong>
        </article>
      </section>
      <section className="mvp-review-block">
        <h2>오늘 잘한 점</h2>
        {summary.generatedReviewJson.goodPoints.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </section>
      <section className="mvp-review-block">
        <h2>다음에 다시 보기</h2>
        {summary.generatedReviewJson.nextReview.map((item) => (
          <p key={`${item.title}-${item.description}`}>
            <strong>{item.title}</strong>
            {item.description}
          </p>
        ))}
      </section>
      <section className="mvp-review-block is-ask">
        <h2>선생님께 물어볼 문장</h2>
        <p>{summary.generatedReviewJson.askTeacherSentence}</p>
      </section>
      {summary.generatedReviewJson.homeMission ? (
        <section className="mvp-review-block">
          <h2>생활 미션</h2>
          <p>{summary.generatedReviewJson.homeMission}</p>
        </section>
      ) : null}
    </section>
  );
}

export function StudentApp({
  initialView = "task",
  initialCardId,
}: {
  initialView?: StudentView;
  initialCardId?: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<StudentView>(initialView === "preview" ? "task" : initialView);
  const [task, setTask] = useState<ApiStudentTask | null>(null);
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [activeCardId, setActiveCardId] = useState(initialCardId ?? "");
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");

  async function load(preferredCardId = activeCardId) {
    setState("loading");
    try {
      const taskList = await requestJson<{ studentId: string | null; student: ApiStudent | null; students: ApiStudent[]; tasks: CardBundle[] }>("/api/student/tasks");
      setStudents(taskList.students ?? []);
      const cardId = preferredCardId && taskList.tasks.some((item) => item.card.id === preferredCardId)
        ? preferredCardId
        : taskList.tasks[0]?.card.id ?? "";
      setActiveCardId(cardId);
      if (!cardId) {
        setTask(null);
        setState("idle");
        return;
      }
      const detail = await requestJson<ApiStudentTask>(`/api/student/tasks/${encodeURIComponent(cardId)}${studentQuery(taskList.studentId)}`);
      setTask(detail);
      setError("");
      setState("idle");
    } catch (error) {
      setTask(null);
      setState("error");
      setError(error instanceof Error ? error.message : "학생 과제를 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    setView(initialView === "preview" ? "task" : initialView);
    if (initialCardId) setActiveCardId(initialCardId);
  }, [initialView, initialCardId]);

  useEffect(() => {
    void load(initialCardId);
  }, []);

  function move(next: StudentView) {
    setView(next);
    if (next === "review") router.push(activeCardId ? `/student/tasks/${encodeURIComponent(activeCardId)}/review` : "/student/review");
    else router.push(activeCardId ? `/student/tasks/${encodeURIComponent(activeCardId)}` : "/student/task");
  }

  return (
    <main className="mvp-student-page">
      <div className="mvp-phone">
        <StudentTop student={task?.student ?? students[0]} />
        <ErrorBanner message={error} onRetry={() => void load(activeCardId)} />
        {state === "loading" ? (
          <div className="mvp-phone-loading">
            <Loader2 size={28} className="mvp-spin" />
            과제를 불러오는 중입니다.
          </div>
        ) : !task ? (
          <EmptyState
            title="배포된 과제가 없습니다"
            body="선생님이 실행카드를 학생에게 배포하면 이 화면에 바로 나타납니다."
          />
        ) : view === "review" ? (
          <StudentReviewScreen task={task} />
        ) : (
          <StudentTaskScreen
            task={task}
            reload={() => load(activeCardId)}
            goReview={() => move("review")}
            onError={setError}
          />
        )}
        <StudentBottom active={view} onMove={move} />
      </div>
    </main>
  );
}
