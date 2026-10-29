import { BRAND } from "@/app/lib/brand";

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 text-sm leading-relaxed text-mute [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3">
      <h1 className="text-3xl font-bold text-ink">{title}</h1>
      <p className="mt-2">Última actualización: {updated}</p>
      {children}
      <h2>Contacto</h2>
      <p>
        {BRAND.legalEntity} · <a className="text-brand-2" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
      </p>
    </article>
  );
}
