import {
  ApiError,
  errorResponse,
  generateJson,
  jsonResponse,
  requestJson,
} from "../../../../lib/ai";
import { id, readDb, updateDb } from "@/lib/db";
import { formatResourcesForPrompt, searchResources } from "../../../../lib/rag";
import {
  GenerateReportRequestSchema,
  ReportSchema,
  reportJsonSchema,
  validationError,
} from "../../../../lib/schemas";
import type { Report } from "@/lib/types";

export const runtime = "nodejs";

const GeneratedReportSchema = ReportSchema.omit({
  id: true,
  lessonId: true,
  executionCardId: true,
  audience: true,
  createdAt: true,
});

export async function POST(request: Request) {
  try {
    const parsed = GenerateReportRequestSchema.safeParse(await requestJson(request));
    if (!parsed.success) return jsonResponse(validationError(parsed.error), 400);

    const input = parsed.data;
    const db = await readDb();
    const lesson = input.lessonId
      ? db.lessons.find((item) => item.id === input.lessonId)
      : undefined;
    const card = input.executionCardId
      ? db.executionCards.find((item) => item.id === input.executionCardId)
      : undefined;

    if (input.lessonId && !lesson) throw new ApiError(404, "not_found", `Lesson not found: ${input.lessonId}`);
    if (input.executionCardId && !card) {
      throw new ApiError(404, "not_found", `Execution card not found: ${input.executionCardId}`);
    }

    const subject = lesson?.subject;
    const gradeBand = lesson?.grade;
    const query = [
      subject,
      gradeBand,
      lesson?.topic,
      card?.goal,
      input.evidence.join(" "),
    ].filter(Boolean).join(" ");

    const resources = subject && gradeBand
      ? await searchResources({ q: query, subject, gradeBand, limit: 4 })
      : [];

    const generated = await generateJson({
      name: "learning_report",
      schema: reportJsonSchema,
      zodSchema: GeneratedReportSchema,
      system:
        "You generate Korean learning reports for the 다음한걸음 demo. Be specific, evidence-based, and cite only supplied resources when relevant.",
      user: [
        `Audience: ${input.audience}`,
        input.studentName ? `Student: ${input.studentName}` : "",
        lesson ? `Lesson: ${JSON.stringify(lesson)}` : "",
        card ? `Execution card: ${JSON.stringify(card)}` : "",
        `Evidence: ${input.evidence.join(" | ")}`,
        resources.length ? `Standards/resources:\n${formatResourcesForPrompt(resources)}` : "No standards/resources were available.",
      ].filter(Boolean).join("\n"),
    });

    const validated = ReportSchema.parse({
      ...generated,
      id: "validation_only",
      lessonId: input.lessonId,
      executionCardId: input.executionCardId,
      audience: input.audience,
      createdAt: new Date().toISOString(),
    });

    const report = await updateDb((nextDb) => {
      const saved: Report = {
        id: id("report"),
        studentId: input.studentId,
        cardId: input.executionCardId ?? null,
        summary: validated.summary,
        difficultyTagsJson: validated.strengths,
        aiRecommendationsJson: validated.nextSteps,
        parentMemo: validated.evidenceNotes.join(" "),
        createdAt: new Date().toISOString(),
      };
      nextDb.reports.push(saved);
      return saved;
    });

    return jsonResponse({ report, generated: validated, resources }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
