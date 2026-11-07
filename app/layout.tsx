import type { Metadata } from "next";
import { Michroma, Mrs_Saint_Delafield, Metal_Mania } from "next/font/google";
import "./globals.css";
import { BRAND, SITE_URL } from "@/app/lib/brand";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import PageBackdrop from "@/app/components/PageBackdrop";
import PixelStudio from "@/app/components/PixelStudio";

// Wordmark "TRUST": Michroma ≈ Eurostile Extended, la misma fuente del logo de trustmind.online.
const michroma = Michroma({ variable: "--font-michroma", weight: "400", subsets: ["latin"], display: "swap" });
// "Studio" del logo, como firma a mano.
const firma = Mrs_Saint_Delafield({ variable: "--font-firma", weight: "400", subsets: ["latin"], display: "swap" });

// Títulos KARIBU: letra pintada a mano, como los letreros de mercado. El texto corrido sigue en Inter.
const titulo = Metal_Mania({ variable: "--font-titulo", weight: "400", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${BRAND.name} — Genera imágenes y videos con IA`,
  description:
    "Crea imágenes y videos con IA en español: fotos realistas, videos con voz y clips para redes. Paga solo por lo que generas con créditos prepagados.",
  openGraph: { title: BRAND.name, description: BRAND.tagline, url: SITE_URL, siteName: BRAND.name, locale: "es_419", images: ["/showcase/granja-iphones.jpg"] },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
      </head>
      <body className={`${michroma.variable} ${firma.variable} ${titulo.variable} min-h-screen antialiased`}>
        <Header />
        <main className="relative isolate">
          <PageBackdrop />
          {children}
        </main>
        <Footer />
        <PixelStudio />
      </body>
    </html>
  );
}
