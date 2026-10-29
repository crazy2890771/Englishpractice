import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorker } from "@/components/app/service-worker";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex-thai", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Fluency Lab", template: "%s · Fluency Lab" },
  description: "Fluency Lab — your personal language academy for English and Mandarin Chinese.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Fluency Lab", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf9f6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${plexThai.variable} ${inter.variable}`}>
      <body className="min-h-dvh font-sans">
        {children}
        <Toaster />
        <ServiceWorker />
      </body>
    </html>
  );
}
