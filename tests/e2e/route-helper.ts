import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

let routesPromise: Promise<Record<string, unknown>> | null = null;

function loadRoutes() {
  routesPromise ??= (async () => {
    const classroomContext = await import("../../src/app/api/classroom/context/route");
    const executionCardGenerate = await import("../../src/app/api/execution-cards/generate/route");
    const executionCard = await import("../../src/app/api/execution-cards/[id]/route");
    const executionCardPublish = await import("../../src/app/api/execution-cards/[id]/publish/route");
    const lessons = await import("../../src/app/api/lessons/route");
    const reports = await import("../../src/app/api/reports/students/[studentId]/route");
    const standards = await import("../../src/app/api/standards/search/route");
    const students = await import("../../src/app/api/students/route");
    const studentTask = await import("../../src/app/api/student/tasks/[cardId]/route");
    const retryTask = await import("../../src/app/api/student/tasks/[cardId]/retry/route");
    const reviewTask = await import("../../src/app/api/student/tasks/[cardId]/review/route");
    const complete = await import("../../src/app/api/student/tasks/[cardId]/steps/[stepId]/complete/route");
    const confused = await import("../../src/app/api/student/tasks/[cardId]/steps/[stepId]/confused/route");
    const helpSentence = await import("../../src/app/api/student/tasks/[cardId]/steps/[stepId]/help-sentence/route");
    const quiz = await import("../../src/app/api/student/tasks/[cardId]/steps/[stepId]/quiz/route");
    const simplify = await import("../../src/app/api/student/tasks/[cardId]/steps/[stepId]/simplify/route");
    const start = await import("../../src/app/api/student/tasks/[cardId]/steps/[stepId]/start/route");
    return {
      getClassroomContext: classroomContext.GET,
      patchClassroomContext: classroomContext.PATCH,
      generateExecutionCard: executionCardGenerate.POST,
      getExecutionCard: executionCard.GET,
      patchExecutionCard: executionCard.PATCH,
      publishExecutionCard: executionCardPublish.POST,
      postLesson: lessons.POST,
      getStudentReport: reports.GET,
      searchStandards: standards.GET,
      postStudent: students.POST,
      getStudentTask: studentTask.GET,
      retryStudentTask: retryTask.POST,
      reviewStudentTask: reviewTask.POST,
      completeStep: complete.POST,
      confuseStep: confused.POST,
      helpSentenceStep: helpSentence.POST,
      quizStep: quiz.POST,
      simplifyStep: simplify.POST,
      startStep: start.POST,
    };
  })();
  return routesPromise;
}

type RouteContext = { params: Promise<Record<string, string>> };
type RouteHandler = (request: Request, context: RouteContext) => Response | Promise<Response>;

function makeRequest(path: string, options: RequestInit = {}) {
  return new Request(new URL(path, "http://e2e.local"), {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

async function call(handler: unknown, path: string, params: Record<string, string>, options: RequestInit = {}) {
  const route = handler as RouteHandler;
  const response = await route(makeRequest(path, options), { params: Promise.resolve(params) });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

export async function request(path: string, options: RequestInit = {}) {
  const routes = await loadRoutes();
  const url = new URL(path, "http://e2e.local");
  const pathname = url.pathname;
  const fullPath = `${pathname}${url.search}`;
  const method = (options.method ?? "GET").toUpperCase();

  if (pathname === "/api/classroom/context" && method === "GET") {
    return call(routes.getClassroomContext, fullPath, {}, options);
  }
  if (pathname === "/api/classroom/context" && method === "PATCH") {
    return call(routes.patchClassroomContext, fullPath, {}, options);
  }
  if (pathname === "/api/standards/search" && method === "GET") {
    return call(routes.searchStandards, fullPath, {}, options);
  }
  if (pathname === "/api/students" && method === "POST") {
    return call(routes.postStudent, fullPath, {}, options);
  }
  if (pathname === "/api/lessons" && method === "POST") {
    return call(routes.postLesson, fullPath, {}, options);
  }
  if (pathname === "/api/execution-cards/generate" && method === "POST") {
    return call(routes.generateExecutionCard, fullPath, {}, options);
  }

  let match = pathname.match(/^\/api\/execution-cards\/([^/]+)$/);
  if (match && method === "GET") {
    return call(routes.getExecutionCard, fullPath, { id: decodeURIComponent(match[1]) }, options);
  }
  if (match && method === "PATCH") {
    return call(routes.patchExecutionCard, fullPath, { id: decodeURIComponent(match[1]) }, options);
  }
  match = pathname.match(/^\/api\/execution-cards\/([^/]+)\/publish$/);
  if (match && method === "POST") {
    return call(routes.publishExecutionCard, fullPath, { id: decodeURIComponent(match[1]) }, options);
  }

  match = pathname.match(/^\/api\/student\/tasks\/([^/]+)$/);
  if (match && method === "GET") {
    return call(routes.getStudentTask, fullPath, { cardId: decodeURIComponent(match[1]) }, options);
  }
  match = pathname.match(/^\/api\/student\/tasks\/([^/]+)\/retry$/);
  if (match && method === "POST") {
    return call(routes.retryStudentTask, fullPath, { cardId: decodeURIComponent(match[1]) }, options);
  }
  match = pathname.match(/^\/api\/student\/tasks\/([^/]+)\/review$/);
  if (match && method === "POST") {
    return call(routes.reviewStudentTask, fullPath, { cardId: decodeURIComponent(match[1]) }, options);
  }
  match = pathname.match(/^\/api\/student\/tasks\/([^/]+)\/steps\/([^/]+)\/start$/);
  if (match && method === "POST") {
    return call(routes.startStep, fullPath, { cardId: decodeURIComponent(match[1]), stepId: decodeURIComponent(match[2]) }, options);
  }
  match = pathname.match(/^\/api\/student\/tasks\/([^/]+)\/steps\/([^/]+)\/confused$/);
  if (match && method === "POST") {
    return call(routes.confuseStep, fullPath, { cardId: decodeURIComponent(match[1]), stepId: decodeURIComponent(match[2]) }, options);
  }
  match = pathname.match(/^\/api\/student\/tasks\/([^/]+)\/steps\/([^/]+)\/simplify$/);
  if (match && method === "POST") {
    return call(routes.simplifyStep, fullPath, { cardId: decodeURIComponent(match[1]), stepId: decodeURIComponent(match[2]) }, options);
  }
  match = pathname.match(/^\/api\/student\/tasks\/([^/]+)\/steps\/([^/]+)\/help-sentence$/);
  if (match && method === "POST") {
    return call(routes.helpSentenceStep, fullPath, { cardId: decodeURIComponent(match[1]), stepId: decodeURIComponent(match[2]) }, options);
  }
  match = pathname.match(/^\/api\/student\/tasks\/([^/]+)\/steps\/([^/]+)\/quiz$/);
  if (match && method === "POST") {
    return call(routes.quizStep, fullPath, { cardId: decodeURIComponent(match[1]), stepId: decodeURIComponent(match[2]) }, options);
  }
  match = pathname.match(/^\/api\/student\/tasks\/([^/]+)\/steps\/([^/]+)\/complete$/);
  if (match && method === "POST") {
    return call(routes.completeStep, fullPath, { cardId: decodeURIComponent(match[1]), stepId: decodeURIComponent(match[2]) }, options);
  }
  match = pathname.match(/^\/api\/reports\/students\/([^/]+)$/);
  if (match && method === "GET") {
    return call(routes.getStudentReport, fullPath, { studentId: decodeURIComponent(match[1]) }, options);
  }

  throw new Error(`No in-process e2e route for ${method} ${pathname}`);
}
