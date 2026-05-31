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
type GeneratedExecutionCard = z.infer<typeof GeneratedExecutionCardSchema>;

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

function includesAny(value: string, words: string[]) {
  return words.some((word) => value.includes(word));
}

function visualHintFor(topic: string, subject: string, items: string[]): GeneratedExecutionCard["steps"][number]["visualHint"] {
  const key = `${subject} ${topic}`;
  if (includesAny(key, ["직사각형", "둘레", "도형", "가로", "세로"])) {
    return {
      type: "rectangle_dimension",
      data: { labels: ["가로", "세로"] },
      assetUrl: null,
      alt: "가로와 세로를 표시한 직사각형",
    };
  }
  if (includesAny(key, ["분수", "수직선", "등분"])) {
    return {
      type: "number_line",
      data: { start: 0, end: 1 },
      assetUrl: null,
      alt: "분수 위치를 확인하는 수직선",
    };
  }
  if (includesAny(key, ["순서", "과정", "한살이", "인물", "마음", "글", "문장"])) {
    return {
      type: "sequence_checklist",
      data: { items },
      assetUrl: null,
      alt: "과제를 순서대로 확인하는 체크리스트",
    };
  }
  return {
    type: "text_only",
    data: { text: items[0] ?? "지금 할 행동을 하나만 확인해요." },
    assetUrl: null,
    alt: "현재 단계 단서",
  };
}

function localStepsFor({
  subject,
  topic,
  assignmentInstruction,
}: {
  subject: string;
  topic: string;
  assignmentInstruction?: string;
}): GeneratedExecutionCard["steps"] {
  const key = `${subject} ${topic} ${assignmentInstruction ?? ""}`;
  const templates = includesAny(key, ["직사각형", "둘레", "가로", "세로"])
    ? [
        ["문제에서 가로와 세로 길이를 찾아 표시해요.", "둘레를 구하려면 먼저 무엇을 찾나요?", "가로와 세로"],
        ["가로와 세로를 더한 뒤 두 번 더하는 식을 써요.", "직사각형 둘레 식에 들어가는 것은 무엇인가요?", "가로와 세로"],
        ["계산한 답에 단위를 붙여 다시 확인해요.", "마지막에 꼭 붙일 것은 무엇인가요?", "단위"],
      ]
    : includesAny(key, ["분수", "덧셈"])
      ? [
          ["분모가 같은지 먼저 확인해요.", "분수 덧셈에서 먼저 볼 것은 무엇인가요?", "분모"],
          ["분자는 더하고 분모는 그대로 두어요.", "분모가 같을 때 더하는 부분은 어디인가요?", "분자"],
          ["수직선이나 그림으로 답이 맞는지 확인해요.", "답을 다시 확인할 때 볼 수 있는 것은 무엇인가요?", "수직선"],
        ]
      : includesAny(key, ["식물", "한살이", "과정"])
        ? [
            ["씨앗에서 시작하는 첫 장면을 찾아요.", "식물의 한살이는 무엇에서 시작하나요?", "씨앗"],
            ["싹, 줄기, 잎, 꽃, 열매를 순서대로 놓아요.", "식물의 변화를 어떻게 정리하나요?", "순서대로"],
            ["각 단계에서 달라진 점을 짧게 적어요.", "마지막에 적을 것은 무엇인가요?", "달라진 점"],
          ]
        : [
            ["글에서 인물의 말이나 행동이 보이는 문장을 찾아요.", "인물의 마음을 알기 위해 먼저 찾을 것은 무엇인가요?", "말과 행동"],
            ["그 문장을 보고 인물의 마음을 한 단어로 적어요.", "말과 행동을 보고 정리할 것은 무엇인가요?", "인물의 마음"],
            ["내가 그렇게 생각한 이유를 문장 옆에 짧게 써요.", "마지막에 함께 써야 할 것은 무엇인가요?", "이유"],
          ];

  const hintItems = templates.map(([stepText]) => stepText.replace(/[.。]$/, ""));
  return templates.map(([stepText, question, answer], index) => ({
    order: index + 1,
    stepText,
    visualHint: visualHintFor(topic, subject, hintItems),
    microQuiz: {
      question,
      choices: [answer, "글자 크기", "종이 색깔"].filter((choice, choiceIndex, choices) => choices.indexOf(choice) === choiceIndex),
      answer,
      explanation: `이번 단계의 핵심: '${answer}'. 이 부분을 확인하면 다음 행동으로 넘어갈 수 있어요.`,
    },
    helpSentence: `선생님, ${stepText.replace(/[.。]$/, "")} 부분을 같이 확인하고 싶어요.`,
    teacherTip: "학생이 바로 할 수 있는 한 행동만 짚어 주고 다음 단계로 넘어가게 도와주세요.",
  }));
}

function localKeywords(topic: string, subject: string): GeneratedExecutionCard["keywords"] {
  const key = `${subject} ${topic}`;
  const glossary: Record<string, string> = includesAny(key, ["직사각형", "둘레", "가로", "세로"])
    ? {
        직사각형: "네 각이 모두 반듯한 사각형",
        둘레: "도형의 바깥 선을 한 바퀴 돈 길이",
        변: "도형을 둘러싼 곧은 선",
      }
    : includesAny(key, ["분수", "덧셈"])
      ? {
          분모: "분수에서 아래에 있는 수",
          분자: "분수에서 위에 있는 수",
          덧셈: "수를 더하는 계산",
        }
      : includesAny(key, ["식물", "한살이", "과정"])
        ? {
            씨앗: "식물이 자라기 시작하는 작은 알갱이",
            순서: "먼저 할 일부터 차례대로 놓은 것",
            변화: "모양이나 상태가 달라지는 것",
          }
        : includesAny(key, ["인물", "마음", "글", "문장"])
          ? {
              인물: "이야기에 나오는 사람",
              마음: "인물이 느끼는 감정이나 생각",
              이유: "왜 그렇게 생각했는지 알려 주는 말",
            }
          : {};

  const words = Object.keys(glossary).length
    ? Object.keys(glossary)
    : Array.from(new Set(tokenizeKorean(`${topic} ${subject}`))).slice(0, 3);

  return words.slice(0, 3).map((word) => ({
    word,
    easyMeaning: glossary[word] ?? `${word}이 무엇인지 과제 안에서 확인해요.`,
  }));
}

function tokenizeKorean(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .map((item) => item.replace(/(의|을|를|이|가|은|는|과|와)$/u, ""))
    .filter((item) => item.length > 1 && !["찾기", "하기", "구하기", "확인"].includes(item));
}

function localEasyExplanation(topic: string, assignmentInstruction?: string) {
  const mission = assignmentInstruction ? ` 과제는 ${assignmentInstruction}` : "";
  return `오늘은 '${topic}' 주제를 작은 행동으로 나누어 연습해요.${mission}`;
}

function isMetaQuiz(question: string) {
  return /(첫\s*번째|두\s*번째|세\s*번째|마지막|몇\s*번째|단계는|순서)/.test(question);
}

function quizQuestionForStep(stepText: string, topic: string) {
  const key = `${topic} ${stepText}`;
  if (includesAny(key, ["인물", "마음", "말", "행동", "문장"])) {
    if (stepText.includes("말")) return "글에서 먼저 찾아볼 것은 무엇인가요?";
    if (stepText.includes("행동")) return "인물의 마음을 알기 위해 살펴볼 것은 무엇인가요?";
    return "말과 행동을 보고 정리할 것은 무엇인가요?";
  }
  if (includesAny(key, ["직사각형", "둘레", "가로", "세로"])) return "둘레를 구하려면 먼저 무엇을 확인하나요?";
  if (includesAny(key, ["분수", "분모", "분자"])) return "분수 계산에서 지금 확인할 것은 무엇인가요?";
  if (includesAny(key, ["식물", "한살이", "씨앗", "싹", "꽃", "열매"])) return "식물의 변화를 어떻게 정리하나요?";
  return "지금 단계에서 확인할 것은 무엇인가요?";
}

function shouldUseChecklistHint(subject: string, topic: string) {
  return includesAny(`${subject} ${topic}`, ["국어", "인물", "마음", "글", "문장", "식물", "한살이", "과정", "순서"]);
}

function prepareGeneratedCardForStudent(
  generated: GeneratedExecutionCard,
  subject: string,
  topic: string,
  supportOptions: string[],
): GeneratedExecutionCard {
  const stepItems = generated.steps.map((step) => step.stepText.replace(/[.。]$/, ""));
  return {
    ...generated,
    steps: generated.steps.map((step) => {
      const answer = step.microQuiz.answer;
      const choices = step.microQuiz.choices.includes(answer)
        ? step.microQuiz.choices
        : [answer, ...step.microQuiz.choices].slice(0, 3);
      return {
        ...step,
        visualHint:
          hasSupportOption(supportOptions, "visual_hint") &&
          shouldUseChecklistHint(subject, topic) &&
          step.visualHint.type === "text_only"
            ? {
                type: "sequence_checklist",
                data: { items: stepItems },
                assetUrl: null,
                alt: "과제를 순서대로 확인하는 체크리스트",
              }
            : step.visualHint,
        microQuiz: {
          ...step.microQuiz,
          choices,
          question: isMetaQuiz(step.microQuiz.question)
            ? quizQuestionForStep(step.stepText, topic)
            : step.microQuiz.question,
          explanation:
            step.microQuiz.explanation ??
            `이번 단계의 핵심은 '${answer}'입니다. 이 부분을 확인하고 다음으로 넘어가요.`,
        },
      };
    }),
  };
}

function buildLocalExecutionCard({
  input,
  subject,
  gradeBand,
  topic,
  lessonContent,
  assignmentInstruction,
  selectedStandardText,
  resources,
}: {
  input: GenerateExecutionCardInput;
  subject: string;
  gradeBand: string;
  topic: string;
  lessonContent?: string;
  assignmentInstruction?: string;
  selectedStandardText?: string;
  resources: Array<Resource & { score?: number }>;
}): GeneratedExecutionCard {
  const standardResource = resources[0];
  return {
    title: input.title ?? topic,
    goal: lessonContent || assignmentInstruction || `${topic} 과제를 한 단계씩 수행한다.`,
    subject,
    grade: gradeBand,
    topic,
    standard: {
      id: input.selectedStandardId ?? standardResource?.citations[0]?.standardId ?? null,
      code: input.selectedStandardCode ?? standardResource?.standardCode ?? null,
      text: selectedStandardText || standardResource?.summary || `${topic} 관련 성취기준`,
      sourceType: input.selectedStandardSourceType ?? standardResource?.sourceType ?? null,
      sourceName: input.selectedStandardSourceName ?? standardResource?.sourceName ?? null,
      sourceUrl: input.selectedStandardSourceUrl ?? standardResource?.sourceUrl ?? standardResource?.url ?? null,
      license: input.selectedStandardLicense ?? standardResource?.license ?? null,
    },
    keywords: localKeywords(topic, subject),
    easyExplanation: localEasyExplanation(topic, assignmentInstruction),
    steps: localStepsFor({ subject, topic, assignmentInstruction }),
    review: {
      goodPoints: ["과제를 작은 단계로 나누어 시도했어요.", "도움이 필요할 때 말할 문장을 확인했어요."],
      nextReview: [
        {
          title: "첫 단계 다시 보기",
          type: "practice",
          description: "처음 행동을 다시 읽고 같은 방식으로 한 번 더 해봐요.",
          resourceId: null,
        },
      ],
      askTeacherSentence: "선생님, 제가 쓴 답과 이유가 맞는지 확인해 주세요.",
      homeMission: null,
    },
  };
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

    let generationMode: "openai" | "local_fallback" = "openai";
    let generated: GeneratedExecutionCard;
    try {
      generated = await generateJson({
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
    } catch (error) {
      if (process.env.ALLOW_LOCAL_GENERATION_FALLBACK !== "true") throw error;
      generationMode = "local_fallback";
      generated = buildLocalExecutionCard({
        input,
        subject,
        gradeBand,
        topic,
        lessonContent,
        assignmentInstruction,
        selectedStandardText,
        resources,
      });
    }

    const provenance = selectedStandardProvenance(input, resources);
    const prepared = prepareGeneratedCardForStudent(generated, subject, topic, supportOptions);
    const validated = ExecutionCardPayloadSchema.parse({
      ...prepared,
      title: input.title ?? prepared.title,
      lessonId: resolvedLessonId ?? "lesson_ad_hoc",
      standard: {
        ...prepared.standard,
        id: prepared.standard.id ?? input.selectedStandardId ?? resources[0]?.citations[0]?.standardId,
        code: input.selectedStandardCode ?? prepared.standard.code,
        text: prepared.standard.text || selectedStandardText || resources[0]?.summary || "선택된 성취기준 정보가 없습니다.",
        sourceType: prepared.standard.sourceType ?? provenance.sourceType,
        sourceName: prepared.standard.sourceName ?? provenance.sourceName,
        sourceUrl: prepared.standard.sourceUrl ?? provenance.sourceUrl,
        license: prepared.standard.license ?? provenance.license,
      },
      review: {
        ...prepared.review,
        homeMission: homeMissionFor(topic, supportOptions, prepared.review.homeMission),
      },
    });
    if (!input.save) return jsonResponse({ card: validated, resources, ragTrace, generationMode });
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

    return jsonResponse({ ...saved, generated: validated, resources, ragTrace, generationMode }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
