#!/usr/bin/env tsx

import { readFile } from "node:fs/promises";
import { loadLocalEnv } from "./load-local-env";
import type { CorpusSourceType } from "../src/lib/corpus/types";

loadLocalEnv();

function argValue(name: string) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found?.slice(prefix.length);
}

async function main() {
  const { StandardDocumentSchema } = await import("../src/lib/schemas");
  const { defaultStandards, ingestStandards } = await import("../src/lib/rag");

  const args = process.argv.slice(2);
  const inputPath = args.find((arg) => !arg.startsWith("-"));
  const reset = args.includes("--reset");
  const sourceType = argValue("source") as CorpusSourceType | undefined;

  const rawDocuments = inputPath
    ? StandardDocumentSchema.array().parse(JSON.parse(await readFile(inputPath, "utf8")))
    : defaultStandards;
  const documents = sourceType
    ? rawDocuments.map((document) => ({
        ...document,
        sourceType,
        sourceName: document.sourceName ?? document.source,
        sourceUrl: document.sourceUrl ?? document.url,
        provider: document.provider ?? (sourceType === "seed" ? "다음한걸음" : "미확인 제공기관"),
        source: document.sourceName ?? document.source,
        url: document.sourceUrl ?? document.url,
      }))
    : rawDocuments;

  const result = await ingestStandards(documents, reset);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
    details: "details" in Object(error) ? Object(error).details : undefined,
  }, null, 2));
  process.exit(1);
});
