import { errorResponse, jsonResponse } from "../../../../lib/ai";
import { pgvectorStatus } from "../../../../lib/pgvector";

export const runtime = "nodejs";

export async function GET() {
  try {
    return jsonResponse({ ok: true, ...(await pgvectorStatus()) });
  } catch (error) {
    return errorResponse(error);
  }
}
