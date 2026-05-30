import { StudentApp } from "@/components/next-step-app";

export default async function StudentTaskPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  return <StudentApp initialView="task" initialCardId={cardId} />;
}
