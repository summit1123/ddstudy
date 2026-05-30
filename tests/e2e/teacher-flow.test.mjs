const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3001";
const testName = "teacher creates card, edits steps, publishes, student completes, report updates";

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

console.log(`E2E: ${testName}`);

const standardSearch = await request(
  "/api/standards/search?q=%EA%B5%AD%EC%96%B4%20%EC%9D%B8%EB%AC%BC%EC%9D%98%20%EB%A7%88%EC%9D%8C&subject=%EA%B5%AD%EC%96%B4&gradeBand=%EC%B4%884&limit=3",
);
assert(standardSearch.results?.length > 0, "Expected at least one RAG standard search result.");
const standard = standardSearch.results[0];
assert(standard.sourceType, "Standard search result should include sourceType provenance.");
assert(standard.sourceName, "Standard search result should include sourceName provenance.");
assert("license" in standard, "Standard search result should include a license field, even when terms need review.");

const officialSearch = await request(
  "/api/standards/search?q=%EC%93%B0%EA%B8%B0&sourceType=official&limit=1",
);
assert(officialSearch.results?.length > 0, "Expected at least one official/crawled public-data row in pgvector.");
assert(officialSearch.results[0].sourceType === "official", "sourceType=official filter should return official rows only.");
assert(officialSearch.results[0].sourceName, "Official result should include sourceName.");
assert(officialSearch.results[0].sourceUrl || officialSearch.results[0].url, "Official result should include source URL.");
assert(officialSearch.results[0].standardCode, "Official result should include a standardCode.");

const officialSearchCases = [
  ["/api/standards/search?q=%EC%A7%81%EC%82%AC%EA%B0%81%ED%98%95%20%EB%91%98%EB%A0%88&subject=%EC%88%98%ED%95%99&gradeBand=%EC%B4%884&limit=2", "직사각형 둘레"],
  ["/api/standards/search?q=%EC%9D%B8%EB%AC%BC%EC%9D%98%20%EB%A7%88%EC%9D%8C&subject=%EA%B5%AD%EC%96%B4&gradeBand=%EC%B4%884&limit=2", "인물의 마음"],
  ["/api/standards/search?q=%EC%8B%9D%EB%AC%BC%EC%9D%98%20%ED%95%9C%EC%82%B4%EC%9D%B4&subject=%EA%B3%BC%ED%95%99&gradeBand=%EC%B4%884&limit=2", "식물의 한살이"],
  ["/api/standards/search?q=%EB%B6%84%EC%88%98%20%EB%8D%A7%EC%85%88&subject=%EC%88%98%ED%95%99&gradeBand=%EC%B4%884&limit=2", "분수 덧셈"],
  ["/api/standards/search?q=%EA%B8%B8%EC%9D%B4%20%EB%8B%A8%EC%9C%84&subject=%EC%88%98%ED%95%99&gradeBand=%EC%B4%882&limit=2", "길이 단위"],
];

for (const [path, label] of officialSearchCases) {
  const result = await request(path);
  assert(result.results?.some((item) => item.sourceType === "official"), `${label} should return official metadata rows.`);
  const first = result.results[0];
  assert(first.sourceName && (first.sourceUrl || first.url) && first.license, `${label} should include provenance fields.`);
}

const unique = Date.now().toString(36);
const topic = `인물의 마음 ${unique}`;
const selectedCode = standard.standardCode ?? standard.citations?.[0]?.standardId ?? standard.id;
const selectedSourceUrl = standard.sourceUrl ?? standard.url;
const supportOptions = ["easy_language", "step_breakdown", "visual_hint", "repeat_check", "help_sentence", "life_example"];

const lessonResult = await request("/api/lessons", {
  method: "POST",
  body: JSON.stringify({
    teacherId: "teacher_001",
    classroomId: "classroom_4_2",
    schoolId: "school_demo",
    subject: "국어",
    gradeBand: "초4",
    topic,
    title: topic,
    lessonDate: "2026-05-29",
    lessonContent: "글을 읽고 인물의 말과 행동에서 마음이 드러나는 문장을 찾아봅니다.",
    assignmentInstruction: "글에서 인물의 마음이 드러난 문장을 하나 찾고, 왜 그렇게 생각했는지 짧게 써보세요.",
    selectedStandardId: standard.citations?.[0]?.standardId ?? standard.id,
    selectedStandardText: standard.summary,
    selectedStandardSourceType: standard.sourceType,
    selectedStandardSourceName: standard.sourceName,
    selectedStandardSourceUrl: selectedSourceUrl,
    selectedStandardLicense: standard.license,
    supportOptions,
    objectives: [standard.summary],
  }),
});
assert(lessonResult.lesson?.id, "Lesson should be persisted.");

const generated = await request("/api/execution-cards/generate", {
  method: "POST",
  body: JSON.stringify({
    lessonId: lessonResult.lesson.id,
    subject: "국어",
    grade: "초4",
    gradeBand: "초4",
    topic,
    title: topic,
    lessonContent: lessonResult.lesson.lessonContent,
    assignmentInstruction: lessonResult.lesson.assignmentInstruction,
    selectedStandardId: standard.citations?.[0]?.standardId ?? standard.id,
    selectedStandardCode: selectedCode,
    selectedStandardText: standard.summary,
    selectedStandardSourceType: standard.sourceType,
    selectedStandardSourceName: standard.sourceName,
    selectedStandardSourceUrl: selectedSourceUrl,
    selectedStandardLicense: standard.license,
    supportOptions,
    save: true,
  }),
});
assert(generated.card?.id, "Generated execution card should be saved.");
assert(generated.steps?.length >= 3, "Generated card should include 3 to 5 executable steps.");
assert(generated.steps.length <= 5, "Generated card should not exceed the final schema step limit.");
assert(generated.card.subject === "국어", "Generated card should preserve teacher subject.");
assert(generated.card.standardJson.code === selectedCode, "Generated card should preserve selected standard code.");
assert(generated.card.standardJson.sourceType === standard.sourceType, "Generated card should preserve selected sourceType.");
assert(generated.card.standardJson.sourceName === standard.sourceName, "Generated card should preserve selected sourceName.");
assert(generated.card.standardJson.license === standard.license, "Generated card should preserve selected license.");
assert(generated.card.supportOptionsJson.includes("life_example"), "Generated card should persist canonical support options.");
assert(generated.card.reviewJson.homeMission, "life_example support should create a homeMission.");
assert(generated.ragTrace?.promptFields?.retrievedStandards === true, "Generation response should trace retrieved standards in the prompt context.");
assert(generated.ragTrace?.promptFields?.selectedStandard === true, "Generation response should trace selected standard in the prompt context.");
assert(generated.ragTrace?.promptFields?.lessonContent === true, "Generation response should trace lessonContent in the prompt context.");
assert(generated.ragTrace?.promptFields?.assignmentInstruction === true, "Generation response should trace assignmentInstruction in the prompt context.");
assert(generated.ragTrace?.retrievedContext?.some((item) => item.sourceType === "official"), "RAG trace should include official metadata context.");
assert(generated.ragTrace?.selectedStandard?.sourceType === standard.sourceType, "RAG trace should include selected standard provenance.");
if (selectedSourceUrl) {
  assert(generated.card.standardJson.sourceUrl === selectedSourceUrl, "Generated card should preserve selected source URL.");
}

const originalSteps = generated.steps;
const editedStepText = `${originalSteps[1]?.stepText ?? originalSteps[0].stepText} / 저장 확인`;
const editedSteps = [
  {
    id: originalSteps[1]?.id ?? originalSteps[0].id,
    order: 1,
    stepText: editedStepText,
    visualHint: originalSteps[1]?.visualHintJson ?? originalSteps[0].visualHintJson,
    microQuiz: originalSteps[1]?.microQuizJson ?? originalSteps[0].microQuizJson,
    helpSentence: originalSteps[1]?.helpSentence ?? originalSteps[0].helpSentence,
    teacherTip: originalSteps[1]?.teacherTip ?? originalSteps[0].teacherTip,
  },
  ...originalSteps.slice(2).map((step, index) => ({
    id: step.id,
    order: index + 2,
    stepText: step.stepText,
    visualHint: step.visualHintJson,
    microQuiz: step.microQuizJson,
    helpSentence: step.helpSentence,
    teacherTip: step.teacherTip,
  })),
  {
    order: originalSteps.length + 1,
    stepText: "내가 찾은 문장과 이유를 다시 읽고 확인해요.",
    visualHint: { type: "sequence_checklist", data: { items: ["문장 확인", "이유 확인", "다시 읽기"] }, assetUrl: null, alt: null },
    microQuiz: { question: "마지막에 확인할 것은 무엇인가요?", choices: ["문장과 이유", "글자 크기"], answer: "문장과 이유", explanation: "찾은 문장과 이유가 과제의 핵심이에요." },
    helpSentence: "선생님, 제가 고른 문장과 이유가 맞는지 봐주세요.",
    teacherTip: "학생이 고른 근거 문장과 이유가 연결되는지 확인해 주세요.",
  },
];

await request(`/api/execution-cards/${generated.card.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    title: generated.card.title,
    goal: generated.card.goal,
    subject: generated.card.subject,
    grade: generated.card.grade,
    topic: generated.card.topic,
    standard: generated.card.standardJson,
    keywords: generated.card.keywordsJson,
    easyExplanation: generated.card.easyExplanation,
    review: generated.card.reviewJson,
    steps: editedSteps,
    status: "draft",
  }),
});

const reloaded = await request(`/api/execution-cards/${generated.card.id}`);
assert(reloaded.steps[0].stepText === editedStepText, "Edited step text should persist after reload.");
assert(reloaded.steps.length === editedSteps.length, "Added/deleted/reordered steps should persist.");

await request(`/api/execution-cards/${generated.card.id}/publish`, { method: "POST" });
const task = await request(`/api/student/tasks/${generated.card.id}`);
assert(task.card.id === generated.card.id, "Student task should load by URL cardId.");
const firstStep = task.steps[0];

await request(`/api/student/tasks/${generated.card.id}/steps/${firstStep.id}/start`, { method: "POST" });
await request(`/api/student/tasks/${generated.card.id}/steps/${firstStep.id}/confused`, { method: "POST" });
await request(`/api/student/tasks/${generated.card.id}/steps/${firstStep.id}/simplify`, { method: "POST" });
await request(`/api/student/tasks/${generated.card.id}/steps/${firstStep.id}/help-sentence`, { method: "POST" });
await request(`/api/student/tasks/${generated.card.id}/steps/${firstStep.id}/quiz`, {
  method: "POST",
  body: JSON.stringify({ answer: firstStep.microQuizJson.answer }),
});
const completeResult = await request(`/api/student/tasks/${generated.card.id}/steps/${firstStep.id}/complete`, { method: "POST" });
assert(completeResult.summary.helpRequestCount >= 3, "Student help events should be counted in summary.");

const report = await request(`/api/reports/students/${task.studentId}?cardId=${generated.card.id}`);
assert(report.summary.helpRequestCount >= 3, "Teacher report should reflect student help logs.");
assert(report.perStep?.length === reloaded.steps.length, "Report should include per-step flow for the edited card.");

console.log(JSON.stringify({
  ok: true,
  testName,
  cardId: generated.card.id,
  lessonId: lessonResult.lesson.id,
  helpRequestCount: report.summary.helpRequestCount,
  completionRate: report.summary.completionRate,
}, null, 2));
