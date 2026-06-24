import type { Metadata } from "next";
import { Lato, Pathway_Gothic_One } from "next/font/google";
import { brand } from "@drip-tv/shared";
import "./globals.css";

const body = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-body",
  display: "swap",
});

const heading = Pathway_Gothic_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description:
    "Drip TV is a retail digital signage platform for Amazon Signage Sticks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
