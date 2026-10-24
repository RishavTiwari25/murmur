import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import { AUTHOR } from "@/lib/author";
import "./globals.css";

const sans = Manrope({ subsets: ["latin"], variable: "--font-brand-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-brand-mono", display: "swap" });

const description =
  "Watch a swarm of AI agents plan, delegate, validate, and synthesize one complex goal, live. Built by Rishav Tiwari.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  ),
  title: "Murmur — Agent Swarm Orchestrator by Rishav Tiwari",
  description,
  applicationName: "Murmur",
  authors: [{ name: AUTHOR.name, url: AUTHOR.profileUrl }],
  creator: AUTHOR.name,
  publisher: AUTHOR.name,
  icons: {
    icon: "/brand/murmur-mark.svg",
    shortcut: "/brand/murmur-mark.svg",
    apple: "/brand/murmur-mark.svg",
  },
  openGraph: {
    type: "website",
    siteName: "Murmur",
    title: "Murmur — Live agent swarm orchestration by Rishav Tiwari",
    description,
    images: [{ url: "/brand/murmur-social-preview.png", width: 1280, height: 640 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Murmur — Live agent swarm orchestration by Rishav Tiwari",
    description,
    images: ["/brand/murmur-social-preview.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
