#!/usr/bin/env tsx

import { writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { loadLocalEnv } from "./load-local-env";

loadLocalEnv();

const TABLE_NAME = "standards_vector_chunks";

function databaseUrl() {
  const url = process.env.DATABASE_URL ?? "postgresql://daeum:daeum@127.0.0.1:5433/daeum_hangeoreum";
  if (!url.match(/^postgres(?:ql)?:\/\//)) {
    throw new Error("DATABASE_URL must be a PostgreSQL URL for corpus audit.");
  }
  return url;
}

function mdEscape(value: unknown) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ")
    .trim();
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl(), max: 2 });

  try {
    const [extension, rows, columns, bySourceType, bySubject, byGradeBand, provenanceStats, dims] = await Promise.all([
      pool.query<{ extversion: string }>("SELECT extversion FROM pg_extension WHERE extname = 'vector'"),
      pool.query<{
        chunk_id: string;
        title: string;
        subject: string;
        grade_band: string;
        standard_code: string | null;
        source_type: string;
        provider: string;
        source_name: string;
        source_url: string | null;
        license: string | null;
        collected_at: string;
        chunk_type: string;
        preview: string;
      }>(`
        SELECT
          chunk_id,
          title,
          subject,
          grade_band,
          standard_code,
          source_type,
          provider,
          source_name,
          source_url,
          license,
          collected_at::text,
          chunk_type,
          left(text, 220) AS preview
        FROM ${TABLE_NAME}
        ORDER BY
          CASE source_type
            WHEN 'official' THEN 0
            WHEN 'crawled' THEN 1
            WHEN 'uploaded' THEN 2
            WHEN 'manual' THEN 3
            ELSE 4
          END,
          chunk_id
        LIMIT 80
      `),
      pool.query<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [TABLE_NAME]),
      pool.query<{ source_type: string; count: string }>(`
        SELECT source_type, count(*)
        FROM ${TABLE_NAME}
        GROUP BY source_type
        ORDER BY source_type
      `),
      pool.query<{ subject: string; count: string }>(`
        SELECT subject, count(*)
        FROM ${TABLE_NAME}
        GROUP BY subject
        ORDER BY count(*) DESC, subject
        LIMIT 40
      `),
      pool.query<{ grade_band: string; count: string }>(`
        SELECT grade_band, count(*)
        FROM ${TABLE_NAME}
        GROUP BY grade_band
        ORDER BY count(*) DESC, grade_band
        LIMIT 40
      `),
      pool.query<{
        source_type: string;
        count: string;
        source_url_nulls: string;
        license_nulls: string;
        providers: string;
      }>(`
        SELECT
          source_type,
          count(*)::text AS count,
          count(*) FILTER (WHERE source_url IS NULL OR source_url = '')::text AS source_url_nulls,
          count(*) FILTER (WHERE license IS NULL OR license = '')::text AS license_nulls,
          string_agg(DISTINCT provider, ', ' ORDER BY provider) AS providers
        FROM ${TABLE_NAME}
        GROUP BY source_type
        ORDER BY source_type
      `),
      pool.query<{ dims: number; count: string }>(`
        SELECT vector_dims(embedding) AS dims, count(*)
        FROM ${TABLE_NAME}
        GROUP BY vector_dims(embedding)
        ORDER BY dims
      `),
    ]);

    const sourceCounts = Object.fromEntries(bySourceType.rows.map((row) => [row.source_type, Number(row.count)]));
    const subjectCounts = Object.fromEntries(bySubject.rows.map((row) => [row.subject, Number(row.count)]));
    const gradeBandCounts = Object.fromEntries(byGradeBand.rows.map((row) => [row.grade_band, Number(row.count)]));
    const totalRows = Object.values(sourceCounts).reduce((sum, count) => sum + count, 0);
    const officialRows = (sourceCounts.official ?? 0) + (sourceCounts.crawled ?? 0) + (sourceCounts.uploaded ?? 0);
    const hasRequiredColumns = [
      "source_type",
      "provider",
      "source_name",
      "source_url",
      "license",
      "standard_code",
      "chunk_type",
      "keywords",
    ].every((column) => columns.rows.some((row) => row.column_name === column));
    const canClaimOfficialCorpus = officialRows > 0 && (sourceCounts.seed ?? 0) < totalRows;
    const generatedAt = new Date().toISOString();

    const markdown = `# Corpus Audit - 다음한걸음

Generated at: ${generatedAt}

## pgvector State

- Extension version: ${extension.rows[0]?.extversion ?? "not installed"}
- Table: \`${TABLE_NAME}\`
- Row count: ${totalRows}
- Vector dimensions: ${dims.rows.map((row) => `${row.dims} (${row.count} rows)`).join(", ") || "none"}
- Source type counts: ${JSON.stringify(sourceCounts)}
- Subject counts (top 40): ${JSON.stringify(subjectCounts)}
- Grade/grade-band counts (top 40): ${JSON.stringify(gradeBandCounts)}
- Required provenance columns present: ${hasRequiredColumns ? "yes" : "no"}

## Provenance Completeness

| sourceType | rows | providers | sourceUrl nulls | license nulls | sourceUrl null ratio | license null ratio |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
${provenanceStats.rows.map((row) => {
  const count = Number(row.count);
  const sourceUrlNulls = Number(row.source_url_nulls);
  const licenseNulls = Number(row.license_nulls);
  const sourceUrlRatio = count ? `${((sourceUrlNulls / count) * 100).toFixed(2)}%` : "0.00%";
  const licenseRatio = count ? `${((licenseNulls / count) * 100).toFixed(2)}%` : "0.00%";
  return `| ${mdEscape(row.source_type)} | ${count} | ${mdEscape(row.providers)} | ${sourceUrlNulls} | ${licenseNulls} | ${sourceUrlRatio} | ${licenseRatio} |`;
}).join("\n")}

## Row Preview

| chunk_id | sourceType | provider | standardCode | subject | gradeBand | sourceName | sourceUrl | license | collectedAt | preview |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.rows.map((row) => `| \`${mdEscape(row.chunk_id)}\` | ${mdEscape(row.source_type)} | ${mdEscape(row.provider)} | ${mdEscape(row.standard_code)} | ${mdEscape(row.subject)} | ${mdEscape(row.grade_band)} | ${mdEscape(row.source_name)} | ${mdEscape(row.source_url)} | ${mdEscape(row.license)} | ${mdEscape(row.collected_at)} | ${mdEscape(row.preview)} |`).join("\n")}

## Judgment

- Current corpus contains seed rows: ${(sourceCounts.seed ?? 0) > 0 ? "yes" : "no"} (${sourceCounts.seed ?? 0})
- Current corpus contains official/crawled/uploaded rows: ${officialRows > 0 ? "yes" : "no"} (${officialRows})
- Can we claim this is a complete official public-data RAG corpus? no
- Can we claim the RAG can distinguish official/crawled/uploaded/manual/seed provenance? ${hasRequiredColumns ? "yes" : "no"}
- Can we claim at least some public official metadata is embedded? ${canClaimOfficialCorpus ? "yes" : "no"}

## 부족한 점

- NCIC/KICE 전체 원문 corpus는 아직 수집 완료가 아니다.
- STAS 공개 REST는 성취기준 metadata/문장 중심이며, 상세 평가기준/자료 파일 일부는 교사 회원 권한이 필요할 수 있다.
- 라이선스는 source별로 명확히 보존하지만, STAS 상세 재이용 조건은 추가 확인이 필요하다.
- 국가기초학력지원포털/꾸꾸 보정자료는 현 환경에서 안정 자동 수집이 확인되지 않았다.

## 다음 조치

- NCIC/교육부 원문 PDF/HWPX/XLSX 파일을 확보해 official/uploaded sourceType으로 추가 ingest한다.
- STAS 성취기준 상세/성취수준 자료는 로그인 권한 또는 공개 다운로드 endpoint 확인 후 별도 parser를 추가한다.
- KICE 평가자료는 문제 원문 대신 metadata 중심으로 저장하고 이용조건을 명확히 남긴다.
`;

    await writeFile("CORPUS_AUDIT.md", markdown, "utf8");
    console.log(JSON.stringify({
      ok: true,
      output: "CORPUS_AUDIT.md",
      extensionVersion: extension.rows[0]?.extversion ?? null,
      table: TABLE_NAME,
      rowCount: totalRows,
      sourceCounts,
      requiredProvenanceColumnsPresent: hasRequiredColumns,
      canClaimCompleteOfficialCorpus: false,
      canClaimSomeOfficialMetadataEmbedded: canClaimOfficialCorpus,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
