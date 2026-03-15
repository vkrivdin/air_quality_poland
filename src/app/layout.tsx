/**
 * layout.tsx — Root layout for the Powietrze app.
 * Sets global fonts, metadata, and wraps all pages.
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"], // latin-ext covers Polish diacritics
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Powietrze — Jakość powietrza w Polsce",
  description:
    "Interaktywna mapa jakości powietrza w Polsce. Dane z sieci GIOŚ — PM2.5, PM10, NO₂, O₃. Kraków i cała Polska.",
  keywords: ["jakość powietrza", "smog", "Kraków", "Polska", "PM2.5", "PM10", "AQI", "GIOŚ"],
  openGraph: {
    title: "Powietrze — Jakość powietrza w Polsce",
    description: "Interaktywna mapa jakości powietrza. Dane z sieci GIOŚ.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
