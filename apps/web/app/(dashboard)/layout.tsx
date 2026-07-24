import { requireUser } from "@/lib/auth/rbac";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { signOutAction } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();

  return (
    <DashboardShell email={user.email ?? ""} signOut={signOutAction}>
      {children}
    </DashboardShell>
  );
}
