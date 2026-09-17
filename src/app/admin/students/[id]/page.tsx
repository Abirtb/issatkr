import { StudentHistory } from "@/components/admin/student-history";

export default async function StudentHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StudentHistory id={id} />;
}
