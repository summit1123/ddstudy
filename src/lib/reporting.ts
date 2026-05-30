import { readDb, upsertReport, upsertTaskSummary } from "./db";
import type {
  ExecutionStep,
  Report,
  StudentStepLog,
  StudentTaskSummary
} from "./types";
import { hasSupportOption } from "./support-options";

function latestStartedAt(logs: StudentStepLog[]) {
  const start = logs.find((log) => log.eventType === "started");
  return start ? new Date(start.createdAt).getTime() : null;
}

function latestCompletedAt(logs: StudentStepLog[]) {
  const completed = [...logs]
    .reverse()
    .find((log) => log.eventType === "completed" || log.eventType === "quiz_answered");
  return completed ? new Date(completed.createdAt).getTime() : null;
}

function summarizeStep(step: ExecutionStep, logs: StudentStepLog[]) {
  const stepLogs = logs.filter((log) => log.stepId === step.id);
  const startedAt = latestStartedAt(stepLogs);
  const completedAt = latestCompletedAt(stepLogs);
  const isCompleted = stepLogs.some((log) => log.eventType === "completed");
  const confusedCount = stepLogs.filter((log) => log.eventType === "confused").length;
  const simplifyCount = stepLogs.filter((log) => log.eventType === "simplify").length;
  const helpSentenceViewedCount = stepLogs.filter((log) => log.eventType === "help_sentence_viewed").length;
  const quizLog = [...stepLogs].reverse().find((log) => log.eventType === "quiz_answered");
  const isCorrect = quizLog?.payloadJson.isCorrect === true;
  const timeSeconds =
    startedAt && completedAt ? Math.max(0, Math.round((completedAt - startedAt) / 1000)) : 0;

  return {
    step,
    isCompleted,
    confusedCount,
    simplifyCount,
    helpSentenceViewedCount,
    quizAnswered: Boolean(quizLog),
    isCorrect,
    timeSeconds
  };
}

export async function buildTaskSummary(studentId: string, cardId: string) {
  const db = await readDb();
  const steps = db.executionSteps
    .filter((step) => step.cardId === cardId)
    .sort((a, b) => a.order - b.order);
  const logs = db.studentStepLogs.filter(
    (log) => log.studentId === studentId && log.cardId === cardId
  );
  const card = db.executionCards.find((item) => item.id === cardId);
  const perStep = steps.map((step) => summarizeStep(step, logs));
  const completedCount = perStep.filter((step) => step.isCompleted).length;
  const helpRequestCount = perStep.reduce(
    (sum, step) => sum + step.confusedCount + step.simplifyCount + step.helpSentenceViewedCount,
    0
  );
  const totalQuizCount = perStep.filter((step) => step.quizAnswered).length;
  const correctQuizCount = perStep.filter((step) => step.isCorrect).length;
  const stuckStepCount = perStep.filter(
    (step) => step.confusedCount > 0 || step.simplifyCount > 0 || step.helpSentenceViewedCount > 0 || (step.quizAnswered && !step.isCorrect)
  ).length;
  const totalTimeSeconds = perStep.reduce((sum, step) => sum + step.timeSeconds, 0);
  const completionRate = steps.length ? Math.round((completedCount / steps.length) * 100) : 0;
  const firstStuckStep = perStep.find(
    (step) => step.confusedCount > 0 || step.simplifyCount > 0 || step.helpSentenceViewedCount > 0 || (step.quizAnswered && !step.isCorrect),
  );
  const cardReview = card?.reviewJson;
  const homeMission =
    cardReview?.homeMission ??
    (hasSupportOption(card?.supportOptionsJson, "life_example") && card
      ? `생활 속에서 '${card.topic || card.title}'와 연결되는 장면을 하나 찾아 말해봐요.`
      : undefined);

  const summary: StudentTaskSummary = {
    id: `summary_${studentId}_${cardId}`,
    studentId,
    cardId,
    completionRate,
    totalTimeSeconds,
    helpRequestCount,
    correctQuizCount,
    totalQuizCount,
    stuckStepCount,
    generatedReviewJson: {
      goodPoints: [
        completedCount > 0 ? `${completedCount}개 단계를 끝까지 시도했어요.` : "과제를 시작했어요.",
        helpRequestCount > 0
          ? "어려울 때 도움을 요청하는 방법을 사용했어요."
          : "스스로 차근차근 진행했어요."
      ],
      nextReview: stuckStepCount
        ? [
            {
              title: firstStuckStep ? `${firstStuckStep.step.order}단계 다시 보기` : "막힌 단계 다시 보기",
              type: "practice",
              description: "도움 요청이 있었던 단계를 다시 천천히 연습해요.",
            },
            {
              title: "핵심 개념 카드",
              type: "card",
              description: cardReview?.nextReview[0]?.description ?? "퀴즈나 쉬운 설명 요청이 있었던 개념을 복습해요.",
            },
          ]
        : cardReview?.nextReview?.length
          ? cardReview.nextReview
          : [
            {
              title: "답 확인 루틴",
              type: "text",
              description: "단위와 조건을 붙여 답을 확인하는 습관을 이어가요.",
            },
          ],
      askTeacherSentence:
        helpRequestCount > 0
          ? cardReview?.askTeacherSentence || firstStuckStep?.step.helpSentence || "선생님, 제가 막힌 단계를 다시 설명해 주세요."
          : "선생님, 비슷한 문제를 한 번 더 풀어보고 싶어요.",
      homeMission
    }
  };

  await upsertTaskSummary(summary);
  return { summary, perStep, logs };
}

export async function buildStudentReport(studentId: string, cardId?: string) {
  const db = await readDb();
  const student = db.students.find((item) => item.id === studentId);
  if (!student) throw new Error("학생을 찾을 수 없습니다.");

  const targetCardId =
    cardId ??
    [...db.executionCards]
      .filter((card) => card.status === "published")
      .sort((a, b) => {
        const left = new Date(a.publishedAt ?? a.updatedAt ?? a.createdAt).getTime();
        const right = new Date(b.publishedAt ?? b.updatedAt ?? b.createdAt).getTime();
        return right - left;
      })[0]?.id ??
    [...db.executionCards].sort((a, b) => {
      const left = new Date(a.updatedAt ?? a.createdAt).getTime();
      const right = new Date(b.updatedAt ?? b.createdAt).getTime();
      return right - left;
    })[0]?.id;
  if (!targetCardId) throw new Error("리포트를 만들 실행카드가 없습니다.");

  const { summary, perStep } = await buildTaskSummary(studentId, targetCardId);
  const difficultyTags = new Set<string>();
  for (const item of perStep) {
    if (item.confusedCount > 0) difficultyTags.add("지시 이해");
    if (item.simplifyCount > 0) difficultyTags.add("개념 이해");
    if (!item.isCompleted) difficultyTags.add("과제 시작");
    if (item.step.order >= 3 && (item.confusedCount > 0 || !item.isCorrect)) {
      difficultyTags.add("순서화");
    }
  }
  if (difficultyTags.size === 0) difficultyTags.add("반복 확인");

  const recommendationByTag: Record<string, string> = {
    "지시 이해": "과제 시작 전, 지시문을 짧게 나누어 함께 확인하고 중요 키워드를 표시해 보세요.",
    "개념 이해": "학생이 요청한 쉬운 설명 문장을 바탕으로 핵심 개념을 더 짧은 예시와 함께 다시 다뤄 보세요.",
    "과제 시작": "첫 단계에서 해야 할 행동을 교사가 한 번 시범으로 보여주고 학생이 바로 따라 하게 해보세요.",
    "순서화": "단계 흐름을 체크리스트나 번호 카드로 정리한 뒤 한 단계씩 지우며 진행해 보세요.",
    "반복 확인": "완료 후 스스로 답과 조건을 확인하는 짧은 루틴을 유지해 주세요.",
  };
  const recommendations = [...difficultyTags].map((tag) => recommendationByTag[tag]).filter(Boolean);

  const report: Report = {
    id: `report_${studentId}_${targetCardId}`,
    studentId,
    cardId: targetCardId,
    summary: `${student.nickname}는 완료율 ${summary.completionRate}%로 과제를 수행했고, 도움 요청은 ${summary.helpRequestCount}회였습니다.`,
    difficultyTagsJson: [...difficultyTags],
    aiRecommendationsJson: recommendations,
    parentMemo:
      `${student.nickname}는 완료율 ${summary.completionRate}%로 과제를 수행했고 도움 요청은 ${summary.helpRequestCount}회였습니다. ` +
      `관찰된 어려움은 ${[...difficultyTags].join(", ")}이며, 다음 과제에서는 짧은 지시와 단계별 확인을 함께 제공하면 도움이 됩니다.`,
    createdAt: new Date().toISOString()
  };

  await upsertReport(report);
  return { report, summary, perStep };
}

export function defaultLogPayload(extra?: Record<string, unknown>) {
  return {
    client: "demo-web",
    ...extra
  };
}
