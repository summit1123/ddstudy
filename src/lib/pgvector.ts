import { Pool, type QueryResultRow } from "pg";
import { ApiError, embedTexts } from "./ai";
import {
  type Resource,
  type StandardDocument,
  StandardDocumentSchema,
} from "./schemas";

const DEFAULT_LOCAL_DATABASE_URL = "postgresql://daeum:daeum@127.0.0.1:5433/daeum_hangeoreum";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSION = 1536;
const TABLE_NAME = "standards_vector_chunks";

let pool: Pool | null = null;

type ChunkInput = Omit<StandardDocument, "text"> & {
  chunkId: string;
  text: string;
};

type ChunkRow = QueryResultRow & {
  chunk_id: string;
  document_id: string;
  source_type: "seed" | "official" | "crawled" | "uploaded" | "manual";
  provider: string;
  license: string | null;
  curriculum_year: string | null;
  school_level: string | null;
  grade: string | null;
  title: string;
  subject: string;
  grade_band: string;
  domain: string | null;
  standard_code: string | null;
  chunk_type: "standard" | "achievement_level" | "remediation" | "assessment" | "metadata";
  source_name: string;
  source_url: string | null;
  tags: string[] | null;
  keywords: string[] | null;
  text: string;
  score?: string | number | null;
};

export function isPgvectorBackend() {
  const backend = process.env.RAG_VECTOR_BACKEND?.trim().toLowerCase();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  return backend === "pgvector" || Boolean(databaseUrl?.match(/^postgres(?:ql)?:\/\//));
}

function databaseUrl() {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) return configured;

  if (process.env.RAG_VECTOR_BACKEND?.trim().toLowerCase() === "pgvector") {
    return DEFAULT_LOCAL_DATABASE_URL;
  }

  throw new ApiError(
    500,
    "database_url_missing",
    "DATABASE_URL is required when RAG_VECTOR_BACKEND=pgvector.",
  );
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: 5,
    });
  }

  return pool;
}

function chunkDocument(document: StandardDocument, maxLength = 900) {
  const chunks: ChunkInput[] = [];
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

function vectorLiteral(embedding: number[]) {
  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new ApiError(
      500,
      "embedding_dimension_mismatch",
      `pgvector table expects ${EMBEDDING_DIMENSION} dimensions, but OpenAI returned ${embedding.length}.`,
    );
  }

  return `[${embedding.map((value) => {
    if (!Number.isFinite(value)) {
      throw new ApiError(500, "embedding_invalid_value", "Embedding contains a non-finite number.");
    }
    return String(value);
  }).join(",")}]`;
}

function embeddingBatchSize() {
  const configured = Number(process.env.EMBEDDING_BATCH_SIZE ?? 256);
  if (!Number.isFinite(configured) || configured < 1) return 256;
  return Math.min(Math.floor(configured), 2048);
}

async function embedTextsInBatches(texts: string[]) {
  const embeddings: number[][] = [];
  const batchSize = embeddingBatchSize();

  for (let index = 0; index < texts.length; index += batchSize) {
    const batch = texts.slice(index, index + batchSize);
    embeddings.push(...await embedTexts(batch));
  }

  return embeddings;
}

function toResource(row: ChunkRow): Resource & { score?: number } {
  const score = row.score == null ? undefined : Number(row.score);

  return {
    id: row.chunk_id,
    title: row.title,
    type: "standard",
    subject: row.subject,
    gradeBand: row.grade_band,
    tags: row.keywords ?? row.tags ?? [],
    url: row.source_url ?? undefined,
    summary: row.text,
    standardCode: row.standard_code ?? undefined,
    sourceType: row.source_type,
    sourceName: row.source_name,
    sourceUrl: row.source_url ?? undefined,
    license: row.license ?? undefined,
    chunkType: row.chunk_type,
    citations: [
      {
        standardId: row.document_id,
        title: row.title,
        source: row.source_name,
        locator: row.chunk_id,
        quote: row.text.slice(0, 240),
      },
    ],
    score: score == null || Number.isNaN(score) ? undefined : Number(score.toFixed(4)),
  };
}

export async function setupPgvector() {
  const client = await getPool().connect();

  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        chunk_id text PRIMARY KEY,
        document_id text NOT NULL,
        source_type text NOT NULL DEFAULT 'seed',
        provider text NOT NULL DEFAULT '다음한걸음',
        title text NOT NULL,
        subject text NOT NULL,
        grade_band text NOT NULL,
        grade text,
        school_level text,
        curriculum_year text,
        domain text,
        standard_code text,
        chunk_type text NOT NULL DEFAULT 'standard',
        source_name text NOT NULL,
        source_url text,
        license text,
        tags text[] NOT NULL DEFAULT '{}',
        keywords jsonb NOT NULL DEFAULT '[]',
        text text NOT NULL,
        embedding vector(${EMBEDDING_DIMENSION}) NOT NULL,
        embedding_model text NOT NULL,
        metadata jsonb NOT NULL DEFAULT '{}',
        collected_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'seed'`);
    await client.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT '다음한걸음'`);
    await client.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN IF NOT EXISTS grade text`);
    await client.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN IF NOT EXISTS school_level text`);
    await client.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN IF NOT EXISTS curriculum_year text`);
    await client.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN IF NOT EXISTS domain text`);
    await client.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN IF NOT EXISTS standard_code text`);
    await client.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN IF NOT EXISTS chunk_type text NOT NULL DEFAULT 'standard'`);
    await client.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN IF NOT EXISTS license text`);
    await client.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN IF NOT EXISTS keywords jsonb NOT NULL DEFAULT '[]'`);
    await client.query(`
      CREATE INDEX IF NOT EXISTS ${TABLE_NAME}_subject_grade_idx
      ON ${TABLE_NAME} (subject, grade_band)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS ${TABLE_NAME}_tags_idx
      ON ${TABLE_NAME} USING gin (tags)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS ${TABLE_NAME}_source_type_idx
      ON ${TABLE_NAME} (source_type)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS ${TABLE_NAME}_standard_code_idx
      ON ${TABLE_NAME} (standard_code)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS ${TABLE_NAME}_embedding_idx
      ON ${TABLE_NAME} USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    `);
  } finally {
    client.release();
  }
}

export async function ingestStandardsPgvector(
  documents: StandardDocument[],
  reset = false,
) {
  const parsed = StandardDocumentSchema.array().parse(documents);
  await setupPgvector();

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    if (reset) {
      await client.query(`TRUNCATE TABLE ${TABLE_NAME}`);
    }

    const chunkInputs = parsed.flatMap((document) => chunkDocument(document));
    const existing = reset || chunkInputs.length === 0
      ? new Set<string>()
      : new Set(
          (await client.query<{ chunk_id: string }>(
            `SELECT chunk_id FROM ${TABLE_NAME} WHERE chunk_id = ANY($1::text[])`,
            [chunkInputs.map((chunk) => chunk.chunkId)],
          )).rows.map((row) => row.chunk_id),
        );
    const chunksNeedingEmbeddings = chunkInputs.filter((chunk) => !existing.has(chunk.chunkId));
    const chunksNeedingMetadataUpdate = chunkInputs.filter((chunk) => existing.has(chunk.chunkId));
    const embeddings = await embedTextsInBatches(chunksNeedingEmbeddings.map((chunk) => chunk.text));
    const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;

    for (const [index, chunk] of chunksNeedingEmbeddings.entries()) {
      await client.query(
        `
          INSERT INTO ${TABLE_NAME} (
            chunk_id,
            document_id,
            source_type,
            provider,
            title,
            subject,
            grade_band,
            grade,
            school_level,
            curriculum_year,
            domain,
            standard_code,
            chunk_type,
            source_name,
            source_url,
            license,
            tags,
            keywords,
            text,
            embedding,
            embedding_model,
            metadata,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::text[], $18::jsonb, $19, $20::vector, $21, $22::jsonb, now())
          ON CONFLICT (chunk_id) DO UPDATE SET
            document_id = EXCLUDED.document_id,
            source_type = EXCLUDED.source_type,
            provider = EXCLUDED.provider,
            title = EXCLUDED.title,
            subject = EXCLUDED.subject,
            grade_band = EXCLUDED.grade_band,
            grade = EXCLUDED.grade,
            school_level = EXCLUDED.school_level,
            curriculum_year = EXCLUDED.curriculum_year,
            domain = EXCLUDED.domain,
            standard_code = EXCLUDED.standard_code,
            chunk_type = EXCLUDED.chunk_type,
            source_name = EXCLUDED.source_name,
            source_url = EXCLUDED.source_url,
            license = EXCLUDED.license,
            tags = EXCLUDED.tags,
            keywords = EXCLUDED.keywords,
            text = EXCLUDED.text,
            embedding = EXCLUDED.embedding,
            embedding_model = EXCLUDED.embedding_model,
            metadata = EXCLUDED.metadata,
            updated_at = now()
        `,
        [
          chunk.chunkId,
          chunk.id,
          chunk.sourceType,
          chunk.provider,
          chunk.title,
          chunk.subject,
          chunk.gradeBand,
          chunk.grade ?? null,
          chunk.schoolLevel ?? null,
          chunk.curriculumYear ?? null,
          chunk.domain ?? null,
          chunk.standardCode ?? null,
          chunk.chunkType,
          chunk.sourceName ?? chunk.source,
          chunk.sourceUrl ?? chunk.url ?? null,
          chunk.license ?? null,
          chunk.tags,
          JSON.stringify(chunk.keywords ?? chunk.tags),
          chunk.text,
          vectorLiteral(embeddings[index]),
          embeddingModel,
          JSON.stringify({
            ...(chunk.metadata ?? {}),
            provider: chunk.provider,
            sourceType: chunk.sourceType,
            collectedAt: chunk.collectedAt,
            ingestionUpdatedAt: new Date().toISOString(),
          }),
        ],
      );
    }

    for (const chunk of chunksNeedingMetadataUpdate) {
      await client.query(
        `
          UPDATE ${TABLE_NAME}
          SET
            document_id = $2,
            source_type = $3,
            provider = $4,
            title = $5,
            subject = $6,
            grade_band = $7,
            grade = $8,
            school_level = $9,
            curriculum_year = $10,
            domain = $11,
            standard_code = $12,
            chunk_type = $13,
            source_name = $14,
            source_url = $15,
            license = $16,
            tags = $17::text[],
            keywords = $18::jsonb,
            text = $19,
            metadata = $20::jsonb,
            updated_at = now()
          WHERE chunk_id = $1
        `,
        [
          chunk.chunkId,
          chunk.id,
          chunk.sourceType,
          chunk.provider,
          chunk.title,
          chunk.subject,
          chunk.gradeBand,
          chunk.grade ?? null,
          chunk.schoolLevel ?? null,
          chunk.curriculumYear ?? null,
          chunk.domain ?? null,
          chunk.standardCode ?? null,
          chunk.chunkType,
          chunk.sourceName ?? chunk.source,
          chunk.sourceUrl ?? chunk.url ?? null,
          chunk.license ?? null,
          chunk.tags,
          JSON.stringify(chunk.keywords ?? chunk.tags),
          chunk.text,
          JSON.stringify({
            ...(chunk.metadata ?? {}),
            provider: chunk.provider,
            sourceType: chunk.sourceType,
            collectedAt: chunk.collectedAt,
            ingestionUpdatedAt: new Date().toISOString(),
          }),
        ],
      );
    }

    await client.query(`ANALYZE ${TABLE_NAME}`);
    await client.query("COMMIT");

    const count = Number(
      (await client.query<{ count: string }>(`SELECT count(*) FROM ${TABLE_NAME}`)).rows[0]?.count ?? 0,
    );

    return {
      backend: "pgvector" as const,
      table: TABLE_NAME,
      chunks: count,
      embeddedChunks: chunksNeedingEmbeddings.length,
      resources: count,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function searchStandardsPgvector({
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
  await setupPgvector();

  const [queryEmbedding] = await embedTexts([q]);
  const params: unknown[] = [vectorLiteral(queryEmbedding)];
  const clauses = ["1 = 1"];

  if (subject) {
    params.push(subject);
    clauses.push(`subject = $${params.length}`);
  }

  if (tags?.length) {
    params.push(tags);
    clauses.push(`tags && $${params.length}::text[]`);
  }

  if (sourceType) {
    params.push(sourceType);
    clauses.push(`source_type = $${params.length}`);
  }

  params.push(Math.max(limit * 8, 24));
  const rows = (await getPool().query<ChunkRow>(
    `
      SELECT
        chunk_id,
        document_id,
        source_type,
        provider,
        title,
        subject,
        grade_band,
        grade,
        school_level,
        curriculum_year,
        domain,
        standard_code,
        chunk_type,
        source_name,
        source_url,
        license,
        tags,
        keywords,
        text,
        1 - (embedding <=> $1::vector) AS score
      FROM ${TABLE_NAME}
      WHERE ${clauses.join(" AND ")}
      ORDER BY
        CASE source_type
          WHEN 'official' THEN 0
          WHEN 'crawled' THEN 1
          WHEN 'uploaded' THEN 2
          WHEN 'manual' THEN 3
          ELSE 4
        END,
        embedding <=> $1::vector
      LIMIT $${params.length}
    `,
    params,
  )).rows;

  const matches = rows
    .filter((row) => gradeMatches(row.grade_band, gradeBand))
    .slice(0, limit)
    .map((row) => toResource(row));

  return matches;
}

export async function pgvectorStatus() {
  if (!isPgvectorBackend()) {
    return {
      backend: "local-json" as const,
      configured: false,
      message: "RAG_VECTOR_BACKEND is not pgvector and DATABASE_URL is not a postgres URL.",
    };
  }

  await setupPgvector();

  const [extension, chunks, bySourceType] = await Promise.all([
    getPool().query<{ extversion: string }>("SELECT extversion FROM pg_extension WHERE extname = 'vector'"),
    getPool().query<{ count: string }>(`SELECT count(*) FROM ${TABLE_NAME}`),
    getPool().query<{ source_type: string; count: string }>(`
      SELECT source_type, count(*)
      FROM ${TABLE_NAME}
      GROUP BY source_type
      ORDER BY source_type
    `),
  ]);

  return {
    backend: "pgvector" as const,
    configured: true,
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL?.trim()),
    usingDefaultLocalDatabaseUrl: !process.env.DATABASE_URL?.trim(),
    table: TABLE_NAME,
    embeddingDimension: EMBEDDING_DIMENSION,
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL,
    extensionVersion: extension.rows[0]?.extversion ?? null,
    chunks: Number(chunks.rows[0]?.count ?? 0),
    bySourceType: Object.fromEntries(bySourceType.rows.map((row) => [row.source_type, Number(row.count)])),
  };
}
