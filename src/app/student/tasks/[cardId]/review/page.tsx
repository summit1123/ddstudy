import { StudentApp } from "@/components/next-step-app";

export default async function StudentReviewPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  return <StudentApp initialView="review" initialCardId={cardId} />;
}
