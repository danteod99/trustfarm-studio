import type { Metadata } from "next";
import { Michroma, Mrs_Saint_Delafield } from "next/font/google";
import "./globals.css";
import { BRAND, SITE_URL } from "@/app/lib/brand";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import PageBackdrop from "@/app/components/PageBackdrop";

// Wordmark "TRUST": Michroma ≈ Eurostile Extended, la misma fuente del logo de trustmind.online.
const michroma = Michroma({ variable: "--font-michroma", weight: "400", subsets: ["latin"], display: "swap" });
// "Studio" del logo, como firma a mano.
const firma = Mrs_Saint_Delafield({ variable: "--font-firma", weight: "400", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${BRAND.name} — Genera imágenes y videos con IA`,
  description:
    "Crea imágenes y videos con IA en español: Veo 3.1, Nano Banana, Wan 2.2 y más. Paga solo por lo que generas con créditos prepagados.",
  openGraph: { title: BRAND.name, description: BRAND.tagline, url: SITE_URL, siteName: BRAND.name, locale: "es_419" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
      </head>
      <body className={`${michroma.variable} ${firma.variable} min-h-screen antialiased`}>
        <Header />
        <main className="relative isolate">
          <PageBackdrop />
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
