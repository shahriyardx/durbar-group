import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Hind_Siliguri,
  JetBrains_Mono,
  Manrope,
} from "next/font/google";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import { env } from "@/lib/env";

// Bricolage carries the display voice, Manrope keeps body copy quiet,
// JetBrains Mono stamps the spec-sheet labels, Hind Siliguri renders বাংলা.
const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono-src",
  subsets: ["latin"],
  display: "swap",
});

const bangla = Hind_Siliguri({
  variable: "--font-bangla-src",
  subsets: ["bengali"],
  weight: ["400", "600", "700"],
  display: "swap",
});

// The landing page is Bengali and so is everyone who will see a shared link,
// so the preview card speaks Bengali. `icon.svg`, `apple-icon.png`,
// `opengraph-image.png` and `twitter-image.png` sit beside this file and Next
// wires them in by convention — there is no `icons` or `images` field here on
// purpose, since naming them twice is how they drift.
const DESCRIPTION =
  "প্রোগ্রামিং হিরো ব্যাচের ভেতরে একটি আলাদা, ছোট আর শক্ত টিম। নিজের ইন্সট্রাক্টর, নিয়মিত টাস্ক, আর নিজের ডিসকর্ড চ্যানেল — যারা সত্যিই লেগে থাকতে চায় তাদের জন্য।";

export const metadata: Metadata = {
  // Resolved per request, so the same image works on every deployment.
  metadataBase: new URL(env.BETTER_AUTH_URL),
  title: {
    default: "দুর্বার গ্রুপ — Durbar Group | Programming Hero",
    template: "%s · দুর্বার গ্রুপ",
  },
  description: DESCRIPTION,
  applicationName: "Durbar",
  keywords: [
    "দুর্বার গ্রুপ",
    "Durbar Group",
    "Programming Hero",
    "প্রোগ্রামিং হিরো",
    "AI-Powered Web Engineer",
    "ওয়েব ডেভেলপমেন্ট কোর্স",
  ],
  authors: [{ name: "Programming Hero" }],
  creator: "Programming Hero",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "bn_BD",
    url: "/",
    siteName: "দুর্বার গ্রুপ",
    title: "দুর্বার গ্রুপ — যারা সত্যিই লেগে থাকতে চায়",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "দুর্বার গ্রুপ — যারা সত্যিই লেগে থাকতে চায়",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // Dark is the only theme; the class keeps shadcn's dark: variants live.
      className={`dark ${sans.variable} ${display.variable} ${mono.variable} ${bangla.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster theme="dark" richColors position="top-center" />
      </body>
    </html>
  );
}
