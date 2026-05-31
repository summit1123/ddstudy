import { z } from "zod";
import {
  ApiError,
  errorResponse,
  generateJson,
  jsonResponse,
  requestJson,
} from "@/lib/ai";
import { readDb } from "@/lib/db";
import { buildStudentReport } from "@/lib/reporting";
import { supportOptionLabels } from "@/lib/support-options";

export const runtime = "nodejs";

const AssistantRequestSchema = z.object({
  studentId: z.string().min(1),
  cardId: z.string().optional(),
  question: z.string().min(2).max(500),
});

const AssistantAnswerSchema = z.object({
  answer: z.string().min(1),
  nextActions: z.array(z.string().min(1)).min(2).max(4),
  questionToAskStudent: z.string().min(1),
  evidence: z.array(z.string().min(1)).min(1).max(5),
});

const assistantAnswerJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "nextActions", "questionToAskStudent", "evidence"],
  properties: {
    answer: { type: "string" },
    nextActions: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" },
    },
    questionToAskStudent: { type: "string" },
    evidence: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: { type: "string" },
    },
  },
};

function latestPublishedCardId(cardId: string | undefined, db: Awaited<ReturnType<typeof readDb>>) {
  if (cardId && db.executionCards.some((card) => card.id === cardId)) return cardId;
  return [...db.executionCards]
    .filter((card) => card.status === "published")
    .sort((a, b) => {
      const left = new Date(a.publishedAt ?? a.updatedAt ?? a.createdAt).getTime();
      const right = new Date(b.publishedAt ?? b.updatedAt ?? b.createdAt).getTime();
      return right - left;
    })[0]?.id;
}

export async function POST(request: Request) {
  try {
    const parsed = AssistantRequestSchema.safeParse(await requestJson(request));
    if (!parsed.success) {
      throw new ApiError(400, "invalid_request", "학생과 질문을 확인해 주세요.", parsed.error.flatten());
    }

    const input = parsed.data;
    const db = await readDb();
    const student = db.students.find((item) => item.id === input.studentId);
    if (!student) throw new ApiError(404, "student_not_found", "학생을 찾을 수 없습니다.");

    const targetCardId = latestPublishedCardId(input.cardId, db);
    const card = targetCardId ? db.executionCards.find((item) => item.id === targetCardId) : undefined;
    const lesson = card ? db.lessons.find((item) => item.id === card.lessonId) : undefined;
    const reportBundle = targetCardId ? await buildStudentReport(student.id, targetCardId) : null;
    const supportOptions = Array.isArray(student.supportProfileJson.supportOptions)
      ? student.supportProfileJson.supportOptions.filter((item): item is string => typeof item === "string")
      : [];
    const profile = typeof student.supportProfileJson.profile === "string"
      ? student.supportProfileJson.profile
      : "지원 프로필 미설정";

    const answer = await generateJson({
      name: "teacher_student_support_assistant",
      schema: assistantAnswerJsonSchema,
      zodSchema: AssistantAnswerSchema,
      system:
        "You are a Korean teacher support assistant for slow learners. Answer only from the supplied student profile, task, logs, and report evidence. Do not invent unseen records. Be practical, short, and classroom-ready. Keep answer as two compact sentences; put concrete teacher actions in nextActions, not as a long numbered paragraph.",
      user: [
        `Teacher question: ${input.question}`,
        `Student: ${student.nickname}`,
        `Support profile: ${profile}`,
        `Support options: ${supportOptions.join(", ")} (${supportOptionLabels(supportOptions).join(", ")})`,
        card ? `Current card: ${JSON.stringify({
          id: card.id,
          title: card.title,
          subject: card.subject,
          grade: card.grade,
          topic: card.topic,
          supportOptions: card.supportOptionsJson,
        })}` : "No published execution card is available yet.",
        lesson ? `Lesson: ${JSON.stringify({
          subject: lesson.subject,
          grade: lesson.grade,
          topic: lesson.topic,
          lessonContent: lesson.lessonContent,
          assignmentInstruction: lesson.assignmentInstruction,
        })}` : "",
        reportBundle ? `Log summary: ${JSON.stringify(reportBundle.summary)}` : "No student log summary yet.",
        reportBundle ? `Per-step evidence: ${JSON.stringify(reportBundle.perStep.map((item) => ({
          order: item.step.order,
          stepText: item.step.stepText,
          completed: item.isCompleted,
          confused: item.confusedCount,
          simplify: item.simplifyCount,
          helpSentenceViewed: item.helpSentenceViewedCount,
          helpTotal: item.confusedCount + item.simplifyCount + item.helpSentenceViewedCount,
          quizAnswered: item.quizAnswered,
          correct: item.isCorrect,
          studentResponse: item.studentResponse,
          timeSeconds: item.timeSeconds,
        })))}` : "",
        reportBundle ? `Report recommendations: ${reportBundle.report.aiRecommendationsJson.join(" | ")}` : "",
      ].filter(Boolean).join("\n"),
    });

    return jsonResponse({
      student: {
        id: student.id,
        nickname: student.nickname,
        profile,
        supportOptions,
      },
      card: card ? { id: card.id, title: card.title, subject: card.subject, grade: card.grade } : null,
      answer,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
