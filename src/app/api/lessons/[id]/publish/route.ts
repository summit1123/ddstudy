import { ApiError, errorResponse, jsonResponse } from "../../../../../lib/ai";
import { readDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await readDb();
    const lesson = db.lessons.find((item) => item.id === id);
    if (!lesson) throw new ApiError(404, "not_found", `Lesson not found: ${id}`);

    return jsonResponse({ lesson, status: "published" });
  } catch (error) {
    return errorResponse(error);
  }
}
