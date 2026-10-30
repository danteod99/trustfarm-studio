# Guía de prueba de la mini PC (TRUST Assistant)

Esta guía es para ti, dueño del negocio. Sigue los pasos en orden. En cada paso te digo qué comando usar y qué deberías ver. Si algo no sale como dice, ve a la sección 7 y anota lo que ahí se pide.

Regla de oro: **nada de dinero real hasta que tú lo decidas.** Todo el recorrido de prueba se hace con claves de prueba de Stripe (`sk_test_…`) y la tarjeta de prueba. No pegues claves ni secretos en ningún chat: se escriben solo en el panel de Vercel, Stripe o Supabase.

---

## 1. Qué se construyó y qué NO

**Ya está hecho (Fase 1):**

- La página `/minipc` con los 3 planes (Básico US$ 490, Pro US$ 790, Negocio US$ 1,290), entrega de 5 a 7 días y envíos solo a Perú.
- El pago con Stripe Checkout (pago único del equipo). Pide dirección de envío (solo Perú) y teléfono. Guarda la tarjeta con permiso del cliente para la mensualidad futura.
- El guardado del pedido cuando Stripe avisa que se pagó (sin duplicados si Stripe repite el aviso).
- `/minipc/gracias`, que ve el cliente al terminar de pagar.
- La sección "Pedidos de la mini PC" en `/admin`, donde marcas enviado (con seguimiento), entregado, cancelado o reembolsado.
- Textos legales **provisionales** en `/terminos` (sección 6) y `/reembolsos` (equipos). Están pendientes de revisión legal.
- Enlaces "Mini PC" en el encabezado y el pie, ocultos hasta que lo decidas.

**NO está hecho (Fase 2, queda para después):**

- La activación de la caja y el **cobro de la mensualidad** (suscripción). La tarjeta queda guardada, pero **hoy no se cobra nada recurrente**: la mensualidad se cobra a mano desde Stripe cuando el cliente te confirme que activó su caja.
- El flujo "Mis cajas" y la vinculación de la caja con la cuenta del cliente.
- Reembolsos automáticos: "Reembolsado" en el panel es solo una etiqueta.
- Envío con transportista o seguimiento automático: el seguimiento lo escribes tú.
- Correo de confirmación propio. El cliente recibe el recibo de Stripe (solo si lo tienes activado en Stripe).

---

## 2. Las variables y qué hace cada una

| Variable | Dónde se lee | Efecto |
|---|---|---|
| `MINIPC_VENTA_ACTIVA` | Solo servidor, **en cada petición** | `1` abre la venta. Vacía, ausente o con cualquier otro valor: el botón dice "Próximamente" y el servidor responde 503 ("Las ventas aún no están abiertas."), incluso si alguien llama a la ruta directo. |
| `NEXT_PUBLIC_MINIPC_VISIBLE` | Se fija **al compilar** | `1` muestra los enlaces "Mini PC" (encabezado y pie) y quita el `noindex` (deja que Google indexe la página). **Cambiarla exige un redeploy en Vercel.** No abre la venta: eso lo hace solo `MINIPC_VENTA_ACTIVA`. |
| `NEXT_PUBLIC_LIBRO_RECLAMACIONES_URL` | Se fija **al compilar** | El enlace al Libro de Reclamaciones aparece al pie de `/minipc`. Debe empezar por `https://`; si no, el enlace no aparece. También exige redeploy. **En Perú el Libro de Reclamaciones es obligatorio para vender en línea: es requisito antes de abrir la venta.** |
| `NEXT_PUBLIC_SITE_URL` | Se fija **al compilar** | Es a donde Stripe devuelve al cliente al terminar o cancelar (`/minipc/gracias` y `/minipc`). Si no la pones, usa `https://trustfarm.online`. En la vista previa debes ponerla con la URL de la vista previa (ver 3.3). |

Con `MINIPC_VENTA_ACTIVA` cerrada, el servidor responde 503 antes de mirar si hay sesión. Con la venta abierta: sin sesión responde 401 (la página te lleva a `/entrar?next=/minipc`) y un plan que no existe responde 400.

**El checkout no permite códigos de promoción ni cupones.** Además, una compra sin cobro (`no_payment_required`, por ejemplo con un cupón del 100 %) **no se guarda como pedido**. Por eso **no crees cupones del 100 % para probar**: usa la tarjeta de prueba y cobra el monto completo.

---

## 3. Preparar la vista previa de prueba (Vercel + Stripe)

La prueba se hace en una **vista previa de Vercel** (una copia temporal del sitio), nunca en producción. Así los créditos reales de producción no se mezclan con las pruebas.

### 3.1 Aplicar el SQL en Supabase (hazlo ANTES de abrir la venta, incluso en la vista previa)

Por qué importa: si la tabla `pedidos_minipc` no existe, **cada cobro daría error 500 en el webhook**. Stripe reintenta durante unos 3 días con un mensaje poco claro en el log, y el pedido se perdería. Por eso la tabla va primero.

Ojo: el proyecto de Supabase es **compartido con trustmind.online**. El script es idempotente y no destructivo (no borra nada, y se detiene si encuentra una tabla con ese nombre que no es de este proyecto), pero igual hazlo con calma.

1. Abre tu proyecto en el panel de Supabase e ingresa a **SQL Editor** (menú de la izquierda).
2. Abre una consulta nueva y pega SOLO esto:

   ```sql
   select to_regclass('public.pedidos_minipc');
   ```

   Pulsa **Run**. Debe mostrar **NULL** (la tabla aún no existe). **Si muestra `pedidos_minipc` u otro valor, PARA y no ejecutes nada más:** esa tabla puede ser de trustmind.online. Avísame.
3. Si dio NULL: abre el archivo `supabase/05_pedidos_minipc.sql` de este repo con un editor de texto, copia todo su contenido, pégalo en una consulta nueva del SQL Editor y pulsa **Run**. Debe terminar con "Success. No rows returned". Las claves no hacen falta aquí: el SQL Editor ya está dentro de tu sesión de Supabase.
4. Verifica pegando otra vez:

   ```sql
   select to_regclass('public.pedidos_minipc');
   ```

   Ahora debe mostrar **pedidos_minipc**.

### 3.2 Crear el endpoint de webhook de prueba en Stripe

1. Crea la vista previa de Vercel de la rama `feat/landing-minipc` y copia su URL (algo como `https://….vercel.app`).
2. En Stripe, con el **modo de prueba** activado, ve a **Desarrolladores → Webhooks → Añadir endpoint**.
3. URL del endpoint: `https://<tu-vista-previa>.vercel.app/api/stripe/webhook`
4. Eventos a escuchar, solo estos 2: `checkout.session.completed` y `checkout.session.async_payment_succeeded`.
5. Al crearlo, Stripe te muestra un **secreto de firma** (empieza por `whsec_`). Cópialo directo al paso siguiente; no lo pegues en ningún chat.

### 3.3 Variables de entorno solo de Preview en Vercel

En Vercel: **Settings → Environment Variables**, y al crear cada una marca **solo el entorno "Preview"** (no Production):

- `STRIPE_SECRET_KEY` = tu clave de prueba `sk_test_…`
- `STRIPE_WEBHOOK_SECRET` = el `whsec_…` del endpoint de prueba de arriba
- `MINIPC_VENTA_ACTIVA` = `1`
- `NEXT_PUBLIC_MINIPC_VISIBLE` = `1` (para ver los enlaces y la vista previa al compartir)
- `NEXT_PUBLIC_SITE_URL` = la URL de la vista previa (sin barra final). Sin esto, al pagar Stripe te devolvería al sitio de producción.
- `NEXT_PUBLIC_LIBRO_RECLAMACIONES_URL` = tu enlace `https://…` (opcional para probar, pero necesario para ver el enlace)
- Las demás variables que ya usa el sitio (Supabase, `ADMIN_EMAILS`, etc.) deben estar disponibles también en Preview.

Después de guardar, **haz un redeploy de la vista previa** (Deployments → los tres puntos → Redeploy). Las variables `NEXT_PUBLIC_…` no surten efecto sin recompilar. Si cambias solo `MINIPC_VENTA_ACTIVA`, basta con esperar: se lee en cada petición (aun así, el redeploy es lo más seguro la primera vez).

Cosas que pueden estorbar y que no dependen del código (anótalas si pasan): la protección de despliegues de Vercel puede bloquear las llamadas de Stripe a una vista previa (el webhook recibiría un error 401), y Supabase puede exigir que la URL de la vista previa esté en sus URLs permitidas para iniciar sesión.

---

## 4. Recorrido de prueba

Usa siempre la URL de la vista previa. Para pagar usa la tarjeta de prueba **4242 4242 4242 4242**, cualquier fecha futura, cualquier CVC de 3 dígitos. Para la dirección usa una de Perú (Checkout solo deja elegir Perú) y un teléfono inventado con formato válido.

### 4.1 Antes de abrir: la venta cerrada

Para ver este estado, quita `MINIPC_VENTA_ACTIVA` en Preview (o ponle `0`) y revisa la vista previa. Si ya la abriste, sáltate este paso y vuelve a él al final.

1. Abre `/minipc` sin iniciar sesión. Debes ver la página con los 3 planes y, en cada plan, un botón gris **"Próximamente"** que no se puede pulsar.

### 4.2 Comprar cada plan (Básico, Pro, Negocio)

Con `MINIPC_VENTA_ACTIVA=1` y la vista previa redeployada:

1. Abre `/minipc`. Si no tienes sesión y pulsas el botón de un plan, te lleva a `/entrar?next=/minipc`: inicia sesión.
2. Con sesión, pulsa el botón del plan. Debe llevarte a la página de pago de Stripe con el nombre "TRUST Assistant — Plan …", el precio exacto del plan, y los campos de dirección de envío (solo Perú) y teléfono.
3. Paga con la 4242. Debe llevarte a `/minipc/gracias`, que dice **"Recibimos tu pago"**.
4. Repite con los otros dos planes.
5. En cada compra revisa en Stripe (modo prueba, Pagos) que el monto coincide con el plan.

### 4.3 Ver el pedido en el panel

1. Entra a `/admin` con una cuenta que esté en `ADMIN_EMAILS`. Si no es admin, la página aparece como "no encontrada": es lo normal.
2. Busca la sección **"Pedidos de la mini PC"**. Por cada compra debe haber una fila con: estado **Pagado** (azul), el plan, el monto en US$, la fecha, y los datos nombre, teléfono, dirección, ciudad/región/país, email y el id de pago de Stripe.
3. Si hay un pedido en **rojo (Revisar)**, lee el motivo que aparece debajo: significa que algo no cuadró. Ver la tabla de estados en 4.7.

### 4.4 Prueba de duplicados (el evento reenviado no crea un segundo pedido)

Stripe a veces repite el aviso. El sistema debe reconocerlo y no crear otro pedido.

1. En Stripe (modo prueba): **Desarrolladores → Eventos** (o Webhooks → tu endpoint → pestaña de eventos).
2. Abre un evento `checkout.session.completed` de una de tus compras de prueba.
3. Pulsa **Reenviar** (resend) hacia tu endpoint.
4. Esperado: Stripe muestra respuesta **200**. En `/admin` (recarga la página) **sigue habiendo un solo pedido** por esa compra, no dos.

### 4.5 Prueba de dirección fuera de Perú: limitaciones

Esto **no se puede provocar desde la página**, porque Checkout solo deja elegir Perú. Por eso el estado **Revisar** no se alcanza con una compra normal. El sistema pone un pedido en Revisar cuando: el país no es Perú, falta el teléfono o la dirección, el monto no coincide con el del plan, la moneda no es USD, el plan es desconocido o inactivo, o falta el usuario. En la práctica, con el checkout actual, casi todos son casos imposibles: son una red de seguridad.

Hay pruebas automáticas que cubren estos casos (`npm test`). Desde la vista previa **no existe una forma segura de provocarlo sin tocar el código**, y no te voy a inventar un truco. Si quieres verlo igual (opcional, para alguien con experiencia): Stripe CLI o Workbench pueden enviar a tu endpoint un evento `checkout.session.completed` de prueba hecho a mano, pero tendría que llevar `metadata.kind = minipc`, `payment_status = paid` y una firma válida con tu secreto de webhook. Un evento armado así es delicado de hacer bien; si no tienes a quien lo haga, confía en las pruebas automáticas.

### 4.6 Marcar enviado con seguimiento, y entregado

1. En `/admin`, en un pedido **Pagado**, escribe un seguimiento en el campo (por ejemplo `OLVA-123456`; máximo 120 caracteres; es opcional).
2. Pulsa **Marcar enviado**, luego **Sí, confirmar**. El estado pasa a **Enviado** (ámbar) y se ve el seguimiento.
3. Pulsa **Marcar entregado**, luego **Sí, confirmar**. Pasa a **Entregado** (verde).

### 4.7 Qué significa cada estado

| Estado | Significado | Cambios posibles desde aquí |
|---|---|---|
| `pagado` | Pago confirmado, datos completos, todo cuadra. | enviado, cancelado, reembolsado |
| `revisar` (rojo, con nota) | El pago llegó pero algo no cuadra: país distinto de Perú, sin teléfono o dirección, monto distinto, plan o usuario desconocido, moneda distinta, plan inactivo. El pedido se guarda igual; léelo antes de enviar. | pagado, enviado, cancelado, reembolsado (el panel solo ofrece enviado, cancelado y reembolsado) |
| `enviado` | Ya lo despachaste (con seguimiento si lo escribiste). | entregado, reembolsado |
| `entregado` | El cliente lo recibió. | reembolsado |
| `cancelado` | Terminal: no se puede cambiar más. **No devuelve el dinero.** | ninguno |
| `reembolsado` | Terminal: no se puede cambiar más. **Es solo una etiqueta**: el dinero lo devuelves tú a mano en Stripe. | ninguno |

Importante: **"Cancelar" tampoco devuelve el dinero y es final**: después no se puede pasar a Reembolsado. Si vas a cancelar y devolver, devuelve el dinero en Stripe y marca **Reembolsado** (no Cancelar). El panel pide confirmación antes de cada cambio y los cambios imposibles (por ejemplo, de Entregado a Pagado) se rechazan.

### 4.8 Comprobar que los créditos siguen funcionando (y no se mezclan)

1. Entra a `/creditos` con sesión y compra un paquete de créditos con la tarjeta 4242. Debe llevarte de vuelta a `/creditos?pago=ok` y los créditos aparecen en tu saldo.
2. Revisa `/admin`: esa compra de créditos **no debe aparecer** como pedido de mini PC.
3. A la inversa: las compras de mini PC de arriba **no deben haber sumado créditos** a tu saldo.

(Esto también necesita `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` de prueba en Preview, que ya pusiste en 3.3: el mismo endpoint atiende los dos tipos de compra.)

---

## 5. Pantallas a revisar (en escritorio y a 390 px)

Para ver a 390 px: en Chrome o Edge abre la página, pulsa F12 (DevTools), pulsa el ícono del celular (modo dispositivo, Ctrl+Shift+M) y en la barra de arriba pon ancho **390**. Recarga.

| Pantalla | Qué debe verse |
|---|---|
| `/minipc` sin sesión y con la venta cerrada | Página completa y botones "Próximamente" desactivados. |
| `/minipc` con la venta abierta y con sesión | Botones de compra activos; al pulsar te llevan al pago de Stripe. |
| `/minipc/gracias` | "Recibimos tu pago" y la entrega estimada de 5 a 7 días. |
| `/terminos`, sección 6 "Compra de equipos TRUST Assistant" | Texto marcado "provisional: pendiente de revisión legal". |
| `/reembolsos`, sección "Equipos mini PC" | Igual, texto provisional. |
| `/admin` | La sección "Pedidos de la mini PC" con los pedidos y sus botones. |
| Enlaces "Mini PC" | Con `NEXT_PUBLIC_MINIPC_VISIBLE=1`: en el encabezado (**se oculta en pantallas pequeñas**) y en el pie (en el celular se ve el del pie). Sin la variable no aparece ninguno. |
| Pie de `/minipc` | El enlace al Libro de Reclamaciones, solo si pusiste la URL con `https://`. |
| Vista previa al compartir el enlace | Pega la URL en WhatsApp o en el depurador de Facebook (developers.facebook.com/tools/debug). Debe salir título, descripción y la foto del equipo. **Solo funciona con `NEXT_PUBLIC_MINIPC_VISIBLE=1`** (de lo contrario la página lleva `noindex`). |

---

## 6. Abrir la venta en producción

Esto es un acto tuyo, explícito. No lo hagas hasta que esta lista esté completa. Viene de la tabla de brechas del diseño aprobado.

**Antes de abrir la venta, el producto y el negocio deben cumplir lo que promete la página:**

- [ ] **La IA incluida en la mensualidad no está hecha hoy**: el cliente tiene que poner su propia clave. O se construye (o tú pones tu clave en cada caja, con el costo de IA por tu cuenta, que aún no está medido), o se cambia el texto de la página.
- [ ] **Probar el plan Básico (Intel N150, 12 GB) en un equipo real.** Hasta hoy solo se midió en un Ryzen 5 6600H.
- [ ] **Probar la conexión real de WhatsApp** (API oficial de Meta) con un número real. Nunca se ha probado.
- [ ] **Servicios humanos definidos**: quién instala y configura cada caja, quién da la capacitación (plan Negocio) y el soporte, y en cuánto tiempo, para que los 5 a 7 días sean reales.
- [ ] **Cloudflare y el dominio de las cajas reales** funcionando (subidas de video grandes por túnel sin confirmar).
- [ ] **Política de devolución definida por ti y publicada.** Los textos de `/terminos` y `/reembolsos` son **provisionales**, pendientes de revisión legal.
- [ ] **Costos de envío**: hoy el envío va incluido en el precio y solo a Perú. Confirma que te sale a cuenta.
- [ ] **Quién prepara y despacha las cajas.**
- [ ] **Libro de Reclamaciones** publicado y su URL (con `https://`) en `NEXT_PUBLIC_LIBRO_RECLAMACIONES_URL`.
- [ ] Aplicado el SQL `05_pedidos_minipc.sql` también en el Supabase de producción (verificación previa y posterior de 3.1; recuerda que es el proyecto compartido con trustmind.online).

**Claves y variables en Producción:**

1. En Stripe (modo real): tu clave real `sk_live_…` en `STRIPE_SECRET_KEY` (entorno Production en Vercel).
2. Crea un endpoint de webhook de producción: `https://trustfarm.online/api/stripe/webhook` con los 2 eventos (`checkout.session.completed` y `checkout.session.async_payment_succeeded`). Su `whsec_…` propio va en `STRIPE_WEBHOOK_SECRET` de Production (distinto al de prueba).
3. Pon `NEXT_PUBLIC_MINIPC_VISIBLE=1` y `NEXT_PUBLIC_LIBRO_RECLAMACIONES_URL`, luego `MINIPC_VENTA_ACTIVA=1`.
4. **Haz redeploy** (las dos variables `NEXT_PUBLIC_…` lo exigen).
5. Haz una compra real pequeña contigo mismo si lo decides, y reembólsala a mano en Stripe, para confirmar el recorrido completo en producción.

**Cerrar la venta:** quita `MINIPC_VENTA_ACTIVA` (o ponla en cualquier valor distinto de `1`). El botón vuelve a "Próximamente" y el servidor devuelve 503. Ojo: **las sesiones de Checkout que ya se crearon siguen siendo pagables hasta 24 horas**. Si hace falta, expíralas a mano en Stripe (Pagos → sesiones de Checkout).

---

## 7. Si algo falla, qué anotar

Anota esto y mándamelo:

- Una **captura de pantalla** de lo que viste.
- La **hora** exacta (con zona horaria) en que pasó.
- La **URL** de la página.
- El **id del pedido** (en `/admin`) o el id de la sesión/pago de Stripe (empieza por `cs_` o `pi_`), si hay.
- Qué paso de esta guía estabas haciendo.

**Nunca pegues claves (`sk_…`, `whsec_…`, claves de Supabase) ni el secreto del webhook en el chat, ni en capturas.** Si por error se vio alguna, rótala (genérala de nuevo) en Stripe/Supabase.
