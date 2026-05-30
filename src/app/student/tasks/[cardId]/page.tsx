import { StudentDemoApp } from "@/components/next-step-demo";

export default async function StudentTaskPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  return <StudentDemoApp initialView="task" initialCardId={cardId} />;
}
