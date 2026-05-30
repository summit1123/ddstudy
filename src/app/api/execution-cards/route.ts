import {
  errorResponse,
  jsonResponse,
  requestJson,
} from "../../../lib/ai";
import { id, readDb, updateDb } from "@/lib/db";
import {
  ExecutionCardPayloadSchema,
  validationError,
} from "../../../lib/schemas";
import type { ExecutionCard, ExecutionStep } from "@/lib/types";

export const runtime = "nodejs";

const CreateExecutionCardSchema = ExecutionCardPayloadSchema.omit({ id: true });

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lessonId = url.searchParams.get("lessonId");
    const db = await readDb();
    const cards = [...db.executionCards].sort((a, b) => {
      const left = new Date(a.publishedAt ?? a.updatedAt ?? a.createdAt).getTime();
      const right = new Date(b.publishedAt ?? b.updatedAt ?? b.createdAt).getTime();
      return right - left;
    });
    return jsonResponse({
      cards: lessonId ? cards.filter((card) => card.lessonId === lessonId) : cards,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = CreateExecutionCardSchema.safeParse(await requestJson(request));
    if (!parsed.success) return jsonResponse(validationError(parsed.error), 400);

    const validated = ExecutionCardPayloadSchema.parse({
      ...parsed.data,
      id: "validation_only",
    });

    const saved = await updateDb((db) => {
      const cardId = id("card");
      const card: ExecutionCard = {
        id: cardId,
        lessonId: validated.lessonId,
        title: validated.title,
        goal: validated.goal,
        subject: validated.subject,
        grade: validated.grade,
        topic: validated.topic,
        standardJson: {
          id: validated.standard.id ?? undefined,
          code: validated.standard.code ?? undefined,
          text: validated.standard.text,
          sourceType: validated.standard.sourceType ?? undefined,
          sourceName: validated.standard.sourceName ?? undefined,
          sourceUrl: validated.standard.sourceUrl ?? undefined,
          license: validated.standard.license ?? undefined,
        },
        easyExplanation: validated.easyExplanation,
        keywordsJson: validated.keywords,
        supportOptionsJson: [],
        reviewJson: {
          goodPoints: validated.review.goodPoints,
          nextReview: validated.review.nextReview.map((item) => ({
            title: item.title,
            type: item.type,
            description: item.description,
            resourceId: item.resourceId ?? undefined,
          })),
          askTeacherSentence: validated.review.askTeacherSentence,
          homeMission: validated.review.homeMission ?? undefined,
        },
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const steps: ExecutionStep[] = validated.steps.map((step, index) => ({
        id: id("step"),
        cardId,
        order: step.order || index + 1,
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
      }));
      db.executionCards.push(card);
      db.executionSteps.push(...steps);
      return { card, steps };
    });
    return jsonResponse(saved, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
