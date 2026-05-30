#!/usr/bin/env tsx

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeStandardDocument } from "../src/lib/corpus/normalize";

type StasRow = {
  totalCnt?: number;
  acvmtStdSeq?: number;
  acvmtStdCd?: string | null;
  acvmtStdNm?: string | null;
  eduCurclmNm?: string | null;
  schlClsNm?: string | null;
  grdGrpNm?: string | null;
  corsNm?: string | null;
  sbjtNm?: string | null;
  eduCurclmCorsSbjtNm?: string | null;
  corsSbjtClsfcA1Nm?: string | null;
  assmtEvalTaskCnt?: number;
  descrptEvalTaskCnt?: number;
  fldCntrEvalTaskCnt?: number;
  id?: number;
};

function argValue(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function numberArg(name: string, fallback: number) {
  const value = Number(argValue(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function schoolsFromArg(value: string) {
  if (value === "all") return ["s1", "s2", "s3"];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

async function fetchPage({
  school,
  curriculum,
  page,
  size,
}: {
  school: string;
  curriculum: string;
  page: number;
  size: number;
}) {
  const url = new URL("https://stas.moe.go.kr/rest/acvmt/acvmtStd/acvmtStdList");
  url.searchParams.set("sSchlClsCd", school);
  url.searchParams.set("sEduCurclmCd", curriculum);
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", String(size));

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "daeum-hangeoreum-demo-corpus-collector/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`STAS request failed with ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json() as { content?: StasRow[] };
  return payload.content ?? [];
}

function normalizeSchoolCodeLabel(code: string) {
  if (code === "s1") return "초등학교";
  if (code === "s2") return "중학교";
  if (code === "s3") return "고등학교";
  return code;
}

function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function main() {
  const schoolArg = argValue("school", "s1") as string;
  const schools = schoolsFromArg(schoolArg);
  const curriculum = argValue("curriculum", "2015") as string;
  const size = numberArg("size", 100);
  const maxPerSchool = numberArg("max", Number.MAX_SAFE_INTEGER);
  const output = argValue("output", `data/processed/stas-standards-${schoolArg}.json`) as string;
  const collectedAt = new Date().toISOString();
  const documents = [];
  const totals: Record<string, number | null> = {};

  for (const school of schools) {
    let page = 0;
    let total = Infinity;
    let collectedForSchool = 0;

    while (collectedForSchool < Math.min(maxPerSchool, total)) {
      const rows = await fetchPage({ school, curriculum, page, size });
      if (rows.length === 0) break;
      total = rows[0]?.totalCnt ?? total;

      for (const row of rows) {
        if (collectedForSchool >= maxPerSchool) break;
        if (!row.acvmtStdNm || !row.acvmtStdCd) continue;

        const sourceUrl = `https://stas.moe.go.kr/acvmt/acvmtStd/acvmtStdList:${school}`;
        const curriculumName = optionalText(row.eduCurclmNm);
        const schoolLevel = optionalText(row.schlClsNm) ?? normalizeSchoolCodeLabel(school);
        const gradeBand = optionalText(row.grdGrpNm) ?? "미분류";
        const course = optionalText(row.corsNm);
        const subject = optionalText(row.sbjtNm) ?? course ?? "미분류";
        const domain = optionalText(row.corsSbjtClsfcA1Nm);
        const standardCode = optionalText(row.acvmtStdCd);
        const standardText = optionalText(row.acvmtStdNm);
        const text = [
          `${standardCode} ${standardText}`,
          `교육과정: ${curriculumName ?? curriculum}`,
          `학교급: ${schoolLevel}`,
          `학년군: ${gradeBand}`,
          `교과/과목: ${[course, subject].filter(Boolean).join(" / ")}`,
          domain ? `영역: ${domain}` : undefined,
        ].filter(Boolean).join("\n");

        documents.push(normalizeStandardDocument({
          id: `stas:${school}:${row.acvmtStdSeq ?? row.id ?? standardCode}`,
          sourceType: "official",
          provider: "KICE/STAS",
          sourceName: "학생평가지원포털 성취기준 공개 REST",
          sourceUrl,
          license: "공식 포털 공개 metadata. 재이용/재배포 조건은 STAS 및 교육부/KICE 약관 확인 필요.",
          collectedAt,
          curriculumYear: curriculumName,
          schoolLevel,
          gradeBand,
          subject,
          domain,
          standardCode,
          title: `${standardCode} ${subject} 성취기준`,
          text,
          chunkType: "standard",
          keywords: [
            standardCode,
            curriculumName,
            schoolLevel,
            gradeBand,
            course,
            subject,
            domain,
          ].filter((value): value is string => Boolean(value)),
          metadata: {
            stasEndpoint: "/rest/acvmt/acvmtStd/acvmtStdList",
            schoolCode: school,
            curriculumCode: curriculum,
            acvmtStdSeq: row.acvmtStdSeq,
            eduCurclmCorsSbjtNm: optionalText(row.eduCurclmCorsSbjtNm),
            assessmentTaskCounts: {
              assmtEvalTaskCnt: row.assmtEvalTaskCnt ?? 0,
              descrptEvalTaskCnt: row.descrptEvalTaskCnt ?? 0,
              fldCntrEvalTaskCnt: row.fldCntrEvalTaskCnt ?? 0,
            },
          },
        }));
        collectedForSchool += 1;
      }

      page += 1;
    }

    totals[school] = Number.isFinite(total) ? total : null;
  }

  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(documents, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    ok: true,
    source: "STAS",
    school: schoolArg,
    schools,
    curriculum,
    output,
    documents: documents.length,
    totalAvailable: totals,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
