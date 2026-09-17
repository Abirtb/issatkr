import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Shell } from "@/components/shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "ADMIN") redirect("/classes");

  return (
    <Shell role="ADMIN" name={session.name}>
      {children}
    </Shell>
  );
}
