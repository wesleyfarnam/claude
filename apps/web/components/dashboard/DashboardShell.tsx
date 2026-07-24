"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";

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

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={`block rounded px-3 py-2.5 font-heading text-btn uppercase tracking-[1px] transition ${
                active
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SignOut({ email }: { email: string }) {
  return (
    <div className="border-t border-white/10 p-4 text-sm">
      <p className="truncate text-white/80">{email}</p>
      <form method="post" action="/api/auth/signout">
        <button type="submit" className="mt-2 text-white/60 hover:text-aqua">
          Sign out
        </button>
      </form>
    </div>
  );
}

export function DashboardShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-athens md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-col bg-paua text-white md:flex">
        <div className="px-6 py-6">
          <Logo variant="light" className="text-2xl" />
        </div>
        <nav className="flex-1 px-3">
          <NavList />
        </nav>
        <SignOut email={email} />
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between bg-paua px-4 py-3 md:hidden">
        <Logo variant="light" className="text-xl" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded p-2 text-white hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 flex h-full w-72 max-w-[85%] flex-col bg-paua text-white shadow-xl">
            <div className="flex items-center justify-between px-6 py-5">
              <Logo variant="light" className="text-xl" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded p-2 text-white hover:bg-white/10"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3">
              <NavList onNavigate={() => setOpen(false)} />
            </nav>
            <SignOut email={email} />
          </div>
        </div>
      ) : null}

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
