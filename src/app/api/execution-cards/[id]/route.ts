import {
  ApiError,
  errorResponse,
  jsonResponse,
  requestJson,
} from "../../../../lib/ai";
import { readDb, updateDb } from "@/lib/db";
import {
  UpdateExecutionCardRequestSchema,
  validationError,
} from "../../../../lib/schemas";
import type { ExecutionCard } from "@/lib/types";
import type { ExecutionStep } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await readDb();
    const card = db.executionCards.find((item) => item.id === id);
    if (!card) throw new ApiError(404, "not_found", `Execution card not found: ${id}`);
    const steps = db.executionSteps
      .filter((step) => step.cardId === id)
      .sort((a, b) => a.order - b.order);
    return jsonResponse({ card, steps });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = UpdateExecutionCardRequestSchema.safeParse(await requestJson(request));
    if (!parsed.success) return jsonResponse(validationError(parsed.error), 400);

    const saved = await updateDb((db) => {
      const index = db.executionCards.findIndex((item) => item.id === id);
      if (index < 0) throw new ApiError(404, "not_found", `Execution card not found: ${id}`);
      const record = db.executionCards[index];
      const next: ExecutionCard = {
        ...record,
        title: parsed.data.title ?? record.title,
        goal: parsed.data.goal ?? record.goal,
        subject: parsed.data.subject ?? record.subject,
        grade: parsed.data.grade ?? record.grade,
        topic: parsed.data.topic ?? record.topic,
        standardJson: parsed.data.standard
          ? {
              id: parsed.data.standard.id ?? undefined,
              code: parsed.data.standard.code ?? undefined,
              text: parsed.data.standard.text,
              sourceType: parsed.data.standard.sourceType ?? undefined,
              sourceName: parsed.data.standard.sourceName ?? undefined,
              sourceUrl: parsed.data.standard.sourceUrl ?? undefined,
              license: parsed.data.standard.license ?? undefined,
            }
          : record.standardJson,
        easyExplanation: parsed.data.easyExplanation ?? record.easyExplanation,
        keywordsJson: parsed.data.keywords ?? record.keywordsJson,
        supportOptionsJson: record.supportOptionsJson,
        reviewJson: parsed.data.review
          ? {
              goodPoints: parsed.data.review.goodPoints,
              nextReview: parsed.data.review.nextReview.map((item) => ({
                title: item.title,
                type: item.type,
                description: item.description,
                resourceId: item.resourceId ?? undefined,
              })),
              askTeacherSentence: parsed.data.review.askTeacherSentence,
              homeMission: parsed.data.review.homeMission ?? undefined,
            }
          : record.reviewJson,
        status: parsed.data.status ?? record.status,
        updatedAt: new Date().toISOString(),
        publishedAt: parsed.data.status === "published" ? new Date().toISOString() : record.publishedAt,
      };
      db.executionCards[index] = next;

      if (parsed.data.steps) {
        const previousById = new Map(db.executionSteps.filter((step) => step.cardId === id).map((step) => [step.id, step]));
        const nextSteps: ExecutionStep[] = parsed.data.steps.map((step, stepIndex) => {
          const stepId = step.id && previousById.has(step.id) ? step.id : `step_${Date.now().toString(36)}_${stepIndex}_${Math.random().toString(36).slice(2, 7)}`;
          return {
            id: stepId,
            cardId: id,
            order: step.order || stepIndex + 1,
            stepText: step.stepText,
            visualHintJson: {
              type: step.visualHint.type,
              data: step.visualHint.data ?? undefined,
              assetUrl: step.visualHint.assetUrl ?? undefined,
              alt: step.visualHint.alt ?? undefined,
            },
            microQuizJson: {
              question: step.microQuiz.question,
              choices: step.microQuiz.choices,
              answer: step.microQuiz.answer,
              explanation: step.microQuiz.explanation ?? undefined,
            },
            helpSentence: step.helpSentence,
            teacherTip: step.teacherTip,
          };
        });
        db.executionSteps = [
          ...db.executionSteps.filter((step) => step.cardId !== id),
          ...nextSteps,
        ];
      }

      const steps = db.executionSteps
        .filter((step) => step.cardId === id)
        .sort((a, b) => a.order - b.order);
      return { card: next, steps };
    });

    return jsonResponse(saved);
  } catch (error) {
    return errorResponse(error);
  }
}
