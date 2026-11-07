// Plantillas por formato (basadas en el "Kit Canales sin rostro con IA" de Kitbase).
// Cada formato es una receta de pasos: crear el personaje → escenas → animar → portada.
// Lo que va [entre corchetes] lo completa el usuario; el estudio no deja generar hasta
// que no quede ningún corchete.
import type { Aspect, Kind } from "@/app/lib/catalog";
import { FOTO_LATAM } from "@/app/lib/plantilla-foto-latam";
import { NEGATIVOS_BASE, trustPrompt, type TrustParams } from "@/app/lib/trust-params";

export interface TemplateStep {
  id: string;
  title: string;
  kind: Kind;
  model: string;
  aspect: Aspect;
  duration?: number;
  prompt: string;
  /** Consejo corto que se muestra debajo del paso. */
  tip?: string;
  /** Sugerir guardar el resultado como personaje. */
  saveAsCharacter?: boolean;
  /** Movimiento de cámara sugerido (id de MOTIONS). */
  motion?: string;
}

export interface TemplateGroup {
  id: string;
  emoji: string;
  name: string;
  pitch: string;
  /** Formatos principales salen como botones grandes; el resto en "Más formatos". */
  featured?: boolean;
  /** Estilo base sugerido para guardar como estilo del canal. */
  style?: { name: string; description: string };
  /** Estilos extra sugeridos (p. ej. géneros): cada uno se puede guardar como estilo. */
  extraStyles?: { name: string; description: string }[];
  /** Aviso corto que se muestra bajo el formato (p. ej. «es ficción»). */
  notice?: string;
  steps: TemplateStep[];
}

/** Paso construido desde los parámetros Trust: el prompt se adapta al modelo del paso. */
function paso(base: Omit<TemplateStep, "prompt">, params: TrustParams): TemplateStep {
  return {
    ...base,
    prompt: trustPrompt(
      { aspecto: base.aspect, duracion: base.duration, negativos: NEGATIVOS_BASE, ...params },
      base.model
    ),
  };
}

export const TEMPLATES: TemplateGroup[] = [
  {
    id: "frutinovelas",
    emoji: "🍓",
    name: "Frutinovelas",
    pitch: "Telenovelas cortas con frutas que actúan como personas. Cada capítulo termina en suspenso.",
    featured: true,
    style: {
      name: "Frutinovela 3D",
      description:
        "animación 3D cinematográfica estilo película animada, frutas con rasgos humanos (ojos grandes expresivos, boca, brazos y piernas), iluminación cálida dramática, colores saturados, drama de telenovela",
    },
    extraStyles: [
      {
        name: "Frutinovela: venganza",
        description:
          "animación 3D cinematográfica, frutas con rasgos humanos, ambiente de telenovela de venganza: luz roja y sombras largas, miradas frías, sonrisas calculadoras, tono de suspenso elegante, sin violencia gráfica",
      },
      {
        name: "Frutinovela: familia",
        description:
          "animación 3D cinematográfica, frutas con rasgos humanos, drama familiar de telenovela: cocina o sala cálida, luz dorada de tarde, abuelas y tíos chismosos, secretos de familia, tono entre tierno y cómico",
      },
      {
        name: "Frutinovela: romance",
        description:
          "animación 3D cinematográfica, frutas con rasgos humanos, romance de telenovela: colores pastel y rosados, luz de atardecer, bokeh de luces, miradas tiernas, música romántica, tono dulce",
      },
    ],
    steps: [
      {
        id: "personaje",
        title: "1. Crea tu personaje",
        kind: "image",
        model: "nano-banana-pro",
        aspect: "9:16",
        prompt:
          "Retrato de cuerpo entero de [fruta: una fresa / un plátano / una palta] con rasgos humanos llamada [nombre], [personalidad: la protagonista romántica / el villano celoso / la suegra chismosa]. Lleva [ropa fija: vestido rojo y aretes dorados]. Fondo neutro de estudio, mirando a cámara, expresión [emoción]. Sin texto en la imagen.",
        tip: "Cuando te guste, toca «Usar como personaje» en la imagen. Así sale igual en todos los capítulos.",
        saveAsCharacter: true,
      },
      {
        id: "escena",
        title: "2. Escena del capítulo",
        kind: "image",
        model: "nano-banana-2",
        aspect: "9:16",
        prompt:
          "El personaje en [lugar: una heladería / el mercado / la cocina de la casa], [acción y emoción concreta: llorando mientras lee un mensaje en el celular]. Plano [medio / primer plano], iluminación dramática de telenovela. Sin texto en la imagen.",
        tip: "Elige tu personaje arriba. Haz una imagen por escena (8 a 10 por capítulo).",
      },
      {
        id: "animar",
        title: "3. Anima la escena con diálogo",
        kind: "video",
        model: "veo-fast",
        aspect: "9:16",
        duration: 8,
        prompt:
          "El personaje [acción: se da la vuelta lentamente hacia la cámara] y dice con voz dramática: «[diálogo corto, máximo 12 palabras]». Música de suspenso de telenovela de fondo. Sin subtítulos ni texto en pantalla.",
        tip: "Mejor: toca «Animar» en la imagen de la escena para usarla como primer cuadro.",
        motion: "acercamiento",
      },
      {
        id: "portada",
        title: "4. Portada del capítulo",
        kind: "image",
        model: "nano-banana-pro",
        aspect: "9:16",
        prompt:
          "Portada de TikTok de telenovela: el personaje con expresión de [sorpresa / traición / furia] en primer plano. Texto grande arriba: «[título de máximo 4 palabras]» y abajo la etiqueta «CAPÍTULO [número]». Colores dominantes [color 1] y [color 2]. Que dé ganas de ver el video sin revelar el giro.",
      },
      {
        id: "rival",
        title: "5. Extra: el villano o la rival",
        kind: "image",
        model: "nano-banana-2",
        aspect: "9:16",
        prompt:
          "Retrato de cuerpo entero de [fruta: una piña / un mango / un limón] con rasgos humanos llamada [nombre], [papel: la rival elegante / el galán traicionero / la suegra chismosa]. Lleva [ropa fija: vestido negro, gafas de sol y labial rojo]. Sonrisa maliciosa, mirando de reojo a cámara. Fondo [lugar: salón de baile / oficina lujosa]. Animación 3D cinematográfica. Sin humanos ni texto.",
        tip: "Ejemplo real: una piña con gafas de sol que entra a la boda. Guárdala también como personaje para que vuelva en todos los capítulos.",
        saveAsCharacter: true,
      },
      {
        id: "dialogo-pareja",
        title: "6. Extra: discusión de pareja",
        kind: "video",
        model: "veo-fast",
        aspect: "9:16",
        duration: 8,
        prompt:
          "Dos frutas con rasgos humanos, [fruta 1] y [fruta 2], discuten en [lugar: la sala de su casa]. La primera dice con voz dolida: «[reclamo de máximo 10 palabras]» y la segunda responde con voz fría: «[respuesta corta]». Música de suspenso de telenovela. Sin subtítulos ni texto en pantalla.",
        tip: "Dos voces distintas en el mismo clip: escribe quién habla y con qué tono. Ejemplo: «¿Tú sabías que él me mintió?».",
        motion: "fija",
      },
    ],
  },
  {
    id: "modelos",
    emoji: "👩",
    name: "Modelos IA",
    pitch: "Una creadora o creador virtual con la misma cara en cada foto y video, para marcas y afiliados.",
    featured: true,
    style: {
      name: "Foto de celular natural",
      description:
        "foto vertical de celular realista tomada por una amiga, luz natural, piel real con textura, sin filtros exagerados ni piel de plástico",
    },
    steps: [
      {
        id: "ficha",
        title: "1. Crea a tu modelo",
        kind: "image",
        model: "nano-banana-pro",
        aspect: "9:16",
        prompt:
          "Foto realista de celular de una [mujer / hombre] de [edad aparente] años, [forma de cara], ojos [color y forma], cejas [tipo], cabello [color, largo y peinado], [rasgo único: lunar sobre el labio / pecas], contextura [tipo de cuerpo]. Viste [estilo de ropa]. Fondo [lugar], luz natural, mirando a cámara con expresión [emoción]. Sin texto.",
        tip: "Sé muy concreto con los rasgos. Cuando te guste, toca «Usar como personaje» para que tenga siempre la misma cara.",
        saveAsCharacter: true,
      },
      {
        id: "fotos",
        title: "2. Set de fotos",
        kind: "image",
        model: "nano-banana-2",
        aspect: "9:16",
        prompt:
          "La modelo en [lugar: una cafetería de Miraflores / su cuarto / el gimnasio], vistiendo [outfit], [pose: sentada con el celular en la mano / caminando de espaldas mirando sobre el hombro]. Foto de celular natural, como si la hubiera tomado una amiga. Misma cara y cabello. Sin texto.",
        tip: "Elige a tu modelo arriba en «Personaje». Varía lugar, ropa y pose; nunca la cara.",
      },
      {
        id: "producto",
        title: "3. Foto con producto",
        kind: "image",
        model: "nano-banana-pro",
        aspect: "9:16",
        prompt:
          "La modelo sosteniendo [producto, con su color y forma real] junto a su cara, sonriendo, en [lugar]. El producto se ve nítido y con su etiqueta. Luz natural de ventana. Sin texto extra.",
        tip: "Sube la foto real del producto como imagen de referencia. No le hagas decir que usó algo que nadie probó.",
      },
      {
        id: "hablando",
        title: "4. Video hablando a cámara",
        kind: "video",
        model: "veo-fast",
        aspect: "9:16",
        duration: 8,
        prompt:
          "La modelo habla a la cámara frontal del celular, gesticulando con una mano, movimiento natural de cabeza, y dice en español latino con tono cercano: «[guion de máximo 20 palabras]». Encuadre de medio cuerpo, video casero realista. Sin subtítulos.",
        tip: "Toca «Animar» en una de sus fotos para que sea la misma cara. Marca la cuenta como creadora virtual con IA.",
        motion: "fija",
      },
      {
        id: "espejo",
        title: "5. Extra: selfie en el espejo (gym / probador)",
        kind: "image",
        model: "nano-banana-2",
        aspect: "9:16",
        prompt:
          "La modelo se toma una selfie en el espejo de [lugar: un gimnasio moderno / un probador de tienda] con el celular, vistiendo [outfit]. Misma cara y cabello. Luz del lugar, foto de celular natural, piel real. Sin texto.",
        tip: "Ejemplo real: creadora fitness en un gimnasio de Lima. Ideal para ropa deportiva y tiendas de moda.",
      },
      {
        id: "unboxing",
        title: "6. Extra: unboxing hablado",
        kind: "video",
        model: "veo-fast",
        aspect: "9:16",
        duration: 8,
        prompt:
          "La modelo abre una caja de cartón en el sofá de su sala y dice en español latino con voz emocionada: «[reacción corta de máximo 15 palabras]». Cámara de celular en mano, luz natural, sonido ambiente de casa y del cartón. Sin subtítulos.",
        tip: "Ejemplo: «Por fin llegó mi pedido, miren cómo vino». Muestra el producto real; no inventes resultados.",
        motion: "fija",
      },
    ],
  },
  {
    id: "miniseries",
    emoji: "🎬",
    name: "Miniseries TikTok",
    pitch: "Series por capítulos con personajes fijos: gancho en el segundo 1 y final que obliga a ver el siguiente.",
    featured: true,
    style: {
      name: "Serie cinematográfica",
      description:
        "cinematográfico realista, lente anamórfico, color grade de serie de streaming, contraste alto, luz motivada, grano de película sutil",
    },
    steps: [
      {
        id: "protagonista",
        title: "1. Protagonista",
        kind: "image",
        model: "nano-banana-pro",
        aspect: "9:16",
        prompt:
          "Retrato cinematográfico de [personaje: una enfermera de 30 años / un taxista limeño / una estudiante], [rasgos físicos concretos], vestido con [ropa fija]. Fondo [lugar de la serie], expresión [emoción]. Sin texto.",
        tip: "Haz uno por personaje (protagonista, antagonista, aliado) y guárdalos con «Usar como personaje».",
        saveAsCharacter: true,
      },
      {
        id: "gancho",
        title: "2. Escena gancho (primer segundo)",
        kind: "video",
        model: "veo-fast",
        aspect: "9:16",
        duration: 8,
        prompt:
          "Plano en medio de la acción, sin introducción: el personaje [acción impactante: abre una puerta y se queda congelado / encuentra un sobre con su nombre]. Dice en voz baja: «[frase que genere una pregunta]». Sonido ambiente tenso. Sin subtítulos.",
        tip: "Empieza siempre en medio del conflicto. Nada de presentaciones.",
        motion: "acercamiento",
      },
      {
        id: "escena",
        title: "3. Escena de desarrollo",
        kind: "video",
        model: "veo-lite",
        aspect: "9:16",
        duration: 8,
        prompt:
          "[Lugar], [hora del día]. El personaje [acción] mientras [otro personaje o detalle]. Diálogo: «[línea corta]». Cámara [movimiento]. Sin subtítulos.",
        tip: "Trust Cine Lite cuesta menos: úsalo para las escenas de relleno y Trust Cine para el gancho y el final.",
      },
      {
        id: "cliffhanger",
        title: "4. Final en suspenso",
        kind: "video",
        model: "veo-fast",
        aspect: "9:16",
        duration: 8,
        prompt:
          "El personaje recibe [la revelación: una llamada / ve a alguien que creía muerto] y su cara cambia por completo. Corte en el momento exacto de la reacción. Música que sube y se corta de golpe. Sin subtítulos.",
        tip: "Corta antes de la respuesta. Escribe «Parte [número]» en la portada para que sigan la cuenta.",
        motion: "acercamiento",
      },
      {
        id: "espacio-cerrado",
        title: "5. Extra: tensión en un espacio cerrado",
        kind: "video",
        model: "veo-lite",
        aspect: "9:16",
        duration: 8,
        prompt:
          "Dentro de [espacio cerrado: un ascensor antiguo / un taxi de noche / un pasillo de hospital vacío], el personaje [acción: presiona un botón y la luz parpadea]. Una voz susurra: «[amenaza o pista corta]». Zumbido eléctrico, sin música. Sin subtítulos.",
        tip: "Ejemplo: ascensor del piso 13 con una voz por el parlante. Un solo lugar abarata la serie y mantiene la tensión.",
      },
      {
        id: "portada-serie",
        title: "6. Extra: portada con «Parte 2»",
        kind: "image",
        model: "nano-banana-pro",
        aspect: "9:16",
        prompt:
          "Portada de TikTok de miniserie de suspenso: primer plano del personaje con expresión de [miedo / sorpresa], luces de neón [colores] reflejadas en la cara. Texto grande arriba: «[pregunta de máximo 4 palabras]» y abajo la etiqueta «PARTE [número]». Estilo cinematográfico, contraste alto.",
        tip: "Una pregunta + el número de parte retiene a quien ya te sigue. Ejemplo: «¿QUIÉN LO ENVIÓ?».",
      },
    ],
  },
  FOTO_LATAM,
  {
    id: "anime",
    emoji: "🌸",
    name: "Anime novela",
    pitch: "Drama romántico o de misterio en estilo anime, con el mismo personaje en cada capítulo.",
    style: {
      name: "Anime novela",
      description:
        "ilustración anime original de drama, ojos grandes expresivos, líneas limpias, colores suaves con acentos vivos, fondos pintados a mano, luz de atardecer, composición cinematográfica",
    },
    steps: [
      paso(
        { id: "personaje", title: "1. Crea tu protagonista", kind: "image", model: "nano-banana-pro", aspect: "9:16",
          tip: "Estilo anime propio: describe rasgos, pelo y ropa fija. Toca «Usar como personaje» para que salga igual en todos los capítulos.",
          saveAsCharacter: true },
        {
          estilo: "ilustración anime original de drama, líneas limpias, colores suaves",
          personaje: "[personaje: una estudiante de 17 años / un joven músico] llamado [nombre], pelo [color y peinado], ojos [color], ropa fija [uniforme azul con lazo rojo]",
          escena: "retrato de cuerpo entero sobre fondo neutro, expresión [emoción]",
          luz: "suave de estudio",
          negativos: ["texto", "personajes de series conocidas"],
        }
      ),
      paso(
        { id: "escena", title: "2. Escena del capítulo", kind: "image", model: "nano-banana-2", aspect: "9:16",
          tip: "Una imagen por escena. Mantén el mismo estilo guardado y cambia solo lugar, pose y emoción." },
        {
          estilo: "ilustración anime original de drama, fondo pintado a mano",
          personaje: "la protagonista elegida arriba",
          escena: "[lugar: azotea de la escuela / estación de tren bajo la lluvia] y [acción: mira un mensaje en el celular con lágrimas]",
          camara: "[plano medio / primer plano]",
          luz: "[atardecer dorado / luz de neón nocturna]",
        }
      ),
      paso(
        { id: "animar", title: "3. Anima la escena", kind: "video", model: "veo-fast", aspect: "9:16", duration: 8, motion: "acercamiento",
          tip: "Toca «Animar» en la imagen de la escena. Movimientos simples (pelo al viento, parpadeo, lluvia) se ven más anime." },
        {
          estilo: "animación anime original de drama",
          personaje: "la protagonista",
          escena: "[acción: levanta la mirada, el viento mueve su pelo]",
          camara: "acercamiento lento",
          audio: { dialogo: "dice en voz suave: «[frase corta, máximo 10 palabras]».", ambiente: "[lluvia suave]", musica: "piano melancólico" },
          conReferencia: true,
        }
      ),
      paso(
        { id: "portada", title: "4. Portada del capítulo", kind: "image", model: "nano-banana-pro", aspect: "9:16",
          tip: "Título de máximo 4 palabras y un solo rostro en primer plano." },
        {
          estilo: "portada de serie anime original, colores [color 1] y [color 2]",
          personaje: "la protagonista con expresión de [sorpresa / tristeza]",
          escena: "texto grande arriba: «[título de máximo 4 palabras]» y abajo la etiqueta «EPISODIO [número]»",
          camara: "primer plano",
          negativos: ["marcas de agua", "logos", "personajes de series conocidas"],
        }
      ),
    ],
  },
  {
    id: "what-if",
    emoji: "🌀",
    name: "Historias ficticias / What if",
    pitch: "«¿Qué pasaría si...?»: escenarios imaginarios con imágenes de ambiente que cobran vida.",
    notice: "Es ficción: pon «Historia ficticia hecha con IA» en el video y no lo presentes como noticia ni hecho real.",
    style: {
      name: "Qué pasaría si",
      description:
        "cinematográfico realista de ciencia ficción suave, paleta fría con un acento cálido, atmósfera de documental imaginario, sin personas reconocibles, sin sangre",
    },
    steps: [
      paso(
        { id: "ambiente", title: "1. Imagen de ambiente", kind: "image", model: "nano-banana-2", aspect: "9:16",
          tip: "Parte de una pregunta: «¿Qué pasaría si [premisa]?». Una imagen potente por escena." },
        {
          estilo: "cinematográfico realista de ciencia ficción suave",
          escena: "[escena de la premisa: Lima de noche con el mar subiendo hasta la Costa Verde]",
          camara: "plano general amplio",
          luz: "[luz de luna fría / amanecer anaranjado]",
          negativos: ["personas reconocibles", "logos de medios o noticias", "sangre"],
        }
      ),
      paso(
        { id: "animar", title: "2. Dale vida", kind: "video", model: "wan-14b", aspect: "9:16", duration: 5, motion: "acercamiento",
          tip: "Toca «Animar» en la imagen. La narración («¿Qué pasaría si...?») la pones tú encima, con tu voz." },
        {
          escena: "[lo que se ve en la imagen], movimiento lento y atmosférico",
          estilo: "cinematográfico realista",
          camara: "acercamiento muy lento",
        }
      ),
    ],
  },
  {
    id: "misterios",
    emoji: "🕯️",
    name: "Misterios",
    pitch: "Leyendas y enigmas narrados con imágenes de ambiente. Separa lo documentado de la leyenda.",
    style: {
      name: "Misterio oscuro",
      description:
        "cinematográfico oscuro y realista, paleta fría de azules y grises con un solo punto de luz cálida, niebla ligera, grano de película sutil, sin personas reconocibles, sin sangre",
    },
    steps: [
      {
        id: "ambiente",
        title: "1. Imagen de ambiente",
        kind: "image",
        model: "nano-banana-2",
        aspect: "9:16",
        prompt: "[Escena: casona colonial en una esquina del centro de Lima de noche, calle mojada, un solo farol encendido]. Debe generar tensión sin ser grotesca. Sin texto.",
        tip: "Guarda el estilo del canal y úsalo en todas las escenas para que se vean del mismo canal.",
      },
      {
        id: "animar",
        title: "2. Movimiento lento",
        kind: "video",
        model: "wan-14b",
        aspect: "9:16",
        duration: 5,
        prompt: "[Lo que se ve en la imagen], niebla moviéndose despacio, ambiente inquietante.",
        tip: "Toca «Animar» en cada imagen. La tensión la pone tu voz y tu música, no el movimiento.",
        motion: "acercamiento",
      },
    ],
  },
  {
    id: "fabulas",
    emoji: "🦊",
    name: "Fábulas",
    pitch: "Un animal con traje cuenta una lección incómoda sobre dinero, trabajo o relaciones.",
    style: {
      name: "Fábula vintage",
      description: "ilustración vintage cinematográfica, tonos sepia y dorado, iluminación cálida de lámpara, textura de papel antiguo",
    },
    steps: [
      {
        id: "narrador",
        title: "1. Narrador",
        kind: "image",
        model: "nano-banana-pro",
        aspect: "9:16",
        prompt: "Un [animal: zorro / búho / lobo] con traje [color y estilo], sabio y algo cínico, sentado en un sillón de cuero junto a una lámpara. Mirando a cámara. Sin texto.",
        saveAsCharacter: true,
        tip: "Guárdalo con «Usar como personaje»: es la cara del canal.",
      },
      {
        id: "escena",
        title: "2. Escena de la lección",
        kind: "image",
        model: "nano-banana-2",
        aspect: "9:16",
        prompt: "Escena: [qué pasa: el cuervo adulador le sirve café al león jefe]. Expresión del personaje: [emoción]. Sin texto.",
      },
    ],
  },
  {
    id: "datos",
    emoji: "🔍",
    name: "Datos curiosos",
    pitch: "Un dato sorprendente por video con recreaciones visuales propias.",
    steps: [
      {
        id: "recreacion",
        title: "1. Recreación visual",
        kind: "image",
        model: "nano-banana-2",
        aspect: "9:16",
        prompt: "Recreación realista de primer plano de [lo que se explica: un corazón humano del tamaño de un puño junto a una manzana], fondo limpio, iluminación de estudio. Que se entienda sin texto.",
        tip: "Verifica el dato antes de publicar y marca las recreaciones como hechas con IA.",
      },
    ],
  },
  {
    id: "finanzas",
    emoji: "💰",
    name: "Finanzas",
    pitch: "Conceptos de dinero con objetos cotidianos y números simples. Educativo, sin consejos de inversión.",
    steps: [
      {
        id: "visual",
        title: "1. Visual del concepto",
        kind: "image",
        model: "nano-banana-pro",
        aspect: "9:16",
        prompt: "Ilustración plana y limpia que explique [concepto: interés compuesto] con [objetos: una alcancía y monedas que crecen en torres], colores [paleta]. En pantalla solo el número «[número clave]» en grande.",
        tip: "Revisa cada número con calculadora antes de publicar.",
      },
    ],
  },
];

export const MOTIONS: { id: string; label: string; text: string }[] = [
  { id: "acercamiento", label: "Acercamiento lento", text: "Cámara: acercamiento suave y lento hacia el sujeto, sin cortes ni movimientos bruscos." },
  { id: "paneo", label: "Paneo lateral", text: "Cámara: paneo lateral lento de izquierda a derecha, movimiento estable y continuo." },
  { id: "fija", label: "Cámara fija", text: "Cámara: plano fijo, sin movimiento de cámara; solo se mueve el sujeto." },
  { id: "orbita", label: "Órbita suave", text: "Cámara: órbita suave alrededor del sujeto a velocidad constante." },
  { id: "alejamiento", label: "Alejamiento", text: "Cámara: alejamiento lento que revela el entorno." },
];

export function getMotion(id?: string) {
  return MOTIONS.find((m) => m.id === id);
}

/** Campos [entre corchetes] que el usuario todavía no completó. */
export function pendingFields(prompt: string): string[] {
  return Array.from(prompt.matchAll(/\[([^\]]{1,80})\]/g), (m) => m[1]);
}
