import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  ),
  title: "Murmur — Agent Swarm Orchestrator",
  description:
    "Watch a swarm of AI agents self-organize to solve what one agent can't: plan, delegate, validate, and synthesize — live.",
  icons: {
    icon: "/brand/murmur-mark.svg",
    shortcut: "/brand/murmur-mark.svg",
    apple: "/brand/murmur-mark.svg",
  },
  openGraph: {
    title: "Murmur — Live agent swarm orchestration",
    description: "Turn one complex goal into a live, durable, validated agent swarm.",
    images: [{ url: "/brand/murmur-social-preview.png", width: 1280, height: 640 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Murmur — Live agent swarm orchestration",
    description: "Turn one complex goal into a live, durable, validated agent swarm.",
    images: ["/brand/murmur-social-preview.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
