export type CorpusSourceType = "seed" | "official" | "crawled" | "uploaded" | "manual";

export type CorpusChunkType =
  | "standard"
  | "achievement_level"
  | "remediation"
  | "assessment"
  | "metadata";

export type CorpusStandardDocument = {
  id: string;
  sourceType: CorpusSourceType;
  provider: string;
  sourceName: string;
  sourceUrl?: string;
  license?: string;
  collectedAt: string;
  curriculumYear?: string;
  schoolLevel?: string;
  gradeBand: string;
  grade?: string;
  subject: string;
  domain?: string;
  standardCode?: string;
  title: string;
  text: string;
  chunkType: CorpusChunkType;
  keywords: string[];
  metadata: Record<string, unknown>;

  // Legacy compatibility for the existing RAG shape.
  source: string;
  url?: string;
  tags: string[];
};
