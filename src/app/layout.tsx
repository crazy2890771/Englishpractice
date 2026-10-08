import type { Metadata, Viewport } from "next";
import { Inter, Caveat } from "next/font/google";
import { themeScript } from "@/components/theme";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-script", display: "swap" });

export const metadata: Metadata = {
  title: { default: "English Fluency Lab", template: "%s · English Fluency Lab" },
  description: "Speak, listen, write and shadow your way to more fluent English in 30 days.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Fluency Lab", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070b1c" },
    { media: "(prefers-color-scheme: light)", color: "#f4f6fc" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${caveat.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-white">
          Skip to content
        </a>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
