import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { clienteGuardado } from "@/app/lib/cliente-stripe";
import { stripe } from "@/app/lib/stripe";

const ajeno = () => Response.json({ error: "Tarjeta no encontrada." }, { status: 404 });

async function propia(id: string) {
  const user = await getUser();
  if (!user) return { error: UNAUTHORIZED() };
  const cliente = clienteGuardado(user.app_metadata);
  if (!cliente || !id.startsWith("pm_")) return { error: ajeno() };
  const pm = await stripe().paymentMethods.retrieve(id).catch(() => null);
  const dueño = typeof pm?.customer === "string" ? pm.customer : pm?.customer?.id;
  // Solo se tocan tarjetas del propio cliente.
  if (!pm || dueño !== cliente) return { error: ajeno() };
  return { cliente, pm };
}

/** Marca la tarjeta como principal. */
export async function PATCH(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await propia(id);
  if ("error" in r) return r.error;
  await stripe().customers.update(r.cliente, { invoice_settings: { default_payment_method: id } });
  return Response.json({ ok: true });
}

/** Quita la tarjeta (la desvincula del cliente en Stripe). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await propia(id);
  if ("error" in r) return r.error;
  try {
    await stripe().paymentMethods.detach(id);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[tarjetas] quitar", e);
    return Response.json({ error: "No se pudo quitar la tarjeta." }, { status: 500 });
  }
}
