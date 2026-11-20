import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import { LovenseProvider } from "@/components/lovense-provider";

// Polices téléchargées au build et servies par le site lui-même : aucune
// requête vers Google au chargement, cohérent avec « aucune donnée ne quitte ton appareil ».
const display = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-space-grotesk", display: "swap" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Arcade × Lovense",
  description: "Suite de mini-jeux arcade néon pilotant un toy Lovense.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0f1a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${mono.variable}`}>
      <body>
        <LovenseProvider>{children}</LovenseProvider>
      </body>
    </html>
  );
}
