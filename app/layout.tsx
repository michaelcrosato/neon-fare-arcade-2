import type { Metadata } from "next";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/900.css";
import "@fontsource/barlow-condensed/900-italic.css";
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neon Fare — Comic Overdrive",
  description:
    "Pick up fares, deliver parcels, and explore six distinct regions—from Solana Coast to Palm Reach—in Arcade Shift or Free Run.",
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
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
