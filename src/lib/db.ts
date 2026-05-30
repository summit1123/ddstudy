import { promises as fs } from "fs";
import path from "path";
import { demoDb, emptyDb } from "./demo-seed";
import type {
  AppDb,
  CardReview,
  ExecutionCard,
  ExecutionStep,
  Lesson,
  Report,
  StudentStepLog,
  StudentTaskSummary,
  VisualHint
} from "./types";

const dbPath = path.join(process.cwd(), "data", "app-db.json");
let updateQueue: Promise<unknown> = Promise.resolve();

async function ensureDbFile() {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  try {
    await fs.access(dbPath);
  } catch {
    await writeDb(demoDb);
  }
}

export async function readDb(): Promise<AppDb> {
  await ensureDbFile();
  const raw = await fs.readFile(dbPath, "utf8");
  return normalizeDb({ ...emptyDb, ...JSON.parse(raw) } as AppDb);
}

export async function writeDb(db: AppDb) {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  const tmpPath = `${dbPath}.${process.pid}.${Date.now()}.${Math.random()
    .toString(36)
    .slice(2)}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(db, null, 2));
  await fs.rename(tmpPath, dbPath);
}

export async function updateDb<T>(mutator: (db: AppDb) => T | Promise<T>) {
  const operation = async () => {
    const db = await readDb();
    const result = await mutator(db);
    await writeDb(db);
    return result;
  };
  const next = updateQueue.then(operation, operation);
  updateQueue = next.catch(() => undefined);
  return next;
}

export function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalizeVisualHint(value: unknown): VisualHint {
  const hint = (value && typeof value === "object" ? value : {}) as {
    type?: string;
    labels?: string[];
    data?: Record<string, unknown>;
    assetUrl?: string;
    alt?: string;
  };
  if (hint.type === "rectangle_dimension") {
    return {
      type: "rectangle_dimension",
      data: hint.data ?? { labels: hint.labels ?? ["위쪽 변", "옆쪽 변"] },
      assetUrl: hint.assetUrl,
      alt: hint.alt ?? "도형 치수 시각 단서",
    };
  }
  if (hint.type === "number_line") return { type: "number_line", data: hint.data ?? {}, alt: hint.alt };
  if (hint.type === "sequence_checklist") return { type: "sequence_checklist", data: hint.data ?? { items: hint.labels ?? [] }, alt: hint.alt };
  if (hint.type === "image_asset") return { type: "image_asset", data: hint.data ?? {}, assetUrl: hint.assetUrl, alt: hint.alt };
  return {
    type: "text_only",
    data: hint.data ?? { text: hint.labels?.join(" ") ?? "" },
    alt: hint.alt,
  };
}

function normalizeReview(value: unknown): CardReview {
  const review = (value && typeof value === "object" ? value : {}) as Partial<CardReview>;
  const nextReview = Array.isArray(review.nextReview)
    ? review.nextReview.map((item) =>
        typeof item === "string"
          ? { title: item, type: "text" as const, description: item }
          : {
              title: item.title,
              type: item.type,
              description: item.description,
              resourceId: item.resourceId,
            },
      )
    : [];
  return {
    goodPoints: Array.isArray(review.goodPoints) ? review.goodPoints : [],
    nextReview,
    askTeacherSentence: review.askTeacherSentence ?? "",
    homeMission: review.homeMission,
  };
}

function normalizeDb(db: AppDb): AppDb {
  const lessonsById = new Map(db.lessons.map((lesson) => [lesson.id, lesson]));
  return {
    ...db,
    executionCards: db.executionCards.map((card) => {
      const legacy = card as ExecutionCard & {
        subject?: string;
        grade?: string;
        topic?: string;
        standardJson?: ExecutionCard["standardJson"];
        reviewJson?: CardReview;
        updatedAt?: string;
        publishedAt?: string;
      };
      const lesson = lessonsById.get(card.lessonId);
      return {
        ...card,
        subject: legacy.subject ?? lesson?.subject ?? "",
        grade: legacy.grade ?? lesson?.grade ?? "",
        topic: legacy.topic ?? lesson?.topic ?? card.title,
        standardJson:
          legacy.standardJson ??
          ({
            id: lesson?.selectedStandardId ?? undefined,
            text: lesson?.selectedStandardId ?? "선택된 성취기준 정보가 없습니다.",
          } satisfies ExecutionCard["standardJson"]),
        reviewJson: normalizeReview(legacy.reviewJson),
        updatedAt: legacy.updatedAt ?? card.createdAt,
        publishedAt: legacy.publishedAt,
      };
    }),
    executionSteps: db.executionSteps.map((step) => ({
      ...step,
      visualHintJson: normalizeVisualHint(step.visualHintJson),
      microQuizJson: {
        ...step.microQuizJson,
        choices: step.microQuizJson.choices ?? [],
      },
    })),
    studentTaskSummaries: db.studentTaskSummaries.map((summary) => ({
      ...summary,
      generatedReviewJson: {
        ...summary.generatedReviewJson,
        nextReview: (summary.generatedReviewJson.nextReview ?? []).map((item) =>
          typeof item === "string" ? { title: item, type: "text", description: item } : item,
        ),
        homeMission: summary.generatedReviewJson.homeMission,
      },
    })),
  };
}

export async function getCardBundle(cardId: string) {
  const db = await readDb();
  const card = db.executionCards.find((item) => item.id === cardId);
  if (!card) return null;
  const lesson = db.lessons.find((item) => item.id === card.lessonId) ?? null;
  const steps = db.executionSteps
    .filter((item) => item.cardId === cardId)
    .sort((a, b) => a.order - b.order);
  return { card, lesson, steps };
}

export async function saveLesson(input: Omit<Lesson, "id" | "createdAt">) {
  return updateDb((db) => {
    const lesson: Lesson = {
      ...input,
      id: id("lesson"),
      createdAt: new Date().toISOString()
    };
    db.lessons.push(lesson);
    return lesson;
  });
}

export async function saveExecutionCard(
  card: Omit<ExecutionCard, "id" | "createdAt">,
  steps: Omit<ExecutionStep, "id" | "cardId">[]
) {
  return updateDb((db) => {
    const savedCard: ExecutionCard = {
      ...card,
      id: id("card"),
      createdAt: new Date().toISOString()
    };
    const savedSteps: ExecutionStep[] = steps.map((step) => ({
      ...step,
      id: id("step"),
      cardId: savedCard.id
    }));
    db.executionCards.push(savedCard);
    db.executionSteps.push(...savedSteps);
    return { card: savedCard, steps: savedSteps };
  });
}

export async function addStudentLog(
  input: Omit<StudentStepLog, "id" | "createdAt">
) {
  return updateDb((db) => {
    const log: StudentStepLog = {
      ...input,
      id: id("log"),
      createdAt: new Date().toISOString()
    };
    db.studentStepLogs.push(log);
    return log;
  });
}

export async function upsertTaskSummary(summary: StudentTaskSummary) {
  return updateDb((db) => {
    const index = db.studentTaskSummaries.findIndex(
      (item) => item.studentId === summary.studentId && item.cardId === summary.cardId
    );
    if (index >= 0) db.studentTaskSummaries[index] = summary;
    else db.studentTaskSummaries.push(summary);
    return summary;
  });
}

export async function upsertReport(report: Report) {
  return updateDb((db) => {
    const index = db.reports.findIndex(
      (item) => item.studentId === report.studentId && item.cardId === report.cardId
    );
    if (index >= 0) db.reports[index] = report;
    else db.reports.push(report);
    return report;
  });
}
