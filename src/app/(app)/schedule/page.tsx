import { redirect } from "next/navigation";
import { ScheduleManager } from "@/components/schedule-manager";
import { getSession } from "@/lib/auth";

export default async function SchedulePage() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "ADMIN" && session.role !== "DEPARTMENT_HEAD")
  ) {
    redirect("/classes");
  }
  return <ScheduleManager />;
}
