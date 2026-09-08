import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/900.css";
import "@fontsource/barlow-condensed/900-italic.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Neon Fare — Comic Overdrive",
  description:
    "Pick up fares, deliver parcels, and explore five distinct regions—from Neon City to Cypress Reach—in Arcade Shift or Free Run.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="prefetch" as="image" href="/fare-destinations.webp" type="image/webp" />
        <link rel="prefetch" as="image" href="/fare-destinations-2.webp" type="image/webp" />
        <link rel="prefetch" as="image" href="/fare-destinations-3.webp" type="image/webp" />
        <link rel="prefetch" as="image" href="/fare-destinations-4.webp" type="image/webp" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
