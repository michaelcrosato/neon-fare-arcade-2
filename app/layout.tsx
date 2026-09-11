import type { Metadata, Viewport } from "next";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/900.css";
import "@fontsource/barlow-condensed/900-italic.css";
import "./fonts.css";
import "./globals.css";

const title = "Neon Fare — Comic Overdrive";
const description = "Pick up fares, deliver parcels, and explore six distinct regions—from Solana Coast to Palm Reach—in Arcade Shift or Free Run.";
const previewImage = {
  url: "/comic-hero.webp",
  width: 1672,
  height: 941,
  alt: "Neon Fare intro artwork: a yellow taxi leaps through a comic-book city.",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://neon-fare-arcade-2.vercel.app"),
  title,
  description,
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Neon Fare",
    title,
    description,
    images: [previewImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [previewImage],
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#090909" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" as="audio" href="/music/bgm_02.mp3" type="audio/mpeg" />
        <link rel="prefetch" as="image" href="/fare-destinations.webp" type="image/webp" />
        <link rel="prefetch" as="image" href="/fare-destinations-2.webp" type="image/webp" />
        <link rel="prefetch" as="image" href="/fare-destinations-3.webp" type="image/webp" />
        <link rel="prefetch" as="image" href="/fare-destinations-4.webp" type="image/webp" />
      </head>
      <body className="antialiased">
        <audio id="neon-fare-bgm" src="/music/bgm_02.mp3" preload="auto" loop playsInline autoPlay />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var a=document.getElementById("neon-fare-bgm");if(!a)return;a.volume=0.38;var u=function(){if(a.paused)a.play().catch(function(){});window.removeEventListener("pointerdown",u);window.removeEventListener("keydown",u);window.removeEventListener("touchstart",u);window.removeEventListener("mousedown",u);window.removeEventListener("click",u);};window.addEventListener("pointerdown",u,{passive:true});window.addEventListener("keydown",u,{passive:true});window.addEventListener("touchstart",u,{passive:true});window.addEventListener("mousedown",u,{passive:true});window.addEventListener("click",u,{passive:true});a.play().catch(function(){});}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
