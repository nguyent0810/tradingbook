import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tradelog.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "TradeLog — Setup Intelligence Platform",
  description:
    "TradeLog is a setup intelligence platform: scan the market, surface high-quality setups with the evidence behind each one, and pressure-test every decision before you commit capital.",
  applicationName: "TradeLog",
  openGraph: {
    type: "website",
    siteName: "TradeLog",
    title: "TradeLog — Setup Intelligence Platform",
    description:
      "Know which opportunities deserve your capital. Evidence-driven decision support for traders.",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
