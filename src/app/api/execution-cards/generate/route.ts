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
  ExecutionCardPayloadStepSchema,
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
type ExecutionCardPayloadStep = z.infer<typeof ExecutionCardPayloadStepSchema>;

function specializeVisualHints(
  steps: ExecutionCardPayloadStep[],
  context: { subject: string; topic: string; assignmentInstruction?: string },
) {
  const lowerContext = `${context.subject} ${context.topic} ${context.assignmentInstruction ?? ""}`.toLowerCase();
  const stepTexts = steps.map((step) => step.stepText);
  const checklistItems = stepTexts.slice(0, 5);

  return steps.map((step, index) => {
    if (lowerContext.match(/직사각형|둘레|가로|세로|사각형/)) {
      return {
        ...step,
        visualHint: {
          type: "rectangle_dimension" as const,
          data: { labels: ["가로", "세로"], focus: index === 0 ? "dimension" : "perimeter" },
          assetUrl: null,
          alt: "직사각형의 가로와 세로를 표시한 그림",
        },
      };
    }

    if (lowerContext.match(/분수|수직선|덧셈|뺄셈/) && context.subject === "수학") {
      return {
        ...step,
        visualHint: {
          type: "number_line" as const,
          data: { start: 0, end: 1, labels: ["0", "1"], focusStep: index + 1 },
          assetUrl: null,
          alt: "0부터 1까지의 수직선",
        },
      };
    }

    if (lowerContext.match(/한살이|과정|순서|자라는|자라나는|단계/)) {
      return {
        ...step,
        visualHint: {
          type: "sequence_checklist" as const,
          data: { items: checklistItems, focusStep: index + 1 },
          assetUrl: null,
          alt: "단계 순서를 확인하는 체크리스트",
        },
      };
    }

    if (lowerContext.match(/인물|마음|문장|글|읽기/)) {
      return {
        ...step,
        visualHint: {
          type: "sequence_checklist" as const,
          data: { items: ["문장 찾기", "말과 행동 확인", "마음 쓰기"], focusStep: index + 1 },
          assetUrl: null,
          alt: "글 읽기 순서를 확인하는 체크리스트",
        },
      };
    }

    return step;
  });
}

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
        "You generate Korean classroom execution cards for the 다음한걸음 demo. Follow the JSON schema exactly, cite only supplied resources, and do not invent standard IDs.",
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
              "- visual_hint: prefer rectangle_dimension, number_line, sequence_checklist, or image_asset over text_only when suitable.",
              "- repeat_check: include one simple microQuiz for every step.",
              "- help_sentence: write a natural sentence the student can say to the teacher for every step.",
              "- life_example: include a daily-life example in easyExplanation or review.homeMission.",
            ].join("\n")
          : "",
        "Create 3 to 5 concrete, executable student steps. Do not return fewer than 3 steps.",
        "Choose visualHint dynamically from the topic: rectangle_dimension for rectangle/perimeter geometry, number_line for fraction/number tasks, sequence_checklist for lifecycle/process/reading-order tasks, and text_only only when no stronger visual hint fits.",
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
    const specialized = ExecutionCardPayloadSchema.parse({
      ...validated,
      steps: specializeVisualHints(validated.steps, { subject, topic, assignmentInstruction }),
    });

    if (!input.save) return jsonResponse({ card: specialized, resources, ragTrace });
    const lessonIdForSave = resolvedLessonId;
    if (!lessonIdForSave) {
      throw new ApiError(400, "missing_lesson_id", "Saving an execution card requires a persisted lessonId.");
    }

    const saved = await updateDb((nextDb) => {
      const cardId = id("card");
      const card: ExecutionCard = {
        id: cardId,
        lessonId: lessonIdForSave,
        title: specialized.title,
        goal: specialized.goal,
        subject: specialized.subject,
        grade: specialized.grade,
        topic: specialized.topic,
        standardJson: {
          id: specialized.standard.id ?? undefined,
          code: specialized.standard.code ?? undefined,
          text: specialized.standard.text,
          sourceType: specialized.standard.sourceType ?? undefined,
          sourceName: specialized.standard.sourceName ?? undefined,
          sourceUrl: specialized.standard.sourceUrl ?? undefined,
          license: specialized.standard.license ?? undefined,
        },
        easyExplanation: specialized.easyExplanation,
        keywordsJson: specialized.keywords,
        supportOptionsJson: supportOptions,
        reviewJson: {
          goodPoints: specialized.review.goodPoints,
          nextReview: specialized.review.nextReview.map((item) => ({
            title: item.title,
            type: item.type,
            description: item.description,
            resourceId: item.resourceId ?? undefined,
          })),
          askTeacherSentence: specialized.review.askTeacherSentence,
          homeMission: specialized.review.homeMission ?? undefined,
        },
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const steps: ExecutionStep[] = specialized.steps.map((step, index) => ({
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

    return jsonResponse({ ...saved, generated: specialized, resources, ragTrace }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
