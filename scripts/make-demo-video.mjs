#!/usr/bin/env node

import { chromium } from "playwright";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const outputDir = path.join(root, "artifacts", "demo-video");
const rawDir = path.join(outputDir, "raw");
const framesDir = path.join(outputDir, "frames");
const dbPath = path.join(root, "data", "app-db.json");
const baseUrl = process.env.DEMO_BASE_URL ?? "http://localhost:3001";
const RECORD_WIDTH = 1600;
const RECORD_HEIGHT = 900;
const FINAL_WIDTH = 1600;
const FINAL_HEIGHT = 900;

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

async function resetDemoDb() {
  const now = new Date().toISOString();
  const db = {
    users: [
      {
        id: "teacher_local",
        role: "teacher",
        name: "교사 계정",
        email: "teacher@example.local",
        createdAt: now,
      },
      {
        id: "student_demo_mija",
        role: "student",
        name: "오미자",
        email: null,
        createdAt: now,
      },
    ],
    schools: [
      {
        id: "school_demo_neis",
        schoolName: "서울신용산초등학교",
        schoolCode: "7061073",
        officeCode: "B10",
        address: "서울특별시 용산구 이촌로 255",
        schoolLevel: "초등학교",
        source: "NEIS",
      },
    ],
    classrooms: [
      {
        id: "classroom_default",
        schoolId: "school_demo_neis",
        grade: "4",
        classNo: "1",
        teacherId: "teacher_local",
      },
    ],
    students: [
      {
        id: "student_demo_mija",
        classroomId: "classroom_default",
        nickname: "오미자",
        supportProfileJson: {
          profile: "시각 단서 필요",
          supportOptions: ["visual_hint", "step_breakdown", "life_example"],
        },
        createdAt: now,
      },
    ],
    timetables: [],
    schoolSchedules: [],
    standards: [],
    learningResources: [],
    lessons: [],
    executionCards: [],
    executionSteps: [],
    studentStepLogs: [],
    studentTaskSummaries: [],
    reports: [],
  };
  await mkdir(path.dirname(dbPath), { recursive: true });
  await writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Demo server is not reachable at ${baseUrl}`);
}

async function caption(page, title, detail = "", ms = 2800) {
  await page.evaluate(
    ({ title, detail }) => {
      const existing = document.querySelector("[data-demo-caption]");
      existing?.remove();
      const el = document.createElement("div");
      el.setAttribute("data-demo-caption", "true");
      el.innerHTML = `<strong>${title}</strong>${detail ? `<span>${detail}</span>` : ""}`;
      Object.assign(el.style, {
        position: "fixed",
        zIndex: "99999",
        left: "28px",
        bottom: "28px",
        maxWidth: "520px",
        padding: "16px 18px",
        borderRadius: "18px",
        background: "rgba(15, 23, 42, 0.88)",
        color: "#fff",
        boxShadow: "0 18px 42px rgba(15, 23, 42, 0.28)",
        fontFamily: "Pretendard, Apple SD Gothic Neo, sans-serif",
      });
      const strong = el.querySelector("strong");
      Object.assign(strong.style, { display: "block", fontSize: "20px", fontWeight: "900" });
      const span = el.querySelector("span");
      if (span) Object.assign(span.style, { display: "block", marginTop: "6px", fontSize: "14px", lineHeight: "1.55", color: "#dbeafe" });
      document.body.appendChild(el);
    },
    { title, detail },
  );
  await page.waitForTimeout(ms);
}

async function scenePause(page, ms = 2200) {
  await page.waitForTimeout(ms);
}

async function clearCaption(page) {
  await page.evaluate(() => document.querySelector("[data-demo-caption]")?.remove());
}

async function typeInto(locator, value) {
  await locator.click();
  await locator.fill("");
  await locator.pressSequentially(value, { delay: 18 });
}

async function forceFieldValue(page, selector, value) {
  await page.evaluate(
    ({ selector, value }) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing field: ${selector}`);
      const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      setter?.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { selector, value },
  );
}

async function waitForGenerateReady(page) {
  try {
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll("button")].find((item) =>
        item.textContent?.includes("실행카드 생성"),
      );
      return button && !button.disabled;
    }, null, { timeout: 10_000 });
  } catch {
    const values = await page.evaluate(() => {
      const valueFor = (labelText) => {
        const label = [...document.querySelectorAll("label")].find((item) =>
          item.textContent?.trim().startsWith(labelText),
        );
        const field = label?.querySelector("input, textarea, select");
        return field?.value ?? "";
      };
      const button = [...document.querySelectorAll("button")].find((item) =>
        item.textContent?.includes("실행카드 생성"),
      );
      return {
        student: valueFor("학생"),
        subject: valueFor("과목"),
        topic: valueFor("주제"),
        lessonContent: valueFor("수업 내용"),
        assignmentInstruction: valueFor("과제 지시문"),
        generateButtonDisabled: button?.disabled ?? null,
      };
    });
    throw new Error(`Execution-card generation button stayed disabled: ${JSON.stringify(values)}`);
  }
}

async function requestJson(url, options) {
  const response = await fetch(`${baseUrl}${url}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${url} failed ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

function concatFileLine(filePath) {
  return `file '${filePath.replaceAll("'", "'\\''")}'`;
}

async function createNarration() {
  const narrationSegments = [
    "다음한걸음은 느린학습자가 과제 앞에서 멈추는 순간을 줄이기 위한 실행기능 지원 서비스입니다.",
    "시연은 교사가 나이스 학교 정보와 학생 지원 프로필을 연결한 상태에서 시작합니다.",
    "교사는 수업 준비 화면에서 과목, 수업 내용, 과제 지시문을 입력합니다.",
    "성취기준은 교사가 따로 고르는 것이 아니라, 공개 교육과정 메타데이터를 벡터 검색해 자동으로 연결합니다.",
    "AI는 검색된 기준, 교사 입력, 학생 프로필을 함께 보고 실행카드를 생성합니다.",
    "생성 결과는 개념 설명, 학생이 볼 자료, 지금 할 일, 시각 단서, 확인 퀴즈, 도움 요청 문장으로 나뉩니다.",
    "교사는 생성된 카드를 확인하고, 필요하면 문장과 단계를 수정한 뒤 저장합니다.",
    "저장한 카드는 학생에게 배포되며, 학생 화면에는 같은 카드가 바로 반영됩니다.",
    "학생은 모바일 화면에서 한 번에 한 단계만 봅니다.",
    "답을 적고, 퀴즈에 응답하고, 막히면 모르겠어요나 다시 쉽게 말해줘를 누를 수 있습니다.",
    "도움 문장 보기와 문장 듣기는 학생이 직접 도움을 요청하기 어려운 상황을 보조합니다.",
    "완료, 막힘, 다시 설명, 도움 문장, 퀴즈 기록은 모두 로그로 저장됩니다.",
    "수업 후에는 완료 단계, 도움 요청, 퀴즈 결과가 복구노트로 정리됩니다.",
    "교사는 리포트에서 학생이 어느 단계에서 막혔는지 보고, 학생별 지원 챗봇으로 바로 다음 지원 전략을 확인합니다.",
    "다음한걸음의 핵심은 문제를 많이 내는 것이 아니라, 학생이 다음 행동 하나를 스스로 선택할 수 있게 돕는 것입니다.",
  ];
  await writeFile(path.join(outputDir, "demo-narration.txt"), narrationSegments.join("\n\n"), "utf8");

  const narrationDir = path.join(outputDir, "narration");
  await mkdir(narrationDir, { recursive: true });
  const wavSegments = [];
  for (const [index, text] of narrationSegments.entries()) {
    const response = await fetch(`${baseUrl}/api/voice/tts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ElevenLabs narration segment ${index + 1} failed: ${response.status} ${body}`);
    }
    const mp3Path = path.join(narrationDir, `segment-${String(index + 1).padStart(2, "0")}.mp3`);
    const wavPath = path.join(narrationDir, `segment-${String(index + 1).padStart(2, "0")}.wav`);
    await writeFile(mp3Path, Buffer.from(await response.arrayBuffer()));
    run("ffmpeg", ["-y", "-i", mp3Path, "-ac", "1", "-ar", "44100", "-acodec", "pcm_s16le", wavPath]);
    wavSegments.push(wavPath);
  }

  const silencePath = path.join(narrationDir, "silence-900ms.wav");
  run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=44100:cl=mono",
    "-t",
    "0.9",
    "-acodec",
    "pcm_s16le",
    silencePath,
  ]);
  const concatListPath = path.join(narrationDir, "concat-list.txt");
  const concatEntries = wavSegments.flatMap((segment, index) =>
    index === wavSegments.length - 1 ? [concatFileLine(segment)] : [concatFileLine(segment), concatFileLine(silencePath)],
  );
  await writeFile(concatListPath, `${concatEntries.join("\n")}\n`, "utf8");
  const audioPath = path.join(outputDir, "demo-narration.mp3");
  run("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatListPath,
    "-c:a",
    "libmp3lame",
    "-b:a",
    "160k",
    audioPath,
  ]);
  return audioPath;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function durationOf(filePath) {
  const result = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  return Number.parseFloat(result.stdout.trim());
}

async function recordDemo() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(rawDir, { recursive: true });
  await mkdir(framesDir, { recursive: true });
  await resetDemoDb();
  await waitForServer();

  const consoleEvents = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: RECORD_WIDTH, height: RECORD_HEIGHT },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: rawDir,
      size: { width: RECORD_WIDTH, height: RECORD_HEIGHT },
    },
  });
  const page = await context.newPage();
  const video = page.video();
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleEvents.push({ type: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    consoleEvents.push({ type: "pageerror", text: error.message });
  });

  await page.goto(`${baseUrl}/teacher/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=서울신용산초등학교", { timeout: 20_000 });
  await page.waitForSelector("text=오미자 · 시각 단서 필요", { timeout: 20_000 });
  await caption(page, "1. 교실 운영 설정", "NEIS 학교 정보와 학생 지원 프로필이 연결된 상태에서 시연을 시작합니다.");
  await scenePause(page, 2200);

  await caption(page, "2. 수업 준비", "교사는 수업 내용과 과제 지시문을 입력하고, 학생에게 필요한 지원 옵션을 고릅니다.");
  await page.getByRole("button", { name: /수업 준비 시작/ }).click();
  await page.waitForSelector("text=학생 한 명을 기준으로 실행카드를 만듭니다", { timeout: 20_000 });
  await scenePause(page, 2000);
  await typeInto(page.getByPlaceholder("과목 입력"), "국어");
  await typeInto(page.getByPlaceholder("수업 주제 입력"), "인물의 마음 찾기");
  await typeInto(
    page.getByPlaceholder("오늘 수업에서 다룰 개념과 활동을 입력하세요."),
    "이야기를 읽고 인물의 말과 행동에서 마음을 짐작하는 방법을 배웁니다.",
  );
  await typeInto(
    page.getByPlaceholder("학생이 실제로 수행해야 하는 과제 지시문을 입력하세요."),
    "짧은 글을 읽고 인물의 마음이 드러나는 문장을 찾은 뒤, 왜 그렇게 생각했는지 한 문장으로 써 봅시다.",
  );
  await forceFieldValue(page, 'input[placeholder="과목 입력"]', "국어");
  await forceFieldValue(page, 'input[placeholder="수업 주제 입력"]', "인물의 마음 찾기");
  await forceFieldValue(
    page,
    'textarea[placeholder="오늘 수업에서 다룰 개념과 활동을 입력하세요."]',
    "이야기를 읽고 인물의 말과 행동에서 마음을 짐작하는 방법을 배웁니다.",
  );
  await forceFieldValue(
    page,
    'textarea[placeholder="학생이 실제로 수행해야 하는 과제 지시문을 입력하세요."]',
    "짧은 글을 읽고 인물의 마음이 드러나는 문장을 찾은 뒤, 왜 그렇게 생각했는지 한 문장으로 써 봅시다.",
  );
  await page.getByRole("button", { name: "쉬운 말 필요" }).click();
  await page.getByRole("button", { name: "반복 확인" }).click();
  await page.getByRole("button", { name: "도움 요청 문장" }).click();
  await waitForGenerateReady(page);
  await scenePause(page, 2500);

  await caption(page, "3. AI 실행카드 생성", "RAG 검색 결과와 학생 프로필을 바탕으로 개념, 단계, 퀴즈, 도움 문장을 생성합니다.", 3200);
  await page.getByRole("button", { name: /실행카드 생성/ }).click();
  await page.waitForURL(/\/teacher\/cards\/.+\/edit/, { timeout: 180_000 });
  await page.waitForSelector("text=실행카드 편집", { timeout: 20_000 });
  await scenePause(page, 3200);

  await caption(page, "4. 교사 편집과 배포", "교사는 생성된 자료와 단계를 확인하고 저장한 뒤 학생 화면으로 배포합니다.");
  await page.getByRole("button", { name: /저장/ }).click();
  await scenePause(page, 1800);
  await page.getByRole("button", { name: /학생에게 배포/ }).click();
  await page.waitForSelector("text=배포됨", { timeout: 30_000 });
  await scenePause(page, 2600);

  const contextData = await requestJson("/api/classroom/context");
  const studentId = contextData.students[0].id;
  const cardId = contextData.activeCardId;
  const task = await requestJson(`/api/student/tasks/${encodeURIComponent(cardId)}?studentId=${encodeURIComponent(studentId)}`);

  await caption(page, "5. 학생 수행 화면", "학생은 모바일 화면에서 한 단계씩 보고, 답을 적고, 도움을 요청할 수 있습니다.");
  await page.goto(`${baseUrl}/student/tasks/${encodeURIComponent(cardId)}?studentId=${encodeURIComponent(studentId)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".mvp-work-card", { timeout: 20_000 });
  await scenePause(page, 3200);

  for (const [index, step] of task.steps.entries()) {
    if (index === 0) {
      await page.getByRole("button", { name: "모르겠어요" }).click();
      await scenePause(page, 1600);
      await page.getByRole("button", { name: "다시 쉽게 말해줘" }).click();
      await scenePause(page, 1800);
      const helpButton = page.getByRole("button", { name: /도움 문장 보기/ });
      if (await helpButton.count()) {
        await helpButton.click();
        await scenePause(page, 1800);
      }
    }
    const responseInput = page.getByLabel(/답 쓰는 곳|내 답 적기/);
    if (await responseInput.count()) {
      await typeInto(responseInput.first(), `학생 답 ${index + 1}: ${step.microQuizJson.answer}`);
    }
    const answerButton = page.getByRole("button", { name: step.microQuizJson.answer }).first();
    if (await answerButton.count()) {
      await answerButton.click();
      await scenePause(page, 1600);
    }
    await page.getByRole("button", { name: "완료했어요" }).click();
    if (index < task.steps.length - 1) {
      await page.waitForSelector(`text=완료 단계 ${index + 1}/${task.steps.length}`, { timeout: 20_000 });
      await page.waitForSelector(`text=${index + 2}단계`, { timeout: 20_000 });
      if (index === 1) {
        await caption(page, "3단계 응용 문제로 이동", "기초 문제를 끝내면 학생 화면이 마지막 답 쓰기 단계로 넘어갑니다.", 1900);
      } else {
        await scenePause(page, 1700);
      }
    } else {
      await page.waitForURL(/\/review/, { timeout: 30_000 });
      await scenePause(page, 1800);
    }
  }

  await caption(page, "6. 수업 후 돌아보기", "완료 단계, 도움 기록, 퀴즈 결과와 다음 복습 문장이 학생에게 정리됩니다.");
  await scenePause(page, 3600);

  await caption(page, "7. 교사 리포트", "학생의 막힌 단계와 도움 요청은 리포트와 좌측 학생별 챗봇에서 다시 확인됩니다.");
  await page.goto(`${baseUrl}/teacher/reports/${encodeURIComponent(studentId)}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=리포트 요약", { timeout: 20_000 });
  await scenePause(page, 2800);
  await page.getByRole("button", { name: /프로필 질문하기/ }).click();
  await page.waitForSelector("text=추천 지원", { timeout: 120_000 });
  await scenePause(page, 5200);
  await clearCaption(page);

  await writeFile(path.join(outputDir, "browser-console.json"), JSON.stringify(consoleEvents, null, 2));
  await page.close();
  await context.close();
  await browser.close();

  const videoPath = await video.path();
  const rawVideoPath = path.join(outputDir, "demo-recording.webm");
  await writeFile(rawVideoPath, await readFile(videoPath));
  return rawVideoPath;
}

async function mixAndAudit(rawVideoPath, audioPath) {
  const silentPath = path.join(outputDir, "demo-silent.mp4");
  const finalPath = path.join(outputDir, "daeum-hangeoreum-demo.mp4");
  const contactSheetPath = path.join(outputDir, "frame-contact-sheet.jpg");
  const videoDuration = durationOf(rawVideoPath);
  const audioDuration = durationOf(audioPath);
  const padDuration = Math.max(0, audioDuration - videoDuration + 0.2);
  const videoFilter = padDuration > 0 ? `tpad=stop_mode=clone:stop_duration=${padDuration.toFixed(2)}` : "null";

  run("ffmpeg", [
    "-y",
    "-i",
    rawVideoPath,
    "-vf",
    `scale=${FINAL_WIDTH}:${FINAL_HEIGHT}:force_original_aspect_ratio=decrease,pad=${FINAL_WIDTH}:${FINAL_HEIGHT}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-an",
    silentPath,
  ]);

  run("ffmpeg", [
    "-y",
    "-i",
    silentPath,
    "-i",
    audioPath,
    "-filter:v",
    videoFilter,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    finalPath,
  ]);

  run("ffmpeg", [
    "-y",
    "-i",
    finalPath,
    "-vf",
    "fps=1/12,scale=400:-1,tile=4x3:color=white",
    "-frames:v",
    "1",
    contactSheetPath,
  ]);

  const blackframe = spawnSync("ffmpeg", ["-i", finalPath, "-vf", "blackframe=amount=98:threshold=32", "-an", "-f", "null", "-"], {
    cwd: root,
    encoding: "utf8",
  });
  const finalDuration = durationOf(finalPath);
  const files = await readdir(outputDir);
  const audit = {
    createdAt: new Date().toISOString(),
    baseUrl,
    rawVideo: rawVideoPath,
    silentVideo: silentPath,
    narrationAudio: audioPath,
    finalVideo: finalPath,
    contactSheet: contactSheetPath,
    durations: {
      rawVideoSeconds: videoDuration,
      narrationSeconds: audioDuration,
      finalSeconds: finalDuration,
    },
    videoSize: {
      recorded: `${RECORD_WIDTH}x${RECORD_HEIGHT}`,
      final: `${FINAL_WIDTH}x${FINAL_HEIGHT}`,
    },
    blackframeLines: `${blackframe.stdout}\n${blackframe.stderr}`
      .split(/\r?\n/)
      .filter((line) => line.includes("blackframe")),
    generatedFiles: files.sort(),
  };
  await writeFile(path.join(outputDir, "frame-audit.json"), JSON.stringify(audit, null, 2), "utf8");
  return { finalPath, contactSheetPath, audit };
}

async function main() {
  loadEnvFile(path.join(root, ".env.local"));
  loadEnvFile(path.join(root, ".env"));
  const rawVideoPath = await recordDemo();
  const audioPath = await createNarration();
  const { finalPath, contactSheetPath, audit } = await mixAndAudit(rawVideoPath, audioPath);
  console.log(
    JSON.stringify(
      {
        ok: true,
        outputDir,
        finalVideo: finalPath,
        contactSheet: contactSheetPath,
        durations: audit.durations,
        blackframeCount: audit.blackframeLines.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
