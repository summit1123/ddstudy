import { StudentDemoApp } from "@/components/next-step-demo";

export default async function StudentReviewPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  return <StudentDemoApp initialView="review" initialCardId={cardId} />;
}
