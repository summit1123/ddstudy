import { TeacherDemoApp } from "@/components/next-step-demo";

export default async function EditExecutionCardPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  return <TeacherDemoApp initialView="cards" initialCardId={cardId} />;
}
