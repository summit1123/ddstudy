const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3001";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const cases = [
  {
    subject: "수학",
    grade: "초4",
    topic: "직사각형의 둘레",
    lessonContent: "직사각형의 가로와 세로를 확인하고 둘레를 구하는 방법을 알아봅니다.",
    assignmentInstruction: "가로와 세로가 주어진 직사각형의 둘레를 식으로 구해보세요.",
    query: "직사각형 둘레",
  },
  {
    subject: "국어",
    grade: "초4",
    topic: "인물의 마음 찾기",
    lessonContent: "글을 읽고 인물의 말과 행동에서 마음이 드러나는 문장을 찾아봅니다.",
    assignmentInstruction: "인물의 마음이 드러난 문장을 하나 찾고 이유를 짧게 써보세요.",
    query: "인물의 마음",
  },
  {
    subject: "과학",
    grade: "초4",
    topic: "식물의 한살이",
    lessonContent: "씨앗이 싹트고 자라 꽃과 열매를 맺는 과정을 순서대로 살펴봅니다.",
    assignmentInstruction: "식물이 자라는 과정을 순서대로 정리하고 각 단계의 특징을 적어보세요.",
    query: "식물의 한살이",
  },
  {
    subject: "수학",
    grade: "초4",
    topic: "분수의 덧셈",
    lessonContent: "분모가 같은 분수의 덧셈에서 분자는 더하고 분모는 그대로 둔다는 점을 알아봅니다.",
    assignmentInstruction: "분모가 같은 분수 덧셈 문제를 풀고 계산 과정을 써보세요.",
    query: "분수 덧셈",
  },
];

console.log("E2E: RAG official metadata and generation diversity");

const visualHintTypes = new Set();
const normalizedStepTexts = [];

for (const item of cases) {
  const search = await request(
    `/api/standards/search?q=${encodeURIComponent(item.query)}&subject=${encodeURIComponent(item.subject)}&gradeBand=${encodeURIComponent(item.grade)}&limit=3`,
  );
  assert(search.results?.length > 0, `${item.topic} should return standards.`);
  const official = search.results.find((result) => result.sourceType === "official") ?? search.results[0];
  assert(official.sourceType === "official", `${item.topic} should use official metadata in this corpus.`);
  assert(official.sourceName && (official.sourceUrl || official.url) && official.license, `${item.topic} should include provenance.`);

  const generated = await request("/api/execution-cards/generate", {
    method: "POST",
    body: JSON.stringify({
      subject: item.subject,
      grade: item.grade,
      gradeBand: item.grade,
      topic: item.topic,
      title: item.topic,
      lessonContent: item.lessonContent,
      assignmentInstruction: item.assignmentInstruction,
      selectedStandardId: official.citations?.[0]?.standardId ?? official.id,
      selectedStandardCode: official.standardCode,
      selectedStandardText: official.summary,
      selectedStandardSourceType: official.sourceType,
      selectedStandardSourceName: official.sourceName,
      selectedStandardSourceUrl: official.sourceUrl ?? official.url,
      selectedStandardLicense: official.license,
      supportOptions: ["easy_language", "step_breakdown", "visual_hint", "repeat_check", "help_sentence", "life_example"],
      save: false,
    }),
  });

  assert(generated.card?.steps?.length >= 3, `${item.topic} should generate at least 3 steps.`);
  assert(generated.card.steps.length <= 5, `${item.topic} should generate at most 5 steps.`);
  assert(generated.card.subject === item.subject, `${item.topic} should preserve subject.`);
  assert(generated.card.standard.sourceType === official.sourceType, `${item.topic} should preserve sourceType provenance.`);
  assert(generated.card.standard.sourceName === official.sourceName, `${item.topic} should preserve sourceName provenance.`);
  assert(generated.card.standard.license === official.license, `${item.topic} should preserve license provenance.`);
  assert(generated.card.review?.homeMission, `${item.topic} should include a life-example home mission.`);
  assert(generated.ragTrace?.promptFields?.retrievedStandards === true, `${item.topic} should trace retrieved standards.`);
  assert(generated.ragTrace?.retrievedContext?.some((context) => context.sourceType === "official"), `${item.topic} should trace official metadata context.`);

  for (const step of generated.card.steps) {
    visualHintTypes.add(step.visualHint.type);
    normalizedStepTexts.push(`${item.topic}: ${step.stepText}`);
  }

  if (item.subject !== "수학" || !item.topic.includes("직사각형")) {
    const joined = generated.card.steps.map((step) => step.stepText).join(" ");
    assert(!joined.includes("가로와 세로를 찾아요"), `${item.topic} should not reuse the rectangle sample step verbatim.`);
  }
}

assert(new Set(normalizedStepTexts).size >= cases.length * 2, "Generated steps should vary across topics.");
assert(visualHintTypes.size >= 2, "Generated cards should use more than one visual hint type across diverse topics.");

console.log(JSON.stringify({
  ok: true,
  cases: cases.map((item) => item.topic),
  visualHintTypes: Array.from(visualHintTypes).sort(),
}, null, 2));
