import { errorResponse, jsonResponse, requestJson } from "../../../../lib/ai";
import { defaultStandards, ingestStandards } from "../../../../lib/rag";
import { IngestStandardsRequestSchema, validationError } from "../../../../lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = IngestStandardsRequestSchema.safeParse(await requestJson(request));
    if (!parsed.success) return jsonResponse(validationError(parsed.error), 400);

    const result = await ingestStandards(parsed.data.documents ?? defaultStandards, parsed.data.reset);
    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
