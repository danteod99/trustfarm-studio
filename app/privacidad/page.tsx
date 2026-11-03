import LegalPage from "@/app/components/LegalPage";
import { BRAND } from "@/app/lib/brand";

export const metadata = { title: "Política de privacidad" };

export default function Privacidad() {
  return (
    <LegalPage title="Política de privacidad" updated="31 de octubre de 2026">
      <h2>Qué datos guardamos</h2>
      <ul>
        <li>Tu email y datos de inicio de sesión.</li>
        <li>Las descripciones, imágenes que subes y los archivos que generas, para mostrarlos en tu galería.</li>
        <li>Tu historial de créditos y compras. Los datos de tu tarjeta los procesa Stripe; nosotros no los vemos.</li>
      </ul>
      <h2>Con quién se comparten</h2>
      <p>
        Para generar el contenido enviamos tu descripción y tu imagen de referencia a nuestros servidores y a los proveedores
        de procesamiento de IA en la nube con los que trabajamos. Usamos Supabase para almacenar datos y Stripe para pagos. No vendemos tus datos.
      </p>
      <h2>Cookies y píxel de Meta</h2>
      <p>
        En la página de la comunidad usamos el píxel de Meta y su API de conversiones para medir nuestros anuncios. Registran
        acciones como visitar la página o pulsar el botón para unirte, junto con tu dirección IP, tu navegador y las cookies
        de Meta.
      </p>
      <h2>Tus derechos</h2>
      <p>
        Puedes pedir una copia o la eliminación de tus datos y archivos escribiendo a {BRAND.supportEmail}.
      </p>
    </LegalPage>
  );
}
