import type { Metadata } from "next";
import "./globals.css";
import { BRAND, SITE_URL } from "@/app/lib/brand";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

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
      <body className="min-h-screen antialiased">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
