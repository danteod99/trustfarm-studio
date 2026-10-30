# TrustFarm Studio (trustfarm.online)

Web de generación de imágenes y videos con IA, en español, cobrada con créditos prepagados (Stripe).
Next.js 16 + Supabase (mismo proyecto que trustmind.online → login compartido) + Gemini API + fal.ai.

## Modelos (`app/lib/catalog.ts`, única fuente de precios)
| Modelo | Proveedor | Créditos |
|---|---|---|
| Nano Banana 2 / Pro | Gemini `gemini-3.1-flash-image` / `gemini-3-pro-image` | 3 / 4 por imagen |
| Qwen-Image | fal `fal-ai/qwen-image` | 1 por imagen |
| Veo 3.1 Lite | Gemini `veo-3.1-lite-generate-preview` | 1.25/s 720p · 1.75/s 1080p |
| Veo 3.1 Fast | Gemini `veo-3.1-fast-generate-preview` | 2.25/s 720p · 2.75/s 1080p |
| Wan 2.2 | fal `fal-ai/wan/v2.2-a14b/{text,image}-to-video` | 1.2/s 480p · 2/s 720p (5 s) |

1 crédito = US$0.10 en el paquete Inicial. Paquetes: $10/100, $25/275, $50/600, $100/1300.

## Cómo funciona
- `ai_wallets` + `ai_ledger` (supabase/schema.sql): saldo IA **separado** de `smm_balances`; lo pagado con Stripe solo se gasta en generar.
- `POST /api/generate` cobra (`ai_charge`) → lanza en el proveedor. Imágenes Gemini se resuelven en la misma request; Veo/fal quedan `running`.
- El navegador consulta `GET /api/generations/:id` cada 8 s; Vercel Cron `/api/cron/refresh` (1 vez al día, plan Hobby) cubre pestañas cerradas.
- Si falla o pasa 30 min: `failGeneration` reembolsa una sola vez (`ref = refund:<id>`).
- Stripe Checkout (pago único) → webhook `checkout.session.completed` → `ai_credit` idempotente (`ref = stripe:<session>`).
- **Formatos** (`app/lib/templates.ts`, basados en el kit Kitbase): Frutinovelas, Modelos IA y Miniseries TikTok como botones principales + Misterios, Fábulas, Datos curiosos y Finanzas. Cada uno es una receta de pasos que precarga modelo, formato y prompt; lo que va `[entre corchetes]` hay que completarlo antes de generar.
- **Personajes y estilos** (`ai_presets`, supabase/03_personajes.sql): se anteponen al prompt para mantener el mismo personaje en todas las escenas. La foto del personaje va como referencia solo a modelos de imagen; en video la imagen es el primer cuadro.
- **Animar**: cualquier imagen terminada se usa como primer cuadro de un video (`fromGeneration`, el servidor la toma del bucket). Movimientos de cámara predefinidos (`MOTIONS`).
- Admins (`ADMIN_EMAILS`) generan gratis y ven `/admin` (ventas, uso por modelo, regalar créditos).

## Puesta en marcha
1. Correr `supabase/schema.sql`, `02_servidor_local.sql` y `03_personajes.sql` en el SQL Editor de Supabase.
2. Supabase → Auth → URL Configuration: agregar `https://trustfarm.online/auth/callback` a Redirect URLs.
3. Vercel: proyecto nuevo con este repo, dominio trustfarm.online, variables de `.env.example`.
4. Stripe (cuenta LLC): webhook a `https://trustfarm.online/api/stripe/webhook` con eventos
   `checkout.session.completed` y `checkout.session.async_payment_succeeded`.
5. Probar con `sk_test_` + tarjeta 4242 antes de pasar a claves live.

## Desarrollo
`npm install` · `npm run dev` · tipos: `node node_modules/typescript/bin/tsc --noEmit`
