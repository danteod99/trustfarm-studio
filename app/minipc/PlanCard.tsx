import { Check } from "lucide-react";
import type { Plan } from "@/app/lib/minipc";
import { ENTREGA_TEXTO, RESERVA_USD, saldoUsd } from "@/app/lib/minipc";
import BotonComprar from "./BotonComprar";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function PlanCard({ plan, ventaAbierta }: { plan: Plan; ventaAbierta: boolean }) {
  return (
    <article
      aria-labelledby={`plan-${plan.id}`}
      className={`card relative flex flex-col p-6 ${plan.recomendado ? "border-brand shadow-xl shadow-brand/10" : ""}`}
    >
      {plan.recomendado && (
        <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">
          Recomendado
        </span>
      )}
      <p className="eyebrow">{plan.subtitulo}</p>
      <h3 id={`plan-${plan.id}`} className="mt-1 text-2xl font-bold">
        {plan.nombre}
      </h3>
      <p className="mt-4 text-4xl font-bold tracking-tight">
        {usd.format(plan.precioUsd)} <span className="text-base font-medium text-mute">USD</span>
      </p>
      <p className="text-sm text-mute">+ {usd.format(plan.mensualUsd)} al mes</p>
      <p className="mt-1 text-xs text-mute">La mensualidad empieza cuando activas tu caja</p>
      <p className="mt-3 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-sm">
        Resérvala hoy con <strong>{usd.format(RESERVA_USD)}</strong>. Se descuentan del precio: el saldo de{" "}
        {usd.format(saldoUsd(plan))} lo pagas al coordinar la entrega. La reserva no es reembolsable.
      </p>

      <dl className="mt-5 space-y-2 text-sm">
        <div>
          <dt className="text-mute">Ideal para</dt>
          <dd>{plan.idealPara}</dd>
        </div>
        <div>
          <dt className="text-mute">Equipo</dt>
          <dd>{plan.equipo}</dd>
        </div>
        <div>
          <dt className="text-mute">Memoria</dt>
          <dd>{plan.memoria}</dd>
        </div>
      </dl>

      <p className="mt-5 text-sm text-mute">Incluye</p>
      <ul className="mt-2 flex-1 space-y-2 text-sm">
        {plan.incluye.map((i) => (
          <li key={i} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            <span>{i}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <BotonComprar
          planId={plan.id}
          etiqueta={`Reservar ${plan.nombre} con ${usd.format(RESERVA_USD)}`}
          ventaAbierta={ventaAbierta}
          destacado={plan.recomendado}
        />
        <p className="mt-3 text-xs text-mute">Envíos solo a Perú por ahora · Entrega en {ENTREGA_TEXTO}</p>
      </div>
    </article>
  );
}
