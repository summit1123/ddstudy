import { readDb } from "./db";
import type { AppDb } from "./types";

export function resolveDemoStudentId(db: AppDb, request?: Request) {
  const requested = request ? new URL(request.url).searchParams.get("studentId") : null;
  const studentId = requested && db.students.some((student) => student.id === requested)
    ? requested
    : db.students[0]?.id;
  if (!studentId) throw new Error("데모 학생 데이터가 없습니다.");
  return studentId;
}

export async function validatePublishedStudentStep(cardId: string, stepId: string) {
  const db = await readDb();
  const card = db.executionCards.find((item) => item.id === cardId);
  if (!card || card.status !== "published") {
    return { ok: false as const, error: "배포된 과제를 찾을 수 없습니다." };
  }

  const step = db.executionSteps.find(
    (item) => item.id === stepId && item.cardId === cardId
  );
  if (!step) {
    return { ok: false as const, error: "과제 단계를 찾을 수 없습니다." };
  }

  return { ok: true as const, db, card, step };
}

export async function validatePublishedStudentCard(cardId: string) {
  const db = await readDb();
  const card = db.executionCards.find((item) => item.id === cardId);
  if (!card || card.status !== "published") {
    return { ok: false as const, error: "배포된 과제를 찾을 수 없습니다." };
  }

  return { ok: true as const, db, card };
}
