# Modo Granja — diseño (aprobado por Dante 04-11-2026)

## Por qué

Higgsfield y los demás generadores hacen **un** video a la vez. Los clientes de Dante tienen granjas
de bots (50 a 1.000 cuentas) y necesitan contenido **distinto para cada cuenta, todos los días**.
Generar 100 videos 100 % IA cuesta ~10 créditos c/u (~$100/día): nadie lo paga. El diferencial es
juntar la IA con las herramientas de edición de TrustMind (Multiediting ya hace variaciones únicas
en el navegador, sin costo de servidor).

Mensaje: *«Higgsfield te hace un video. TrustFarm te hace 100 videos distintos, uno para cada cuenta
de tu granja, todos los días.»*

## Decisiones de Dante

- Herramientas de edición: **copiarlas** de trustmind.online (repo Farmmind, `app/app/*`) a
  trustfarm.online, cobradas con créditos TrustFarm. TrustMind conserva las suyas.
- Modo Granja arranca con **Multiplicar** (1–5 videos IA base → N versiones únicas). «Único total»
  (una generación IA por cuenta) queda para una fase posterior.

## Piezas

### 1. Editar (`/editar`) — fase A
Tres herramientas copiadas de Farmmind (`~/Desktop/Software & Proyectos/Softwares/farmmind`):
- **Editor de cortos** (`app/app/editor/page.tsx`): corta silencios y retomas, subtítulos karaoke,
  iguala volumen. ffmpeg.wasm en el navegador + transcripción Groq + retomas con Claude.
- **Multiediting** (`app/app/multiediting/page.tsx`): N variaciones (color, brillo, contraste,
  saturación, gamma, tono, volumen) para evitar contenido duplicado. 100 % navegador.
- **Multiclipping** (`app/app/clips/page.tsx`): video largo → clips, vía el servicio Railway
  `trustclip` (env `TRUSTCLIP_ORIGIN`, tabla `clip_jobs`, bucket `clips` en el MISMO Supabase).
- ffmpeg.wasm self-hosted en `public/ffmpeg/` (core + core-mt). Los headers COOP/COEP para
  multihilo SOLO en las rutas `/editar/*` (no romper Stripe, imágenes ni el resto).
- Cobro con `chargeCredits` de TrustFarm (precios en créditos, a definir junto a las acciones IA:
  transcripción, retomas, análisis de clips). Lo que corre 100 % en el navegador es gratis.
- Motor de video del navegador en un módulo compartido (p. ej. `app/lib/video/`) para que Modo Granja
  lo reuse.

### 2. Mis cuentas + Modo Granja «Multiplicar» (`/granja`) — fase B
- **Mis cuentas**: tabla nueva (`supabase/13_granja.sql`): cuentas de la granja del usuario
  (nombre/handle, red: tiktok|instagram|facebook|youtube, personaje opcional = `ai_presets.id`,
  notas). Alta masiva pegando una lista.
- **Multiplicar**: el usuario elige 1–5 videos base (de su galería o subidos), elige cuentas
  (o «todas») y cuántos por cuenta. Claude escribe un **gancho/texto distinto por cuenta** (sobre el
  tema que indique). En el navegador, con el motor de Multiediting, cada salida combina: video base
  rotado, perfil de color distinto, recorte/zoom leve, velocidad ±3 %, texto del gancho quemado,
  volumen distinto, metadatos limpios. Ningún archivo idéntico a otro.
- Salida: ZIP con una carpeta por cuenta (`@cuenta/video-01.mp4` + `caption.txt`), listo para el
  multiposting de TrustFarm/TrustMind. Envío automático a los celulares: fase futura.
- Cobro: los ganchos de Claude cobran créditos por lote (barato); el render es en el navegador.

### 3. Landing `/granjas` — fase C
«Contenido para cada cuenta de tu granja». Hero con el mensaje, demo visual 1 → 100, comparativa
con «generadores normales» (sin nombrar marcas en ataques; se puede decir «a diferencia de los
generadores de un video a la vez»), cómo funciona en 3 pasos, herramientas incluidas (Editar),
ejemplos de granjas (estilo virales: muchos iPhones, luz azul/cian, de noche), precios, CTA a
registrarse/comprar créditos y WhatsApp. Bloque en la portada y enlace en el menú.

### 4. Plan Granja y «Único total» — fase D (pendiente de números de Dante)

## Orden
A (Editar) → B (Mis cuentas + Multiplicar, reusa el motor de A) → C (landing con ejemplos reales)
→ D. C puede avanzar en paralelo a A/B con capturas al final.
