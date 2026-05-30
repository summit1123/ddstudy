import { errorResponse, jsonResponse, requestJson } from "../../../../lib/ai";
import { searchResources } from "../../../../lib/rag";
import { SearchRequestSchema, validationError } from "../../../../lib/schemas";

export const runtime = "nodejs";

function inputFromUrl(request: Request) {
  const url = new URL(request.url);
  return {
    q: url.searchParams.get("q") ?? url.searchParams.get("query") ?? "",
    subject: url.searchParams.get("subject") ?? undefined,
    gradeBand: url.searchParams.get("gradeBand") ?? undefined,
    sourceType: url.searchParams.get("sourceType") ?? undefined,
    tags: url.searchParams.getAll("tag"),
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
  };
}

export async function GET(request: Request) {
  try {
    const parsed = SearchRequestSchema.safeParse(inputFromUrl(request));
    if (!parsed.success) return jsonResponse(validationError(parsed.error), 400);

    const resources = await searchResources(parsed.data);
    return jsonResponse({ resources });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = SearchRequestSchema.safeParse(await requestJson(request));
    if (!parsed.success) return jsonResponse(validationError(parsed.error), 400);

    const resources = await searchResources(parsed.data);
    return jsonResponse({ resources });
  } catch (error) {
    return errorResponse(error);
  }
}
