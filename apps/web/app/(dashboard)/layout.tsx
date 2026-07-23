import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { requireUser } from "@/lib/auth/rbac";
import { signOutAction } from "./actions";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/locations", label: "Locations" },
  { href: "/devices", label: "Devices" },
  { href: "/media", label: "Media" },
  { href: "/displays", label: "Displays" },
  { href: "/playlists", label: "Playlists" },
  { href: "/schedules", label: "Schedules" },
  { href: "/reports/proof-of-play", label: "Reports" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();

  return (
    <div className="flex min-h-screen bg-athens">
      <aside className="flex w-60 flex-col bg-paua text-white">
        <div className="px-6 py-6">
          <Logo variant="light" className="text-2xl" />
        </div>
        <nav className="flex-1 px-3">
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href}
                  className="block rounded px-3 py-2 font-heading text-btn uppercase tracking-[1px] text-white/70 hover:bg-white/10 hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-white/10 p-4 text-sm">
          <p className="truncate text-white/80">{user.email}</p>
          <form action={signOutAction}>
            <button type="submit" className="mt-2 text-white/60 hover:text-aqua">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
