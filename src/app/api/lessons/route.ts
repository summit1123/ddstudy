import {
  errorResponse,
  generateJson,
  jsonResponse,
  requestJson,
} from "../../../lib/ai";
import { id, readDb, updateDb } from "@/lib/db";
import { formatResourcesForPrompt, searchResources } from "../../../lib/rag";
import {
  GenerateLessonRequestSchema,
  LessonSchema,
  lessonJsonSchema,
  validationError,
} from "../../../lib/schemas";
import type { Lesson } from "@/lib/types";

export const runtime = "nodejs";

const GeneratedLessonSchema = LessonSchema.omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
});

export async function GET() {
  try {
    const db = await readDb();
    return jsonResponse({ lessons: db.lessons });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = GenerateLessonRequestSchema.safeParse(await requestJson(request));
    if (!parsed.success) return jsonResponse(validationError(parsed.error), 400);

    const input = parsed.data;
    const resources = await searchResources({
      q: input.resourceQuery ?? `${input.subject} ${input.gradeBand} ${input.topic}`,
      subject: input.subject,
      gradeBand: input.gradeBand,
      limit: 5,
    });

    const generated = await generateJson({
      name: "lesson_plan",
      schema: lessonJsonSchema,
      zodSchema: GeneratedLessonSchema,
      system:
        "You generate concise Korean lesson plans for the 다음한걸음 demo. Use only the supplied standards/resources for citations. Return JSON only.",
      user: [
        `Subject: ${input.subject}`,
        `Grade band: ${input.gradeBand}`,
        `Topic: ${input.topic}`,
        `Duration minutes: ${input.durationMinutes}`,
        input.title ? `Requested title: ${input.title}` : "",
        input.objectives?.length ? `Requested objectives: ${input.objectives.join("; ")}` : "",
        input.lessonContent ? `Teacher lesson content: ${input.lessonContent}` : "",
        input.assignmentInstruction ? `Teacher assignment instruction: ${input.assignmentInstruction}` : "",
        input.selectedStandardText ? `Selected standard: ${input.selectedStandardId ?? ""} ${input.selectedStandardText}` : "",
        input.supportOptions.length ? `Support options: ${input.supportOptions.join(", ")}` : "",
        input.learnerContext ? `Learner context: ${input.learnerContext}` : "",
        "Standards/resources:",
        formatResourcesForPrompt(resources),
      ].filter(Boolean).join("\n"),
    });

    const lesson = await updateDb((db) => {
      const saved: Lesson = {
        id: id("lesson"),
        teacherId: input.teacherId,
        classroomId: input.classroomId,
        schoolId: input.schoolId,
        grade: input.gradeBand,
        subject: input.subject,
        topic: input.topic,
        lessonDate: input.lessonDate,
        lessonContent:
          input.lessonContent ??
          [
            input.title ?? generated.title,
            ...generated.objectives.map((objective) => `- ${objective}`),
            generated.agenda
              .map((item) => `${item.minute}분: ${item.activity} / 교사: ${item.teacherMove} / 학생: ${item.studentMove}`)
              .join("\n"),
          ].join("\n"),
        assignmentInstruction: input.assignmentInstruction ?? generated.assessment,
        selectedStandardId: input.selectedStandardId ?? (generated.citations ?? [])[0]?.standardId ?? null,
        supportOptionsJson: input.supportOptions,
        createdAt: new Date().toISOString(),
      };
      db.lessons.push(saved);
      return saved;
    });

    return jsonResponse({ lesson, generated, resources }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
