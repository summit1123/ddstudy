import type { CorpusChunkType, CorpusSourceType, CorpusStandardDocument } from "./types";

const CODE_PATTERN = /\[[^\]]+\]/;

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80);
}

export function inferStandardCode(text: string) {
  return text.match(CODE_PATTERN)?.[0];
}

export function normalizeKeywords(input: Array<string | undefined | null>) {
  return Array.from(
    new Set(
      input
        .flatMap((value) => (value ?? "").split(/[\s,>\/|]+/))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeStandardDocument(input: {
  id?: string;
  sourceType: CorpusSourceType;
  provider: string;
  sourceName: string;
  sourceUrl?: string | null;
  license?: string | null;
  collectedAt?: string | null;
  curriculumYear?: string | null;
  schoolLevel?: string | null;
  gradeBand?: string | null;
  grade?: string | null;
  subject?: string | null;
  domain?: string | null;
  standardCode?: string | null;
  title?: string | null;
  text: string;
  chunkType?: CorpusChunkType;
  keywords?: string[];
  metadata?: Record<string, unknown>;
}) : CorpusStandardDocument {
  const standardCode = optionalText(input.standardCode) ?? inferStandardCode(input.text);
  const subject = optionalText(input.subject) ?? "미분류";
  const grade = optionalText(input.grade);
  const gradeBand = optionalText(input.gradeBand) ?? grade ?? "미분류";
  const domain = optionalText(input.domain);
  const schoolLevel = optionalText(input.schoolLevel);
  const curriculumYear = optionalText(input.curriculumYear);
  const title = optionalText(input.title) ?? [standardCode, subject, domain].filter(Boolean).join(" ");
  const keywords = normalizeKeywords([
    ...(input.keywords ?? []),
    standardCode,
    subject,
    gradeBand,
    domain,
    schoolLevel,
    curriculumYear,
  ]);
  const id = input.id ?? [
    input.sourceType,
    input.provider,
    standardCode ?? title,
    slug(input.text).slice(0, 24),
  ].filter(Boolean).join(":");

  return {
    id,
    sourceType: input.sourceType,
    provider: input.provider,
    sourceName: input.sourceName,
    sourceUrl: optionalText(input.sourceUrl),
    license: optionalText(input.license),
    collectedAt: optionalText(input.collectedAt) ?? new Date().toISOString(),
    curriculumYear,
    schoolLevel,
    gradeBand,
    grade,
    subject,
    domain,
    standardCode,
    title,
    text: input.text,
    chunkType: input.chunkType ?? "standard",
    keywords,
    metadata: input.metadata ?? {},
    source: input.sourceName,
    url: optionalText(input.sourceUrl),
    tags: keywords,
  };
}
