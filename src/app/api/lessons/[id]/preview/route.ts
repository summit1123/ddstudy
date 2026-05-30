import { ApiError, errorResponse, jsonResponse } from "@/lib/ai";
import { readDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = await readDb();
    const lesson = db.lessons.find((item) => item.id === id);
    if (!lesson) throw new ApiError(404, "not_found", `Lesson not found: ${id}`);
    const card = db.executionCards.find((item) => item.lessonId === id);
    const steps = card
      ? db.executionSteps
          .filter((step) => step.cardId === card.id)
          .sort((a, b) => a.order - b.order)
      : [];

    return jsonResponse({
      preview: {
        lessonId: id,
        title: lesson.topic,
        subject: lesson.subject,
        grade: lesson.grade,
        easySummary: card?.easyExplanation ?? lesson.lessonContent,
        keywords: card?.keywordsJson ?? [],
        todo: steps.length
          ? steps.slice(0, 3).map((step) => step.stepText)
          : [
              `${lesson.topic}에서 중요한 낱말을 확인해요.`,
              "선생님이 준 과제 지시문을 짧게 나누어 읽어요.",
              "답을 쓴 뒤 조건에 맞는지 확인해요.",
            ],
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
