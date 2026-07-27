import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Drip TV Player",
  // Kiosk screens shouldn't be indexed.
  robots: { index: false, follow: false },
};

/**
 * Kiosk shell for the on-screen player: full-viewport, no scroll, no cursor.
 * Deliberately outside the (dashboard) group so it gets none of the dashboard
 * chrome or the Supabase-session redirect.
 */
export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-black [cursor:none] select-none">
      {children}
    </div>
  );
}
