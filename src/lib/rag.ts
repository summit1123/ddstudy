import {
  type Resource,
  type StandardChunk,
  type StandardDocument,
  ResourceSchema,
  StandardChunkSchema,
  StandardDocumentSchema,
} from "./schemas";
import { ApiError, dataPath, embedTexts, readJsonAtPath, writeJsonAtPath } from "./ai";
import { ingestStandardsPgvector, isPgvectorBackend, searchStandardsPgvector } from "./pgvector";
import { normalizeStandardDocument } from "./corpus/normalize";

type VectorStore = {
  version: 1;
  embeddingModel: string;
  chunks: StandardChunk[];
  resources: Resource[];
  updatedAt: string;
};

export const defaultStandards: StandardDocument[] = [
  normalizeStandardDocument({
    id: "math-rectangle-perimeter-g4-4su02-05",
    sourceType: "seed",
    provider: "다음한걸음",
    sourceName: "NCIC 국가교육과정정보센터 참고 자료 + 개발용 예시 시나리오",
    sourceUrl: "https://ncic.re.kr/",
    license: "개발용 예시 기준. 공식 원문 corpus가 아니며, NCIC 저작권 정책 확인 필요.",
    collectedAt: "2026-05-29T00:00:00.000Z",
    curriculumYear: "2022 개정 참고",
    schoolLevel: "초등학교",
    standardCode: "[4수02-05]",
    chunkType: "standard",
    title: "초등 수학 직사각형의 성질과 둘레 성취기준",
    subject: "수학",
    gradeBand: "초4",
    domain: "도형",
    keywords: ["rectangle", "perimeter", "geometry", "4수02-05"],
    text:
      "성취기준 [4수02-05] 직사각형의 성질을 이해하고, 이를 바탕으로 둘레를 구할 수 있다. 학생은 직사각형에서 마주 보는 변의 길이가 같다는 성질을 확인하고, 문제에서 가로와 세로의 길이를 찾아 둘레를 구하는 식을 세운다. 느린학습자 지원 실행카드는 가로와 세로를 색이나 화살표로 표시하기, 둘레가 도형의 가장자리 전체 길이라는 쉬운 설명, (가로 + 세로) x 2 식 만들기, 계산 결과와 단위 확인으로 단계를 나누어야 한다.",
  }),
  normalizeStandardDocument({
    id: "math-problem-solving-g3-5",
    sourceType: "seed",
    provider: "다음한걸음",
    sourceName: "다음한걸음 개발용 예시 기준",
    license: "개발용 예시 기준. 공식 원문 corpus 아님.",
    collectedAt: "2026-05-29T00:00:00.000Z",
    schoolLevel: "초등학교",
    chunkType: "standard",
    title: "수학 문제 해결 과정 성취기준",
    subject: "수학",
    gradeBand: "3-5",
    domain: "문제 해결",
    keywords: ["problem-solving", "reasoning", "reflection"],
    text:
      "학생은 문제 상황을 이해하고 필요한 정보를 찾아 풀이 전략을 세운다. 계산이나 추론 과정을 단계적으로 표현하고, 답이 문제의 조건에 맞는지 검토한다. 수업 실행 카드에는 학생이 자신의 풀이 근거를 말하거나 쓰는 활동, 교사가 오개념을 확인하는 질문, 다음 단계로 넘어가기 전 확인 기준이 포함되어야 한다.",
  }),
  normalizeStandardDocument({
    id: "korean-reading-g3-5",
    sourceType: "seed",
    provider: "다음한걸음",
    sourceName: "다음한걸음 개발용 예시 기준",
    license: "개발용 예시 기준. 공식 원문 corpus 아님.",
    collectedAt: "2026-05-29T00:00:00.000Z",
    schoolLevel: "초등학교",
    chunkType: "standard",
    title: "국어 읽기 이해와 근거 찾기 성취기준",
    subject: "국어",
    gradeBand: "3-5",
    domain: "읽기",
    keywords: ["reading", "evidence", "discussion"],
    text:
      "학생은 글의 중심 생각과 세부 정보를 파악하고, 자신의 해석을 뒷받침하는 문장이나 표현을 찾는다. 친구와 의견을 비교하며 근거의 타당성을 점검한다. 교사는 질문을 통해 학생이 텍스트 근거로 돌아가도록 돕고, 실행 카드에는 읽기 전 예측, 읽는 중 표시, 읽은 뒤 설명 활동이 포함되어야 한다.",
  }),
  normalizeStandardDocument({
    id: "science-inquiry-g3-5",
    sourceType: "seed",
    provider: "다음한걸음",
    sourceName: "다음한걸음 개발용 예시 기준",
    license: "개발용 예시 기준. 공식 원문 corpus 아님.",
    collectedAt: "2026-05-29T00:00:00.000Z",
    schoolLevel: "초등학교",
    chunkType: "standard",
    title: "과학 탐구 설계와 증거 기반 설명 성취기준",
    subject: "과학",
    gradeBand: "3-5",
    domain: "탐구",
    keywords: ["inquiry", "evidence", "experiment"],
    text:
      "학생은 관찰 가능한 질문을 만들고 변인을 고려하여 간단한 탐구를 설계한다. 관찰 결과를 표나 그림으로 정리하고 증거에 근거해 설명한다. 실행 카드에는 안전 유의점, 자료 기록 방식, 예상과 결과를 비교하는 질문, 탐구 후 다음 한걸음 활동이 포함되어야 한다.",
  }),
];

function chunkDocument(document: StandardDocument, maxLength = 900) {
  const chunks: Omit<StandardChunk, "embedding">[] = [];
  const sentences = document.text.split(/(?<=[.!?。！？다])\s+/).filter(Boolean);
  let buffer = "";
  let index = 0;

  for (const sentence of sentences) {
    if (buffer && `${buffer} ${sentence}`.length > maxLength) {
      chunks.push({
        ...document,
        chunkId: `${document.id}#${index}`,
        text: buffer,
      });
      index += 1;
      buffer = sentence;
    } else {
      buffer = buffer ? `${buffer} ${sentence}` : sentence;
    }
  }

  if (buffer) {
    chunks.push({
      ...document,
      chunkId: `${document.id}#${index}`,
      text: buffer,
    });
  }

  return chunks;
}

function dot(a: number[], b: number[]) {
  return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

function norm(a: number[]) {
  return Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
}

function cosine(a: number[], b: number[]) {
  const denominator = norm(a) * norm(b);
  if (!denominator) return 0;
  return dot(a, b) / denominator;
}

function toResource(chunk: StandardChunk, score?: number): Resource & { score?: number } {
  return {
    id: chunk.chunkId,
    title: chunk.title,
    type: "standard",
    subject: chunk.subject,
    gradeBand: chunk.gradeBand,
    tags: chunk.tags,
    url: chunk.url,
    summary: chunk.text,
    standardCode: chunk.standardCode,
    sourceType: chunk.sourceType,
    sourceName: chunk.sourceName ?? chunk.source,
    sourceUrl: chunk.sourceUrl ?? chunk.url,
    license: chunk.license,
    chunkType: chunk.chunkType,
    citations: [
      {
        standardId: chunk.id,
        title: chunk.title,
        source: chunk.source,
        locator: chunk.chunkId,
        quote: chunk.text.slice(0, 240),
      },
    ],
    score,
  };
}

function gradeMatches(chunkGradeBand: string, requestedGradeBand?: string) {
  if (!requestedGradeBand) return true;
  if (chunkGradeBand === requestedGradeBand) return true;

  const requestedNumber = Number(requestedGradeBand.match(/\d+/)?.[0]);
  if (!Number.isFinite(requestedNumber)) return false;
  const chunkNumber = Number(chunkGradeBand.match(/\d+/)?.[0]);
  if (Number.isFinite(chunkNumber) && chunkNumber === requestedNumber) return true;

  const range = chunkGradeBand.match(/(\d+)\s*-\s*(\d+)/);
  if (!range) return false;
  const start = Number(range[1]);
  const end = Number(range[2]);
  return requestedNumber >= start && requestedNumber <= end;
}

function schoolLevelMatches(schoolLevel?: string, requestedGradeBand?: string) {
  if (!requestedGradeBand) return true;
  if (requestedGradeBand.includes("초")) return Boolean(schoolLevel?.includes("초"));
  if (requestedGradeBand.includes("중")) return Boolean(schoolLevel?.includes("중"));
  if (requestedGradeBand.includes("고")) return Boolean(schoolLevel?.includes("고"));
  return true;
}

export function standardsStorePath() {
  return process.env.STANDARDS_VECTOR_STORE_PATH ?? dataPath("standards-vector-store.json");
}

export async function loadVectorStore() {
  const store = await readJsonAtPath<VectorStore | null>(standardsStorePath(), null);
  if (!store) return null;

  const chunks = StandardChunkSchema.array().safeParse(store.chunks);
  const resources = ResourceSchema.array().safeParse(store.resources);
  if (!chunks.success || !resources.success) {
    throw new ApiError(500, "vector_store_invalid", "Standards vector store failed schema validation.", {
      chunks: chunks.success ? undefined : chunks.error.issues,
      resources: resources.success ? undefined : resources.error.issues,
    });
  }

  return store;
}

export async function ingestStandards(documents: StandardDocument[] = defaultStandards, reset = false) {
  if (isPgvectorBackend()) {
    return ingestStandardsPgvector(documents, reset);
  }

  const parsed = StandardDocumentSchema.array().parse(documents);
  const existing = reset ? null : await loadVectorStore();
  const existingByChunkId = new Map(existing?.chunks.map((chunk) => [chunk.chunkId, chunk]) ?? []);

  const chunkInputs = parsed.flatMap((document) => chunkDocument(document));
  const chunksNeedingEmbeddings = chunkInputs.filter((chunk) => !existingByChunkId.has(chunk.chunkId));
  const embeddings = await embedTexts(chunksNeedingEmbeddings.map((chunk) => chunk.text));

  const newChunks = chunksNeedingEmbeddings.map((chunk, index) => ({
    ...chunk,
    embedding: embeddings[index],
  }));

  const incomingIds = new Set(chunkInputs.map((chunk) => chunk.chunkId));
  const retainedChunks = (existing?.chunks ?? []).filter((chunk) => !incomingIds.has(chunk.chunkId));
  const chunks = [...newChunks, ...chunkInputs
    .filter((chunk) => existingByChunkId.has(chunk.chunkId))
    .map((chunk) => existingByChunkId.get(chunk.chunkId) as StandardChunk), ...retainedChunks];

  const store: VectorStore = {
    version: 1,
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    chunks,
    resources: chunks.map((chunk) => toResource(chunk)),
    updatedAt: new Date().toISOString(),
  };

  await writeJsonAtPath(standardsStorePath(), store);
  return {
    path: standardsStorePath(),
    chunks: store.chunks.length,
    resources: store.resources.length,
    updatedAt: store.updatedAt,
  };
}

async function ensureVectorStore() {
  const store = await loadVectorStore();
  if (store?.chunks.length) return store;

  throw new ApiError(
    500,
    "vector_store_empty",
    "Standards vector store is empty. Run the standards ingestion command instead of using seed fallback.",
  );
}

export async function searchStandards({
  q,
  subject,
  gradeBand,
  tags,
  sourceType,
  limit = 5,
}: {
  q: string;
  subject?: string;
  gradeBand?: string;
  tags?: string[];
  sourceType?: "seed" | "official" | "crawled" | "uploaded" | "manual";
  limit?: number;
}) {
  if (isPgvectorBackend()) {
    return searchStandardsPgvector({ q, subject, gradeBand, tags, sourceType, limit });
  }

  const store = await ensureVectorStore();
  const [queryEmbedding] = await embedTexts([q]);
  const tagSet = new Set(tags ?? []);

  const candidateChunks = store.chunks
    .filter((chunk) => !subject || chunk.subject === subject)
    .filter((chunk) => tagSet.size === 0 || chunk.tags.some((tag) => tagSet.has(tag)))
    .filter((chunk) => !sourceType || chunk.sourceType === sourceType);
  const gradeMatchedChunks = candidateChunks
    .filter((chunk) => schoolLevelMatches(chunk.schoolLevel, gradeBand))
    .filter((chunk) => gradeMatches(chunk.gradeBand, gradeBand));
  const chunksForSearch = gradeMatchedChunks.length ? gradeMatchedChunks : candidateChunks;

  const matches = chunksForSearch
    .map((chunk) => ({ chunk, score: cosine(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return matches.map(({ chunk, score }) => toResource(chunk, Number(score.toFixed(4))));
}

export async function searchResources(input: {
  q: string;
  subject?: string;
  gradeBand?: string;
  tags?: string[];
  limit?: number;
}) {
  return searchStandards(input);
}

export function formatResourcesForPrompt(resources: Array<Resource & { score?: number }>) {
  return resources
    .map((resource, index) => {
      const citation = resource.citations[0];
      return [
        `[${index + 1}] ${resource.title}`,
        `standardId: ${citation?.standardId ?? resource.id}`,
        `standardCode: ${resource.standardCode ?? "unknown"}`,
        `sourceType: ${resource.sourceType ?? "unknown"}`,
        `source: ${citation?.source ?? "unknown"}`,
        `sourceUrl: ${resource.sourceUrl ?? resource.url ?? "unknown"}`,
        `license: ${resource.license ?? "unknown"}`,
        `locator: ${citation?.locator ?? resource.id}`,
        `summary: ${resource.summary}`,
      ].join("\n");
    })
    .join("\n\n");
}
