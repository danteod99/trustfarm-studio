import LegalPage from "@/app/components/LegalPage";
import { BRAND } from "@/app/lib/brand";

export const metadata = { title: "Política de privacidad" };

export default function Privacidad() {
  return (
    <LegalPage title="Política de privacidad" updated="5 de noviembre de 2026">
      <h2>Qué datos guardamos</h2>
      <ul>
        <li>Tu email y datos de inicio de sesión.</li>
        <li>Las descripciones, imágenes que subes y los archivos que generas, para mostrarlos en tu galería.</li>
        <li>
          Las descripciones y resultados que generas, y cómo los usas (por ejemplo, si los descargas o los animas), para mejorar
          la calidad de nuestros modelos. Para eso no usamos tu nombre ni tu email, y no los publicamos ni los vendemos.
        </li>
        <li>Tu historial de créditos y compras. Los datos de tu tarjeta los procesa Stripe; nosotros no los vemos.</li>
      </ul>
      <h2>Con quién se comparten</h2>
      <p>
        Para generar el contenido enviamos tu descripción y tu imagen de referencia a nuestros servidores y a los proveedores
        de procesamiento de IA en la nube con los que trabajamos. Usamos Supabase para almacenar datos y Stripe para pagos. No vendemos tus datos.
      </p>
      <h2>Mini PC con vendedor de IA</h2>
      <p>
        Si usas la IA incluida con tus créditos, los mensajes de tus chats pasan por nuestros servidores hacia Anthropic, solo para generar
        la respuesta. No guardamos esas conversaciones: de cada solicitud registramos únicamente la caja, el modelo y cuánto se consumió, para
        poder cobrarla. Las conversaciones se guardan en tu propia mini PC.
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
