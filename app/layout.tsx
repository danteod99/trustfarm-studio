import type { Metadata } from "next";
import { Bricolage_Grotesque, Fraunces, Gochi_Hand } from "next/font/google";
import "./globals.css";
import { BRAND, SITE_URL } from "@/app/lib/brand";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import PageBackdrop from "@/app/components/PageBackdrop";
import PixelStudio from "@/app/components/PixelStudio";

// Look "Noche Yamore" (afro house): Fraunces para títulos y logo, Bricolage Grotesque para texto e interfaz,
// Gochi Hand para acentos escritos a mano (con moderación). Tokens en app/globals.css.
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap", axes: ["opsz"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], display: "swap" });
const gochi = Gochi_Hand({ variable: "--font-gochi", weight: "400", subsets: ["latin"], display: "swap" });

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
    <html lang="es" className={`${fraunces.variable} ${bricolage.variable} ${gochi.variable}`}>
      <body className="min-h-screen font-sans antialiased">
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
