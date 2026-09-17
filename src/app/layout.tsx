import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "ISSATKR Présence",
  description: "Saisie de présence — ISSAT Kairouan",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geist.variable} antialiased`}>
      <body className="min-h-screen bg-bg font-sans text-ink">{children}</body>
    </html>
  );
}
