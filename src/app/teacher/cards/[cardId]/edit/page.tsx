import { TeacherApp } from "@/components/next-step-app";

export default async function EditExecutionCardPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  return <TeacherApp initialView="cards" initialCardId={cardId} />;
}
