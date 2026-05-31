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
  ExecutionCardPayloadSchema,
  executionCardJsonSchema,
  GenerateExecutionCardRequestSchema,
  validationError,
} from "../../../../lib/schemas";
import type { ExecutionCard, ExecutionStep } from "@/lib/types";
import type { Resource } from "@/lib/schemas";
import type { z } from "zod";
import { hasSupportOption, supportOptionLabels } from "@/lib/support-options";

export const runtime = "nodejs";

const GeneratedExecutionCardSchema = ExecutionCardPayloadSchema.omit({
  id: true,
  lessonId: true,
});

type GenerateExecutionCardInput = z.infer<typeof GenerateExecutionCardRequestSchema>;

function buildRagTrace({
  input,
  subject,
  gradeBand,
  topic,
  lessonContent,
  assignmentInstruction,
  selectedStandardText,
  supportOptions,
  resources,
}: {
  input: GenerateExecutionCardInput;
  subject: string;
  gradeBand: string;
  topic: string;
  lessonContent?: string;
  assignmentInstruction?: string;
  selectedStandardText?: string;
  supportOptions: string[];
  resources: Array<Resource & { score?: number }>;
}) {
  return {
    query: `${subject} ${gradeBand} ${topic}`,
    promptFields: {
      grade: Boolean(gradeBand),
      subject: Boolean(subject),
      topic: Boolean(topic),
      lessonContent: Boolean(lessonContent),
      assignmentInstruction: Boolean(assignmentInstruction),
      supportOptions: supportOptions.length > 0,
      selectedStandard: Boolean(selectedStandardText || input.selectedStandardId || input.selectedStandardCode),
      retrievedStandards: resources.length > 0,
      retrievedResources: resources.length > 0,
    },
    selectedStandard: {
      id: input.selectedStandardId ?? null,
      code: input.selectedStandardCode ?? null,
      sourceType: input.selectedStandardSourceType ?? null,
      sourceName: input.selectedStandardSourceName ?? null,
      sourceUrl: input.selectedStandardSourceUrl ?? null,
      license: input.selectedStandardLicense ?? null,
      textPreview: selectedStandardText?.slice(0, 240) ?? null,
    },
    retrievedContext: resources.map((resource) => ({
      id: resource.id,
      title: resource.title,
      standardCode: resource.standardCode ?? null,
      subject: resource.subject,
      gradeBand: resource.gradeBand,
      sourceType: resource.sourceType ?? null,
      sourceName: resource.sourceName ?? resource.citations[0]?.source ?? null,
      sourceUrl: resource.sourceUrl ?? resource.url ?? null,
      license: resource.license ?? null,
      score: resource.score ?? null,
      textPreview: resource.summary.slice(0, 240),
    })),
  };
}

function selectedStandardProvenance(input: GenerateExecutionCardInput, resources: Array<Resource & { score?: number }>) {
  const matchingResource = resources.find((resource) => {
    const ids = [
      resource.id,
      resource.standardCode,
      resource.citations[0]?.standardId,
    ].filter(Boolean);
    return ids.includes(input.selectedStandardId) || ids.includes(input.selectedStandardCode);
  }) ?? resources[0];

  return {
    sourceType: input.selectedStandardSourceType ?? matchingResource?.sourceType ?? null,
    sourceName: input.selectedStandardSourceName ?? matchingResource?.sourceName ?? matchingResource?.citations[0]?.source ?? null,
    sourceUrl: input.selectedStandardSourceUrl ?? matchingResource?.sourceUrl ?? matchingResource?.url ?? null,
    license: input.selectedStandardLicense ?? matchingResource?.license ?? null,
  };
}

function homeMissionFor(topic: string, supportOptions: string[], generatedMission?: string | null) {
  if (generatedMission) return generatedMission;
  if (!hasSupportOption(supportOptions, "life_example")) return null;
  return `집이나 학교에서 '${topic}'와 연결되는 장면을 하나 찾아 짧게 말해봐요.`;
}

export async function POST(request: Request) {
  try {
    const parsed = GenerateExecutionCardRequestSchema.safeParse(await requestJson(request));
    if (!parsed.success) return jsonResponse(validationError(parsed.error), 400);

    const input = parsed.data;
    const db = await readDb();
    const storedLesson = input.lessonId
      ? db.lessons.find((item) => item.id === input.lessonId)
      : undefined;
    const externalLesson = input.lesson;
    const subject = input.subject ?? storedLesson?.subject ?? externalLesson?.subject;
    const gradeBand = input.gradeBand ?? input.grade ?? storedLesson?.grade ?? externalLesson?.gradeBand;
    const topic = input.topic ?? storedLesson?.topic ?? externalLesson?.topic ?? externalLesson?.title;
    const objectives = input.objectives ?? externalLesson?.objectives;
    const lessonContent = input.lessonContent ?? storedLesson?.lessonContent;
    const assignmentInstruction = input.assignmentInstruction ?? storedLesson?.assignmentInstruction;
    const supportOptions = input.supportOptions ?? storedLesson?.supportOptionsJson ?? [];
    const selectedStandardText = input.selectedStandardText;

    if (!subject || !gradeBand || !topic) {
      throw new ApiError(
        400,
        "missing_generation_context",
        "Execution-card generation requires subject, gradeBand, and topic or a valid lessonId/lesson.",
      );
    }
    const resolvedLessonId = input.lessonId ?? storedLesson?.id ?? externalLesson?.id;
    if (input.save && !resolvedLessonId) {
      throw new ApiError(
        400,
        "missing_lesson_id",
        "Saving an execution card requires a persisted lessonId. Create the lesson first, then generate the card.",
      );
    }

    const resources = await searchResources({
      q: `${subject} ${gradeBand} ${topic} ${(objectives ?? []).join(" ")}`,
      subject,
      gradeBand,
      limit: 5,
    });
    const ragTrace = buildRagTrace({
      input,
      subject,
      gradeBand,
      topic,
      lessonContent,
      assignmentInstruction,
      selectedStandardText,
      supportOptions,
      resources,
    });

    const generated = await generateJson({
      name: "execution_card",
      schema: executionCardJsonSchema,
      zodSchema: GeneratedExecutionCardSchema,
      system:
        "You generate Korean classroom execution cards for the 다음한걸음 service. Follow the JSON schema exactly, cite only supplied resources, and do not invent standard IDs.",
      user: [
        `Subject: ${subject}`,
        `Grade band: ${gradeBand}`,
        `Topic/title: ${topic}`,
        input.title ? `Requested card title: ${input.title}` : "",
        objectives?.length ? `Lesson objectives: ${objectives.join("; ")}` : "",
        lessonContent ? `Lesson content: ${lessonContent}` : "",
        assignmentInstruction ? `Assignment instruction: ${assignmentInstruction}` : "",
        selectedStandardText ? `Selected standard: ${input.selectedStandardCode ?? input.selectedStandardId ?? ""} ${selectedStandardText}` : "",
        supportOptions.length ? `Support options: ${supportOptions.join(", ")} (${supportOptionLabels(supportOptions).join(", ")})` : "",
        supportOptions.length
          ? [
              "Support option rules:",
              "- easy_language: put difficult words into keywords with short easyMeaning.",
              "- step_breakdown: keep 3-5 steps but make each step a concrete action.",
              "- visual_hint: choose visualHint from the actual subject and task. Use rectangle_dimension only for geometry tasks that need side/dimension labels, number_line for number/fraction line tasks, sequence_checklist for ordered reading/process/lifecycle tasks, image_asset only when a static illustration is essential, and text_only when a visual would be misleading.",
              "- repeat_check: include one simple microQuiz for every step. The quiz must check the current step's concept or action, not ask meta questions about step order such as 'second step' or 'third step'.",
              "- help_sentence: write a natural sentence the student can say to the teacher for every step.",
              "- life_example: include a daily-life example in easyExplanation or review.homeMission.",
            ].join("\n")
          : "",
        "Create 3 to 5 concrete, executable student steps. Do not return fewer than 3 steps.",
        "Every step must make the student understand what to do next. Avoid vague generated content such as '확인해요' alone; name the exact object/action the student should find, mark, say, write, calculate, or compare.",
        "Every microQuiz must be answerable from the current step. Do not ask the student to identify the step number or sequence label.",
        "Do not reuse a fixed sample. The card must visibly follow the teacher's topic, assignment instruction, selected standard, learner support options, and retrieved RAG context.",
        externalLesson?.agenda ? `Lesson agenda: ${JSON.stringify(externalLesson.agenda)}` : "",
        "Standards/resources:",
        formatResourcesForPrompt(resources),
      ].filter(Boolean).join("\n"),
    });

    const provenance = selectedStandardProvenance(input, resources);
    const validated = ExecutionCardPayloadSchema.parse({
      ...generated,
      title: input.title ?? generated.title,
      lessonId: resolvedLessonId ?? "lesson_ad_hoc",
      standard: {
        ...generated.standard,
        id: generated.standard.id ?? input.selectedStandardId ?? resources[0]?.citations[0]?.standardId,
        code: input.selectedStandardCode ?? generated.standard.code,
        text: generated.standard.text || selectedStandardText || resources[0]?.summary || "선택된 성취기준 정보가 없습니다.",
        sourceType: generated.standard.sourceType ?? provenance.sourceType,
        sourceName: generated.standard.sourceName ?? provenance.sourceName,
        sourceUrl: generated.standard.sourceUrl ?? provenance.sourceUrl,
        license: generated.standard.license ?? provenance.license,
      },
      review: {
        ...generated.review,
        homeMission: homeMissionFor(topic, supportOptions, generated.review.homeMission),
      },
    });
    if (!input.save) return jsonResponse({ card: validated, resources, ragTrace });
    const lessonIdForSave = resolvedLessonId;
    if (!lessonIdForSave) {
      throw new ApiError(400, "missing_lesson_id", "Saving an execution card requires a persisted lessonId.");
    }

    const saved = await updateDb((nextDb) => {
      const cardId = id("card");
      const card: ExecutionCard = {
        id: cardId,
        lessonId: lessonIdForSave,
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
        supportOptionsJson: supportOptions,
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
      nextDb.executionCards.push(card);
      nextDb.executionSteps.push(...steps);
      return { card, steps };
    });

    return jsonResponse({ ...saved, generated: validated, resources, ragTrace }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
