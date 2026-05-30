import { readFile } from "node:fs/promises";
import path from "node:path";

export type PublicResourceRecord = {
  id: string;
  kind: "achievement-standard-index" | "curriculum-release" | "api-source";
  title: string;
  sourceName: string;
  sourceUrl: string;
  verifiedAt: string;
  licenseNote: string;
  curriculumRevision?: string;
  schoolLevel?: string;
  subject?: string;
  evidence: string;
};

export type PublicResourceDataset = {
  datasetId: string;
  generatedAt: string;
  sourcePolicy: string;
  records: PublicResourceRecord[];
};

const RESOURCE_DATA_PATH = path.join(
  process.cwd(),
  "data",
  "public",
  "resources.json",
);

export async function loadPublicResources(): Promise<PublicResourceDataset> {
  const raw = await readFile(RESOURCE_DATA_PATH, "utf8");
  const parsed = JSON.parse(raw) as PublicResourceDataset;
  validatePublicResourceDataset(parsed);
  return parsed;
}

export async function summarizePublicResources() {
  const dataset = await loadPublicResources();
  const byKind = dataset.records.reduce<Record<string, number>>((acc, record) => {
    acc[record.kind] = (acc[record.kind] ?? 0) + 1;
    return acc;
  }, {});

  return {
    datasetId: dataset.datasetId,
    generatedAt: dataset.generatedAt,
    sourcePolicy: dataset.sourcePolicy,
    count: dataset.records.length,
    byKind,
  };
}

function validatePublicResourceDataset(dataset: PublicResourceDataset): void {
  if (!dataset.datasetId || !Array.isArray(dataset.records)) {
    throw new Error("Invalid public resource dataset.");
  }

  for (const record of dataset.records) {
    if (
      !record.id ||
      !record.kind ||
      !record.title ||
      !record.sourceName ||
      !record.sourceUrl ||
      !record.verifiedAt ||
      !record.evidence
    ) {
      throw new Error(`Invalid public resource record: ${record.id || "unknown"}`);
    }
  }
}
