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
  if (includesAny(key, ["비례", "반비례", "정비례"])) {
    return {
      type: "text_only",
      data: {
        text: "비례: 사과 수가 1개에서 2개로 늘면 가격도 500원에서 1000원으로 늘어요.\n반비례: 같은 거리를 갈 때 속도가 빨라지면 걸리는 시간은 줄어요.",
      },
      assetUrl: null,
      alt: "비례와 반비례를 비교하는 예시",
    };
  }
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
  const templates = includesAny(key, ["비례", "반비례", "정비례"])
    ? [
        ["개념 알아보기: 비례와 반비례가 어떻게 다른지 예시표로 확인해요.", "사과 수가 늘 때 가격도 같이 늘어나면 어떤 관계인가요?", "비례"],
        ["기초 문제: 사과 1개가 500원일 때 2개와 3개 가격을 구해요.", "사과 3개 가격은 얼마인가요?", "1500원"],
        ["응용 문제: 같은 거리를 갈 때 속도가 빨라지면 걸리는 시간이 어떻게 되는지 써요.", "같은 거리에서 속도가 빨라지면 시간은 어떻게 되나요?", "줄어든다"],
        ["정리하기: 비례 예시 하나와 반비례 예시 하나를 각각 적어요.", "마지막에 구분해서 적을 것은 무엇인가요?", "비례와 반비례 예시"],
      ]
    : includesAny(key, ["직사각형", "둘레", "가로", "세로"])
    ? [
        ["개념 알아보기: 둘레가 도형의 바깥 선 전체 길이라는 뜻을 확인해요.", "둘레는 도형의 어느 부분 길이인가요?", "바깥 선"],
        ["기초 문제: 문제에서 가로와 세로 길이를 찾아 표시해요.", "둘레를 구하려면 먼저 무엇을 찾나요?", "가로와 세로"],
        ["응용 문제: (가로 + 세로) x 2 식으로 둘레를 계산해요.", "직사각형 둘레 식에 들어가는 것은 무엇인가요?", "가로와 세로"],
        ["정리하기: 계산한 답에 단위를 붙여 다시 확인해요.", "마지막에 꼭 붙일 것은 무엇인가요?", "단위"],
      ]
    : includesAny(key, ["분수", "덧셈"])
      ? [
          ["개념 알아보기: 분모가 같은 분수는 같은 크기 조각끼리 더한다는 뜻을 확인해요.", "분수 덧셈에서 먼저 볼 것은 무엇인가요?", "분모"],
          ["기초 문제: 분자는 더하고 분모는 그대로 두어요.", "분모가 같을 때 더하는 부분은 어디인가요?", "분자"],
          ["응용 문제: 수직선이나 그림으로 답이 맞는지 확인해요.", "답을 다시 확인할 때 볼 수 있는 것은 무엇인가요?", "수직선"],
        ]
      : includesAny(key, ["식물", "한살이", "과정"])
        ? [
            ["개념 알아보기: 식물의 한살이가 씨앗에서 다시 씨앗으로 이어진다는 뜻을 확인해요.", "식물의 한살이는 무엇에서 시작하나요?", "씨앗"],
            ["기초 문제: 싹, 줄기, 잎, 꽃, 열매를 순서대로 놓아요.", "식물의 변화를 어떻게 정리하나요?", "순서대로"],
            ["응용 문제: 각 단계에서 달라진 점을 짧게 적어요.", "마지막에 적을 것은 무엇인가요?", "달라진 점"],
          ]
        : [
            ["개념 알아보기: 인물의 마음은 말과 행동에서 알 수 있다는 점을 확인해요.", "인물의 마음을 알기 위해 먼저 찾을 것은 무엇인가요?", "말과 행동"],
            ["기초 문제: 글에서 인물의 말이나 행동이 보이는 문장을 찾아요.", "글에서 찾을 것은 무엇인가요?", "문장"],
            ["응용 문제: 그 문장을 보고 인물의 마음과 이유를 짧게 써요.", "마지막에 함께 써야 할 것은 무엇인가요?", "이유"],
          ];

  const hintItems = templates.map(([stepText]) => stepText.replace(/[.。]$/, ""));
  return templates.map(([stepText, question, answer], index) => ({
    order: index + 1,
    stepText,
    visualHint: visualHintFor(topic, subject, hintItems),
    microQuiz: {
      question,
      choices: [answer, ...distractorsFor(answer, key)].filter((choice, choiceIndex, choices) => choices.indexOf(choice) === choiceIndex).slice(0, 3),
      answer,
      explanation: `이번 단계의 핵심: '${answer}'. 이 부분을 확인하면 다음 행동으로 넘어갈 수 있어요.`,
    },
    helpSentence: `선생님, ${stepText.replace(/[.。]$/, "")} 부분을 같이 확인하고 싶어요.`,
    teacherTip: "학생이 바로 할 수 있는 한 행동만 짚어 주고 다음 단계로 넘어가게 도와주세요.",
  }));
}

function distractorsFor(answer: string, key: string) {
  if (includesAny(key, ["비례", "반비례", "정비례"])) {
    if (answer === "비례") return ["반비례", "관계 없음"];
    if (answer === "1500원") return ["1000원", "500원"];
    if (answer === "줄어든다") return ["늘어난다", "그대로이다"];
    return ["색깔", "글자 크기"];
  }
  if (includesAny(key, ["직사각형", "둘레", "가로", "세로"])) {
    if (answer === "바깥 선") return ["안쪽 색", "이름"];
    if (answer === "가로와 세로") return ["날짜", "그림 제목"];
    if (answer === "단위") return ["색깔", "문제 번호"];
  }
  if (includesAny(key, ["분수", "덧셈"])) {
    if (answer === "분모") return ["분자", "제목"];
    if (answer === "분자") return ["분모", "색깔"];
    return ["자", "시계"];
  }
  if (includesAny(key, ["식물", "한살이", "과정"])) {
    if (answer === "씨앗") return ["열매", "돌"];
    if (answer === "순서대로") return ["아무렇게나", "큰 것부터"];
    return ["색깔만", "글자 수"];
  }
  if (answer === "말과 행동") return ["글자 크기", "종이 색깔"];
  if (answer === "문장") return ["그림자", "페이지 번호"];
  if (answer === "이유") return ["날짜", "글자 수"];
  return ["다른 과제", "종이 색깔"];
}

function localKeywords(topic: string, subject: string): GeneratedExecutionCard["keywords"] {
  const key = `${subject} ${topic}`;
  const glossary: Record<string, string> = includesAny(key, ["비례", "반비례", "정비례"])
    ? {
        비례: "한쪽이 늘 때 다른 쪽도 같이 늘어나는 관계",
        반비례: "한쪽이 늘 때 다른 쪽은 줄어드는 관계",
        관계: "두 가지가 서로 어떻게 바뀌는지 보는 것",
      }
    : includesAny(key, ["직사각형", "둘레", "가로", "세로"])
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

function topicalTokens(value: string) {
  const stop = new Set([
    "수학",
    "국어",
    "과학",
    "사회",
    "초등",
    "수업",
    "과제",
    "예시",
    "내용",
    "학생",
    "해요",
    "하세요",
  ]);
  return tokenizeKorean(value)
    .filter((token) => !stop.has(token))
    .filter((token) => !/^초\d+$/.test(token))
    .filter((token) => !/^\d+학년$/.test(token));
}

function resourceMatchesTopic(resource: Resource & { score?: number }, query: string) {
  const tokens = topicalTokens(query);
  if (!tokens.length) return true;
  const haystack = `${resource.title} ${resource.standardCode ?? ""} ${resource.summary}`.toLowerCase();
  return tokens.some((token) => haystack.includes(token.toLowerCase()));
}

async function searchGenerationResources({
  subject,
  gradeBand,
  topic,
  lessonContent,
  assignmentInstruction,
  objectives,
}: {
  subject: string;
  gradeBand: string;
  topic: string;
  lessonContent?: string;
  assignmentInstruction?: string;
  objectives?: string[];
}) {
  const query = [
    subject,
    gradeBand,
    topic,
    lessonContent,
    assignmentInstruction,
    ...(objectives ?? []),
  ].filter(Boolean).join(" ");
  const relevanceQuery = topicalTokens(topic).length ? topic : query;

  const strict = await searchResources({ q: query, subject, gradeBand, limit: 8 });
  const strictRelevant = strict.filter((resource) => resourceMatchesTopic(resource, relevanceQuery));
  if (strictRelevant.length) return strictRelevant.slice(0, 5);

  const broad = await searchResources({ q: query, subject, limit: 8 });
  const broadRelevant = broad.filter((resource) => resourceMatchesTopic(resource, relevanceQuery));
  if (broadRelevant.length) return broadRelevant.slice(0, 5);

  return strict.slice(0, 5);
}

function localEasyExplanation(topic: string, assignmentInstruction?: string) {
  const mission = assignmentInstruction ? ` 과제는 ${assignmentInstruction}` : "";
  return `오늘은 '${topic}' 주제를 작은 행동으로 나누어 연습해요.${mission}`;
}

function hasSelfContainedMaterial(value?: string | null) {
  if (!value) return false;
  return value.length >= 60 && /(읽을 글|다음 글|문제|자료|상황|관찰|계산|보기)/.test(value);
}

function studentMaterialFor({
  subject,
  topic,
  lessonContent,
  assignmentInstruction,
  generatedGoal,
}: {
  subject: string;
  topic: string;
  lessonContent?: string;
  assignmentInstruction?: string;
  generatedGoal?: string;
}): string {
  if (typeof generatedGoal === "string" && hasSelfContainedMaterial(generatedGoal)) {
    return generatedGoal.trim();
  }

  const key = `${subject} ${topic} ${assignmentInstruction ?? ""}`;
  const mission = assignmentInstruction?.trim() || `${topic} 과제를 해결해 보세요.`;

  if (includesAny(key, ["비례", "반비례", "정비례"])) {
    return [
      "풀 문제",
      "사과 1개 가격은 500원, 2개 가격은 1000원, 3개 가격은 1500원이에요.",
      "같은 길을 갈 때 1시간에 60km로 가면 2시간, 1시간에 120km로 가면 1시간이 걸려요.",
      "두 상황을 보고 어느 것은 비례이고 어느 것은 반비례인지 구분해 보세요.",
      "",
      `해야 할 일: ${mission}`,
    ].join("\n");
  }

  if (includesAny(key, ["직사각형", "둘레", "가로", "세로"])) {
    return [
      "문제",
      "가로가 8cm, 세로가 5cm인 직사각형이 있어요.",
      "이 직사각형의 둘레를 구하고, 어떤 식으로 계산했는지 한 줄로 써보세요.",
      "",
      `해야 할 일: ${mission}`,
    ].join("\n");
  }

  if (includesAny(key, ["분수", "덧셈"])) {
    return [
      "문제",
      "민아는 피자 2/5조각을 먹고, 동생은 1/5조각을 먹었어요.",
      "두 사람이 먹은 피자는 모두 몇 조각인지 분수로 구해보세요.",
      "",
      `해야 할 일: ${mission}`,
    ].join("\n");
  }

  if (includesAny(key, ["식물", "한살이", "씨앗", "싹", "꽃", "열매"])) {
    return [
      "살펴볼 자료",
      "씨앗이 흙 속에서 물을 먹고 싹을 틔웠어요.",
      "며칠 뒤 줄기와 잎이 자라고, 시간이 더 지나 꽃이 피었어요.",
      "꽃이 진 자리에는 열매가 생기고 그 안에 새 씨앗이 들어 있었어요.",
      "",
      `해야 할 일: ${mission}`,
    ].join("\n");
  }

  if (includesAny(key, ["인물", "마음", "글", "문장", "국어"])) {
    return [
      "읽을 글",
      "민지는 발표 시간이 다가오자 손을 꼭 잡고 고개를 숙였어요.",
      '친구가 "괜찮아?"라고 묻자 민지는 작은 목소리로 "조금 떨려."라고 말했어요.',
      '선생님이 "천천히 해도 괜찮아."라고 하자 민지는 조금 웃으며 고개를 끄덕였어요.',
      "",
      `해야 할 일: ${mission}`,
    ].join("\n");
  }

  if (includesAny(key, ["준비물", "규칙", "생활", "학교생활"])) {
    return [
      "상황",
      "아침에 교실에 도착했는데 오늘 미술 시간에 필요한 색종이가 가방에 없어요.",
      "수업이 시작되기 전에 내가 할 수 있는 행동을 차례대로 생각해 보세요.",
      "",
      `해야 할 일: ${mission}`,
    ].join("\n");
  }

  return [
    "학습 자료",
    lessonContent?.trim() || generatedGoal?.trim() || `${topic}에 대해 오늘 배운 내용을 떠올려 봐요.`,
    "",
    `해야 할 일: ${mission}`,
  ].join("\n");
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

function withProgressionLabel(stepText: string, index: number) {
  if (/^(개념 알아보기|기초 문제|응용 문제|정리하기|마무리)/.test(stepText)) return stepText;
  const labels = ["개념 알아보기", "기초 문제", "응용 문제", "정리하기", "마무리"];
  return `${labels[index] ?? "마무리"}: ${stepText}`;
}

function prepareGeneratedCardForStudent(
  generated: GeneratedExecutionCard,
  subject: string,
  topic: string,
  lessonContent: string | undefined,
  assignmentInstruction: string | undefined,
  supportOptions: string[],
): GeneratedExecutionCard {
  const key = `${subject} ${topic}`;
  const normalizedSteps = includesAny(key, ["비례", "반비례", "정비례"])
    ? localStepsFor({ subject, topic, assignmentInstruction })
    : generated.steps;
  const stepItems = normalizedSteps.map((step) => step.stepText.replace(/[.。]$/, ""));
  return {
    ...generated,
    goal: studentMaterialFor({
      subject,
      topic,
      lessonContent,
      assignmentInstruction,
      generatedGoal: generated.goal,
    }),
    steps: normalizedSteps.map((step, index) => {
      const answer = step.microQuiz.answer;
      const choices = step.microQuiz.choices.includes(answer)
        ? step.microQuiz.choices
        : [answer, ...step.microQuiz.choices].slice(0, 3);
      return {
        ...step,
        stepText: withProgressionLabel(step.stepText, index),
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
    goal: studentMaterialFor({ subject, topic, lessonContent, assignmentInstruction }),
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
    let selectedStandardText = input.selectedStandardText;

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

    const resources = await searchGenerationResources({
      subject,
      gradeBand,
      topic,
      lessonContent,
      assignmentInstruction,
      objectives,
    });
    selectedStandardText = selectedStandardText ?? resources[0]?.summary;
    const selectedStandardCode = input.selectedStandardCode ?? resources[0]?.standardCode;
    const selectedStandardId = input.selectedStandardId ?? resources[0]?.citations[0]?.standardId ?? resources[0]?.id;
    const ragTrace = buildRagTrace({
      input: {
        ...input,
        selectedStandardId,
        selectedStandardCode,
        selectedStandardText,
        selectedStandardSourceType: input.selectedStandardSourceType ?? resources[0]?.sourceType,
        selectedStandardSourceName: input.selectedStandardSourceName ?? resources[0]?.sourceName,
        selectedStandardSourceUrl: input.selectedStandardSourceUrl ?? resources[0]?.sourceUrl ?? resources[0]?.url,
        selectedStandardLicense: input.selectedStandardLicense ?? resources[0]?.license,
      },
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
          selectedStandardText ? `Auto-selected standard: ${selectedStandardCode ?? selectedStandardId ?? ""} ${selectedStandardText}` : "",
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
          "Use this learning progression unless the task truly requires a different order: step 1 concept check, step 2 basic guided practice, step 3 applied practice or written explanation, optional step 4 final check. Do not make every step the same kind of example.",
          "The goal field is not a teacher objective. It must be the self-contained student material/problem shown before the steps: include the short passage for reading tasks, concrete numbers for math tasks, observation/situation text for science or life tasks, and the exact thing the student should use to answer.",
          "When a step asks the student to write, explain, calculate, or choose an answer, make that step text explicitly answerable from the material in goal.",
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
    const prepared = prepareGeneratedCardForStudent(generated, subject, topic, lessonContent, assignmentInstruction, supportOptions);
    const validated = ExecutionCardPayloadSchema.parse({
      ...prepared,
      title: input.title ?? prepared.title,
      lessonId: resolvedLessonId ?? "lesson_ad_hoc",
      standard: {
        ...prepared.standard,
        id: prepared.standard.id ?? selectedStandardId,
        code: selectedStandardCode ?? prepared.standard.code,
        text: selectedStandardText || resources[0]?.summary || prepared.standard.text || "연결된 교육과정 기준 정보가 없습니다.",
        sourceType: provenance.sourceType ?? prepared.standard.sourceType,
        sourceName: provenance.sourceName ?? prepared.standard.sourceName,
        sourceUrl: provenance.sourceUrl ?? prepared.standard.sourceUrl,
        license: provenance.license ?? prepared.standard.license,
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
