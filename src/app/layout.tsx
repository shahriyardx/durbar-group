import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Hind_Siliguri,
  JetBrains_Mono,
  Manrope,
} from "next/font/google";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";

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

export const metadata: Metadata = {
  title: "Durbar Group — Programming Hero",
  description:
    "An optional elite track inside the Programming Hero bootcamp for students training to become AI-Powered Web Engineers.",
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
