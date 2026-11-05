import LegalPage from "@/app/components/LegalPage";
import { BRAND } from "@/app/lib/brand";
import { ENTREGA_TEXTO, RESERVA_USD } from "@/app/lib/minipc";

export const metadata = { title: "Términos y condiciones" };

export default function Terminos() {
  return (
    <LegalPage title="Términos y condiciones" updated="5 de noviembre de 2026">
      <p>
        {BRAND.name} ({BRAND.domain}) es un servicio operado por {BRAND.legalEntity} que permite generar imágenes y videos
        mediante modelos de inteligencia artificial de terceros. Al crear una cuenta aceptas estos términos.
      </p>
      <h2>1. Créditos</h2>
      <p>
        El servicio funciona con créditos prepagados. Cada generación descuenta la cantidad de créditos indicada antes de
        confirmarla. Los créditos no vencen, no son transferibles entre cuentas y no tienen valor fuera de la plataforma.
      </p>
      <h2>1.1 Plan mensual</h2>
      <p>
        El plan mensual cuesta US$20 y se cobra automáticamente a tu tarjeta cada mes, en la misma fecha en que te
        suscribiste, hasta que lo canceles. Cada cobro pagado suma 260 créditos a tu saldo; los créditos que no uses se
        acumulan y no vencen. Puedes cancelar en cualquier momento desde Créditos → Gestionar plan: el plan sigue activo hasta
        el final del período pagado y no se vuelve a cobrar. Si un cobro falla, Stripe lo reintenta y no se suman créditos
        hasta que se pague.
      </p>
      <h2>2. Uso aceptable</h2>
      <p>Está prohibido usar el servicio para generar:</p>
      <ul>
        <li>contenido sexual explícito o cualquier contenido que involucre a menores de edad;</li>
        <li>imágenes o videos de personas reales sin su consentimiento, o que suplanten su identidad;</li>
        <li>desinformación, fraudes, estafas o contenido que se haga pasar por otra marca u organización;</li>
        <li>contenido violento, de odio, que incite al daño o que infrinja derechos de autor o marcas de terceros.</li>
      </ul>
      <p>
        Los modelos aplican filtros de seguridad automáticos. Podemos suspender cuentas que incumplan estas reglas; en ese
        caso los créditos usados indebidamente no se reembolsan.
      </p>
      <h2>3. Propiedad del contenido</h2>
      <p>
        Puedes usar comercialmente lo que generes, sujeto a estos términos y a las políticas de los proveedores de los
        modelos. Eres responsable de cómo publicas y usas ese contenido. Algunos resultados incluyen marcas de agua
        invisibles que identifican el contenido como generado por IA.
      </p>
      <h2>4. Disponibilidad</h2>
      <p>
        Los modelos son de terceros y pueden cambiar, tener demoras o dejar de estar disponibles. Si una generación falla
        por un motivo técnico o por un filtro de seguridad, los créditos se devuelven automáticamente.
      </p>
      <h2>4.1 Respuestas de la inteligencia artificial</h2>
      <p>
        El vendedor y el asistente de la mini PC responden con inteligencia artificial y pueden equivocarse. Revisa la información importante
        antes de usarla. El consumo de IA se descuenta de tus créditos según lo que use cada solicitud.
      </p>
      <h2>5. Limitación de responsabilidad</h2>
      <p>
        El servicio se ofrece “tal cual”. En la medida que permita la ley, nuestra responsabilidad total se limita al monto
        que hayas pagado en los últimos 3 meses.
      </p>
      <h2>6. Compra de equipos TRUST Assistant</h2>
      <div className="mt-4 rounded-lg border border-brand/40 bg-panel p-3 text-ink">
        <strong>Texto provisional: pendiente de revisión legal</strong>
      </div>
      <p>
        Además de los créditos, puedes comprar un equipo TRUST Assistant (la mini PC). Esta sección aplica solo a esa
        compra; lo de los créditos sigue igual.
      </p>
      <ul>
        <li>Los precios de los equipos y de la mensualidad se muestran y se cobran en dólares americanos (USD).</li>
        <li>
          Por ahora los equipos se venden con una reserva de ${RESERVA_USD} USD, que separa tu equipo y se descuenta de su
          precio. El saldo se paga al coordinar la entrega. La reserva no es reembolsable si decides no completar la
          compra; solo la devolvemos si nosotros no podemos entregarte el equipo.
        </li>
        <li>
          Solo enviamos a Perú. La entrega estimada es de {ENTREGA_TEXTO} después de pagado el saldo; es una
          estimación y no una fecha garantizada.
        </li>
        <li>La mensualidad corre desde que activas tu caja, no desde la fecha de compra.</li>
        <li>
          Al pagar, guardamos tu tarjeta con tu permiso para cobrar la mensualidad de forma recurrente. Los datos de la
          tarjeta los maneja nuestro procesador de pagos; nosotros no los almacenamos.
        </li>
        <li>
          Puedes cancelar la mensualidad cuando lo pidas, escribiéndonos por WhatsApp o a soporte. Te confirmaremos la
          cancelación por el mismo medio.
        </li>
      </ul>
    </LegalPage>
  );
}
