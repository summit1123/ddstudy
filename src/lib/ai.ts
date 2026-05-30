import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const openAiBaseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com";
const generationModel = process.env.OPENAI_GENERATION_MODEL ?? "gpt-4o-mini";
const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

function requireApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ApiError(500, "openai_api_key_missing", "OPENAI_API_KEY is required for AI and RAG endpoints.");
  }
  return apiKey;
}

async function openAiRequest<T>(pathname: string, body: unknown): Promise<T> {
  const response = await fetch(`${openAiBaseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${requireApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload &&
      "error" in payload &&
      typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
        ? (payload as { error: { message: string } }).error.message
        : `OpenAI request failed with status ${response.status}.`;
    throw new ApiError(response.status, "openai_error", message, payload);
  }

  return payload as T;
}

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) return [];

  const payload = await openAiRequest<{
    data?: Array<{ embedding?: number[]; index?: number }>;
  }>("/v1/embeddings", {
    model: embeddingModel,
    input: texts,
  });

  const embeddings = (payload.data ?? [])
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((item) => item.embedding);

  if (embeddings.length !== texts.length || embeddings.some((embedding) => !Array.isArray(embedding))) {
    throw new ApiError(502, "embedding_response_invalid", "OpenAI returned an invalid embedding response.", payload);
  }

  return embeddings as number[][];
}

export async function generateJson<T>({
  name,
  schema,
  system,
  user,
  zodSchema,
}: {
  name: string;
  schema: unknown;
  system: string;
  user: string;
  zodSchema: z.ZodType<T>;
}) {
  const payload = await openAiRequest<{
    choices?: Array<{ message?: { content?: string } }>;
  }>("/v1/chat/completions", {
    model: generationModel,
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name,
        strict: true,
        schema,
      },
    },
  });

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new ApiError(502, "openai_empty_json", "OpenAI did not return JSON content.", payload);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new ApiError(502, "openai_invalid_json", "OpenAI returned malformed JSON.", {
      content,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  const result = zodSchema.safeParse(parsed);
  if (!result.success) {
    throw new ApiError(502, "openai_schema_validation_failed", "OpenAI JSON failed local zod validation.", {
      issues: result.error.issues,
      parsed,
    });
  }

  return result.data;
}

export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function dataRoot() {
  return process.env.DAEUM_DATA_DIR ?? path.join(process.cwd(), ".demo-data");
}

export function dataPath(name: string) {
  return path.join(dataRoot(), name);
}

export async function readJson<T>(name: string, fallback: T): Promise<T> {
  return readJsonAtPath(dataPath(name), fallback);
}

export async function readJsonAtPath<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJson(name: string, value: unknown) {
  await writeJsonAtPath(dataPath(name), value);
}

export async function writeJsonAtPath(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function listCollection<T extends { id: string }>(name: string) {
  return readJson<T[]>(`${name}.json`, []);
}

export async function getRecord<T extends { id: string }>(name: string, id: string) {
  const records = await listCollection<T>(name);
  return records.find((record) => record.id === id);
}

export async function upsertRecord<T extends { id: string }>(name: string, record: T) {
  const records = await listCollection<T>(name);
  const index = records.findIndex((item) => item.id === record.id);
  if (index >= 0) records[index] = record;
  else records.unshift(record);
  await writeJson(`${name}.json`, records);
  return record;
}

export async function updateRecord<T extends { id: string }>(
  name: string,
  id: string,
  updater: (record: T) => T,
) {
  const records = await listCollection<T>(name);
  const index = records.findIndex((item) => item.id === id);
  if (index < 0) {
    throw new ApiError(404, "not_found", `${name} record not found: ${id}`);
  }
  records[index] = updater(records[index]);
  await writeJson(`${name}.json`, records);
  return records[index];
}

export function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

export async function requestJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return jsonResponse(
      {
        error: error.code,
        message: error.message,
        details: error.details,
      },
      error.status,
    );
  }

  return jsonResponse(
    {
      error: "internal_error",
      message: error instanceof Error ? error.message : String(error),
    },
    500,
  );
}
