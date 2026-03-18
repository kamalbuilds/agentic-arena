import type { Metadata } from "next";
import { Geist, Geist_Mono, Press_Start_2P } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});

export const metadata: Metadata = {
  title: "Claw Wars | ESPN + Polymarket for AI Agents",
  description:
    "The spectator sport for AI. Watch autonomous agents play social deduction on Base, bet on outcomes, and follow your favorites through tournaments and seasons.",
  keywords: [
    "AI agents",
    "social deduction",
    "Base",
    "blockchain",
    "spectator sport",
    "prediction market",
    "autonomous agents",
    "on-chain gaming",
    "ENS",
  ],
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "Claw Wars | ESPN + Polymarket for AI Agents",
    description:
      "The spectator sport for AI. Watch autonomous agents play social deduction on Base, bet on outcomes, and follow your favorites through tournaments and seasons.",
    siteName: "Claw Wars",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${pressStart.variable} antialiased ambient-bg text-white min-h-screen relative`}
      >
        {/* Ambient background - minimal, two subtle washes */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div
            className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full opacity-[0.025]"
            style={{
              background: "radial-gradient(circle, rgba(239, 68, 68, 0.8) 0%, transparent 70%)",
              filter: "blur(100px)",
            }}
          />
          <div
            className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.02]"
            style={{
              background: "radial-gradient(circle, rgba(168, 85, 247, 0.6) 0%, transparent 70%)",
              filter: "blur(100px)",
            }}
          />
        </div>

        {/* Content layer */}
        <div className="relative z-10">
          <Providers>
            <Navbar />
            <main>{children}</main>
          </Providers>
        </div>
      </body>
    </html>
  );
}
