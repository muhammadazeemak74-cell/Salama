import type { Metadata } from "next";
import { Bodoni_Moda, Inter } from "next/font/google";
import "./globals.css";
import { SmoothScrollProvider } from "@/lib/scroll-provider";
import { BackgroundScene } from "@/components/scene/BackgroundScene";

const bodoniModa = Bodoni_Moda({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "ONYX — Arrive in black.",
  description:
    "Private chauffeur service for travelers arriving in Dubai. Cadillac Escalade, Mercedes S-Class, Rolls-Royce Ghost and more. Reserve on WhatsApp, 24/7.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bodoniModa.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-onyx text-off-white font-sans">
        <SmoothScrollProvider>
          <BackgroundScene />
          <div className="relative z-10">{children}</div>
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
