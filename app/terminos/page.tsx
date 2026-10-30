import LegalPage from "@/app/components/LegalPage";
import { BRAND } from "@/app/lib/brand";

export const metadata = { title: "Términos y condiciones" };

export default function Terminos() {
  return (
    <LegalPage title="Términos y condiciones" updated="29 de octubre de 2026">
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
        invisibles (por ejemplo, SynthID de Google) que identifican el contenido como generado por IA.
      </p>
      <h2>4. Disponibilidad</h2>
      <p>
        Los modelos son de terceros y pueden cambiar, tener demoras o dejar de estar disponibles. Si una generación falla
        por un motivo técnico o por un filtro de seguridad, los créditos se devuelven automáticamente.
      </p>
      <h2>5. Limitación de responsabilidad</h2>
      <p>
        El servicio se ofrece “tal cual”. En la medida que permita la ley, nuestra responsabilidad total se limita al monto
        que hayas pagado en los últimos 3 meses.
      </p>
    </LegalPage>
  );
}
