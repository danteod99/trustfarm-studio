// Plantillas por formato (basadas en el "Kit Canales sin rostro con IA" de Kitbase).
// Cada formato es una receta de pasos: crear el personaje → escenas → animar → portada.
// Lo que va [entre corchetes] lo completa el usuario; el estudio no deja generar hasta
// que no quede ningún corchete.
import type { Aspect, Kind } from "@/app/lib/catalog";

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
  steps: TemplateStep[];
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
        model: "wan-22",
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
