import { ReportsView } from "@/components/reports-view";
import { getSession } from "@/lib/auth";

export default async function ReportsPage() {
  const session = await getSession();
  // The official absence file contains CINs: admins only.
  return <ReportsView canExportOfficial={session?.role === "ADMIN"} />;
}
