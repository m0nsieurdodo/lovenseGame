import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LovenseProvider } from "@/components/lovense-provider";

export const metadata: Metadata = {
  title: "Arcade × Lovense",
  description: "Suite de mini-jeux arcade néon pilotant un toy Lovense.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0f1a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&family=Orbitron:wght@600;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LovenseProvider>{children}</LovenseProvider>
      </body>
    </html>
  );
}
