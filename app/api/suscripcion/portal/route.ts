import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { SITE_URL } from "@/app/lib/brand";
import { clienteGuardado } from "@/app/lib/cliente-stripe";
import { stripe } from "@/app/lib/stripe";

// Portal de Stripe: cancelar el plan, cambiar la tarjeta y ver facturas y recibos.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const cliente = clienteGuardado(user.app_metadata);
  if (!cliente) return Response.json({ error: "Aún no tienes compras ni tarjetas guardadas." }, { status: 404 });
  const { desde } = await req.json().catch(() => ({}));
  try {
    const portal = await stripe().billingPortal.sessions.create({
      customer: cliente,
      return_url: `${SITE_URL}/${desde === "cuenta" ? "cuenta" : "creditos"}`,
    });
    return Response.json({ url: portal.url });
  } catch (e) {
    console.error("[portal]", e);
    return Response.json({ error: "No se pudo abrir la gestión de pagos." }, { status: 500 });
  }
}
