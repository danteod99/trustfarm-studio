import type { User } from "@supabase/supabase-js";
import { stripe } from "@/app/lib/stripe";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { clienteGuardado } from "@/app/lib/tarjetas";

export { clienteGuardado };

// Un solo cliente de Stripe por usuario, para que las tarjetas guardadas sirvan en paquetes, plan y
// "Mi cuenta". Se guarda en auth.users.app_metadata.stripe_customer (solo lo escribe el servidor).
// Quien ya tenía plan mensual reutiliza el cliente de su suscripción.

/** Devuelve el cliente de Stripe del usuario; si no tiene, lo crea y lo guarda. */
export async function clienteStripe(user: User): Promise<string> {
  const ya = clienteGuardado(user.app_metadata);
  if (ya) return ya;
  const c = await stripe().customers.create(
    { email: user.email ?? undefined, metadata: { user_id: user.id } },
    // Dos pestañas a la vez no crean dos clientes.
    { idempotencyKey: `cliente-${user.id}` }
  );
  const db = supabaseAdmin();
  const { data } = await db.auth.admin.getUserById(user.id);
  const { error } = await db.auth.admin.updateUserById(user.id, {
    app_metadata: { ...(data.user?.app_metadata ?? user.app_metadata), stripe_customer: c.id },
  });
  if (error) console.error("[cliente-stripe] no se guardó", user.id, error.message);
  return c.id;
}
