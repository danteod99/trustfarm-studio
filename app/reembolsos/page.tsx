import LegalPage from "@/app/components/LegalPage";
import { RESERVA_USD } from "@/app/lib/minipc";

export const metadata = { title: "Política de reembolsos" };

export default function Reembolsos() {
  return (
    <LegalPage title="Política de reembolsos" updated="5 de noviembre de 2026">
      <h2>Generaciones fallidas</h2>
      <p>
        Si una generación no se completa por un error técnico, por tiempo de espera o por el filtro de seguridad del modelo,
        los créditos se devuelven automáticamente a tu saldo.
      </p>
      <h2>Paquetes de créditos</h2>
      <p>
        Puedes pedir el reembolso de un paquete dentro de los 14 días posteriores a la compra si no has usado ninguno de sus
        créditos. Una vez usados, los créditos no son reembolsables, ya que el costo de generación ya se pagó al proveedor del
        modelo.
      </p>
      <h2>Plan mensual</h2>
      <p>
        Puedes cancelar el plan cuando quieras desde Créditos → Gestionar plan; no se cobrarán más meses. Puedes pedir el
        reembolso del último cobro dentro de los 14 días si no has usado ninguno de los créditos de ese mes. Los meses ya
        usados no son reembolsables.
      </p>
      <h2>Equipos mini PC</h2>
      <p>
        Esta sección es solo para la compra de equipos TRUST Assistant (mini PC). La política de reembolso de los paquetes
        de créditos descrita arriba no cambia.
      </p>
      <p>
        La reserva de ${RESERVA_USD} USD con la que separas tu equipo no es reembolsable si decides no completar la compra.
        Solo la devolvemos si nosotros no podemos entregarte el equipo.
      </p>
      <p>
        Las devoluciones de equipos se coordinan caso por caso con soporte, escribiéndonos por WhatsApp o al email de
        contacto.
      </p>
      <h2>Cómo solicitarlo</h2>
      <p>Escríbenos desde el email de tu cuenta indicando la fecha de compra. Respondemos en un máximo de 3 días hábiles.</p>
    </LegalPage>
  );
}
