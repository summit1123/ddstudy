import {
  ApiError,
  errorResponse,
  jsonResponse,
  requestJson,
} from "../../../../lib/ai";
import { readDb, updateDb } from "@/lib/db";
import {
  UpdateLessonRequestSchema,
  validationError,
} from "../../../../lib/schemas";
import type { Lesson } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await readDb();
    const lesson = db.lessons.find((item) => item.id === id);
    if (!lesson) throw new ApiError(404, "not_found", `Lesson not found: ${id}`);
    return jsonResponse({ lesson });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = UpdateLessonRequestSchema.safeParse(await requestJson(request));
    if (!parsed.success) return jsonResponse(validationError(parsed.error), 400);

    const lesson = await updateDb((db) => {
      const index = db.lessons.findIndex((item) => item.id === id);
      if (index < 0) throw new ApiError(404, "not_found", `Lesson not found: ${id}`);
      const record = db.lessons[index];
      const next: Lesson = {
        ...record,
        grade: parsed.data.gradeBand ?? record.grade,
        subject: parsed.data.subject ?? record.subject,
        topic: parsed.data.topic ?? record.topic,
        lessonContent: parsed.data.agenda
          ? parsed.data.agenda.map((item) => `${item.minute}분: ${item.activity}`).join("\n")
          : record.lessonContent,
        assignmentInstruction: parsed.data.assessment ?? record.assignmentInstruction,
        supportOptionsJson: parsed.data.differentiation ?? record.supportOptionsJson,
      };
      db.lessons[index] = next;
      return next;
    });

    return jsonResponse({ lesson });
  } catch (error) {
    return errorResponse(error);
  }
}
