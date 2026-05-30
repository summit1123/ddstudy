import { TeacherApp } from "@/components/next-step-app";

export default async function StudentReportPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return <TeacherApp initialView="reports" initialStudentId={studentId} />;
}
