import { TeacherDemoApp } from "@/components/next-step-demo";

export default async function StudentReportPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return <TeacherDemoApp initialView="reports" initialStudentId={studentId} />;
}
