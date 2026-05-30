import { ApiError, errorResponse, jsonResponse } from "../../../../../lib/ai";
import { updateDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const card = await updateDb((db) => {
      const index = db.executionCards.findIndex((item) => item.id === id);
      if (index < 0) throw new ApiError(404, "not_found", `Execution card not found: ${id}`);
      const now = new Date().toISOString();
      db.executionCards[index] = {
        ...db.executionCards[index],
        status: "published",
        publishedAt: now,
        updatedAt: now,
      };
      return db.executionCards[index];
    });

    return jsonResponse({ card });
  } catch (error) {
    return errorResponse(error);
  }
}
