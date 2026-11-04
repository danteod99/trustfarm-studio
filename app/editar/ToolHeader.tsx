import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Encabezado común de las herramientas de /editar. */
export default function ToolHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <Link href="/editar" className="mb-4 inline-flex items-center gap-1.5 text-xs text-mute hover:text-ink">
        <ArrowLeft size={13} /> Editar
      </Link>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand/40 bg-brand/10 text-brand-2">
          {icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-mute">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

/** Aviso de error con enlace a recargar si faltan créditos. */
export function ErrorBox({ msg, onClose }: { msg: string; onClose?: () => void }) {
  const credits = /cr[eé]ditos insuficientes/i.test(msg);
  return (
    <div className="card flex items-start gap-3 border-red-500/50 bg-red-500/5 p-4 text-sm text-red-300">
      <span className="flex-1">
        {msg}{" "}
        {credits && (
          <Link href="/creditos" className="font-semibold text-brand-2 hover:underline">
            Comprar créditos
          </Link>
        )}
      </span>
      {onClose && (
        <button onClick={onClose} className="text-mute hover:text-ink" aria-label="Cerrar">
          ×
        </button>
      )}
    </div>
  );
}
