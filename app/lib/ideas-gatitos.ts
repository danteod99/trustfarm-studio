// Gatitos dentro de Mascotas (pedido del 06-11-2026): siempre crías pequeñas haciendo algo tierno o gracioso.
// Solo salen en /ideas las listadas en ideas-publicadas.ts; los demás VIDEOS_GATITOS_POR_PROBAR entran
// ocultos por SQL hasta que alguien los pruebe.
import type { Idea, Variacion } from "./ideas.ts";

const CATEGORIA = "Mascotas";
const FUENTE = "Pedido directo: gatitos pequeños haciendo cosas tiernas o graciosas. No sale de una tendencia medida.";

type Base = Pick<Idea, "id" | "title" | "hook" | "prompt"> & { v: [string, string][] };

const variaciones = (v: [string, string][]): Variacion[] => v.map(([titulo, prompt]) => ({ titulo, prompt }));

function imagen({ v, ...b }: Base): Idea {
  return { ...b, category: CATEGORIA, kind: "image", model: "z-image", aspect: "9:16", image: `/showcase/idea-${b.id}.jpg`, variaciones: variaciones(v), fuente: FUENTE, tendencia: true };
}

function video({ v, ...b }: Base, motion: string): Idea {
  return { ...b, category: CATEGORIA, kind: "video", model: "ltx-25", aspect: "9:16", duration: 5, resolution: "720p", motion, variaciones: variaciones(v), fuente: FUENTE, tendencia: true };
}

export const IDEAS_GATITOS: Idea[] = [
  imagen({
    id: "gatito-taza", title: "Gatito robando una galleta",
    hook: "Lo diminuto y travieso detiene el scroll: un gatito pequeño en plena misión.",
    prompt: "Foto realista macro de un gatito atigrado diminuto, cría de pocas semanas y ojos enormes, asomado dentro de una taza de cerámica sobre una mesa de madera, estirando una patita para alcanzar una galleta que se ve enorme a su lado, luz suave de ventana. Sin texto ni logos.",
    v: [
      ["Se esconde en un zapato", "Foto realista de un gatito [color: blanco / naranja] diminuto, cría de pocas semanas, que se asoma desde un zapato de niño y saca la lengua, luz suave. Sin texto ni logos."],
      ["Trepa una manga", "Foto realista de un gatito diminuto trepando con cara de esfuerzo la manga de un suéter, mirando a la cámara, fondo desenfocado. Sin texto ni logos."],
      ["Pelea con un ovillo", "Foto realista de un gatito diminuto enredado en un ovillo de lana más grande que él, con cara de sorpresa, luz cálida. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "gatito-chef", title: "Gatito chef diminuto",
    hook: "Tierno y absurdo a la vez: un gatito pequeño cocinando funciona como serie.",
    prompt: "Foto realista de un gatito naranja diminuto, bebé de cuatro semanas, tan pequeño como una taza, con cabeza redonda grande, orejas pequeñas y patitas cortas, con gorro blanco de chef y delantal pequeños, de pie sobre una tabla de cocina sosteniendo una cuchara de madera con las dos patitas, con un tomate y una zanahoria que se ven gigantes a su lado, cocina casera, luz cálida. Sin texto ni logos.",
    v: [
      ["Lleno de harina", "Foto realista de un gatito gris diminuto, bebé de cuatro semanas, con cabeza redonda grande, orejas pequeñas y patitas cortas, con gorro de panadero, cubierto de harina, amasando con las patitas un pan más grande que él, con cara de concentración. Sin texto ni logos."],
      ["Prueba el ceviche", "Foto realista de un gatito diminuto, bebé de tres semanas, de cara muy redonda, ojos grandes de cría y patitas cortas, con delantal pequeño, más pequeño que el plato, olfateando un plato de ceviche enorme a su lado, cubos de pescado blanco con cebolla roja y camote, en una cocina peruana. Sin texto ni logos."],
      ["Barista", "Foto realista de un gatito [color: blanco / negro] diminuto, bebé de cuatro semanas, con cabeza redonda grande y patitas cortas, con delantal de barista, empujando con las patitas una taza más grande que él sobre el mostrador de una cafetería. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "gatito-chullo", title: "Gatito con chullo jugando con lana",
    hook: "Lo tierno con identidad local: un gatito pequeño que solo podría ser de aquí.",
    prompt: "Foto realista de un gatito atigrado diminuto, cría de pocas semanas, con un pequeño chullo andino de colores, jugando con un ovillo de lana de alpaca sobre una pared de piedra inca, montañas desenfocadas detrás, luz de mañana. Sin texto ni logos.",
    v: [
      ["Con una llamita", "Foto realista de un gatito diminuto con chullo que le toca la nariz con la patita a una cría de llama, en un campo andino. Sin texto ni logos."],
      ["En el mercado", "Foto realista de un gatito diminuto con poncho pequeño que se asoma de una canasta de frutas en un mercado de [lugar: Cusco / Otavalo], con una patita sobre un mango. Sin texto ni logos."],
      ["Maneja el mototaxi", "Foto realista de un gatito diminuto con gorrita sentado en el asiento de un mototaxi con las patitas sobre el manubrio, calle de barrio desenfocada. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "gatito-oficina", title: "Gatito agotado en su primer día de trabajo",
    hook: "Humor de oficina con un protagonista diminuto: todos se sienten así.",
    prompt: "Foto realista de un gatito gris diminuto, cría de pocas semanas, con corbata pequeña, dormido boca abajo sobre el teclado de una laptop con la lengua afuera, una taza de café gigante a su lado, luz de oficina. Sin texto ni logos.",
    v: [
      ["En videollamada", "Foto realista de un gatito diminuto con corbata frente a una laptop, con la patita levantada como pidiendo la palabra y cara muy seria. Sin texto ni logos."],
      ["Lunes", "Foto realista de un gatito diminuto hundido entre una pila de papeles, solo asoma la cabeza con cara de sueño. Sin texto ni logos."],
      ["El jefe", "Foto realista de un gatito [color: blanco / negro] diminuto en una silla de jefe enorme, señalando con la patita un escritorio. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "gatito-travesura", title: "Gatito saltando a la caja",
    hook: "Un gatito pequeño en pleno salto hacia su caja: la travesura que todos quieren volver a ver.",
    prompt: "Foto realista de un gatito diminuto, bebé de cuatro semanas, con cabeza redonda grande y patitas cortas, en pleno salto, suspendido en el aire con las cuatro patitas estiradas, cayendo hacia una caja de cartón abierta mucho más grande que él. Sin texto ni logos.",
    v: [
      ["Con el papel", "Foto realista de un gatito atigrado diminuto, bebé de cuatro semanas, con cabeza redonda grande y patitas cortas, envuelto de pies a cabeza en tiras de papel higiénico, con el rollo desenrollado por el piso del baño y cara de inocente. Sin texto ni logos."],
      ["Con la planta", "Foto realista de un gatito [color: naranja / gris] diminuto, bebé de cuatro semanas, con cabeza redonda grande y patitas cortas, sentado dentro de una maceta pequeña que le queda grande, con tierra en la nariz. Sin texto ni logos."],
      ["Con el calcetín", "Foto realista de un gatito diminuto, bebé de tres semanas, de cara muy redonda, ojos grandes de cría y patitas cortas, arrastrando con la boca un calcetín más grande que él por el piso de la sala, con cara traviesa. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "gatito-sueno-comida", title: "Gatito dormido sobre su comida",
    hook: "Se durmió comiendo: tierno y gracioso a la vez, ideal para buenas noches.",
    prompt: "Foto realista de un gatito atigrado diminuto, cría de pocas semanas, que se quedó dormido con la cara apoyada dentro de su platito de comida y las patitas abiertas, migajas en la nariz, luz cálida de tarde. Sin texto ni logos.",
    v: [
      ["Boca arriba", "Foto realista de un gatito diminuto dormido boca arriba sobre una manta tejida, con las patitas levantadas y la pancita al aire. Sin texto ni logos."],
      ["En el sofá", "Foto realista de un gatito diminuto dormido a punto de caerse del borde de un sofá, con una patita colgando, luz de tarde. Sin texto ni logos."],
      ["Navidad", "Foto realista de un gatito diminuto dormido dentro de una caja de regalo junto a un árbol de Navidad con luces [color: cálidas / doradas]. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "gatito-abrazo", title: "Gatitos abrazados",
    hook: "Dos gatitos pequeños dándose cariño: el tipo de imagen que la gente guarda y envía.",
    prompt: "Foto realista de dos gatitos diminutos, crías de pocas semanas, uno blanco y uno naranja, abrazados y juntando sus caritas con los ojos cerrados sobre una manta suave, luz cálida de ventana. Sin texto ni logos.",
    v: [
      ["Le lame la oreja", "Foto realista de un gatito diminuto lamiéndole la oreja a su hermanito, que cierra los ojos, luz suave. Sin texto ni logos."],
      ["Con un cachorro", "Foto realista de un gatito diminuto dormido sobre la cabeza de un cachorro de perro, luz cálida. Sin texto ni logos."],
      ["Con una mano", "Foto realista de un gatito [color: gris / atigrado] diminuto abrazando con sus patitas el dedo de una persona, fondo desenfocado. Sin texto ni logos."],
    ],
  }),
];

export const VIDEOS_GATITOS_POR_PROBAR: Idea[] = [
  video({
    id: "gatito-cocinando", title: "Gatito cocinando un huevo",
    hook: "Video corto y tierno, con sonido de cocina: fácil de hacer en serie.",
    prompt: "Video realista de un gatito naranja diminuto, cría de pocas semanas, con gorro blanco de chef, de pie frente a una sartén pequeña en una cocina casera, moviendo la patita sobre un huevo frito que chisporrotea. Sonido de la sartén y un maullido muy agudo. Luz cálida, cámara fija. Sin texto ni logos.",
    v: [
      ["Panqueques", "Un gatito diminuto con delantal mira una pila de panqueques más alta que él y le da un golpecito con la patita. Sonido de cocina y un maullido agudo. Sin texto ni logos."],
      ["Café", "Un gatito diminuto con delantal de barista empuja una taza sobre un mostrador. Sonido de cafetería. Sin texto ni logos."],
      ["Pizza", "Un gatito [color: gris / blanco] diminuto amasa una masa de pizza con sus patitas sobre una mesa con harina. Sin texto ni logos."],
    ],
  }, "fija"),
  video({
    id: "gatito-bosteza", title: "Gatito que se despierta",
    hook: "Cinco segundos de ternura: bostezo, estirón y mirada a cámara.",
    prompt: "Primer plano realista de un gatito atigrado diminuto, cría de pocas semanas, dormido sobre una manta, que despierta, bosteza, estira las patitas y mira a la cámara con ojos enormes. Maullido muy agudo, luz de mañana, la cámara se acerca despacio. Sin voz, sin texto ni logos.",
    v: [
      ["Se cae jugando", "Un gatito blanco diminuto intenta atrapar un hilo de lana y se cae de lado sobre una manta, luego se levanta. Maullido agudo. Sin texto ni logos."],
      ["Da pasitos", "Un gatito diminuto camina con pasitos torpes hacia la cámara sobre una alfombra y se tropieza. Maullido agudo. Sin texto ni logos."],
      ["Mira la lluvia", "Un gatito [color: naranja / gris] diminuto toca con la patita las gotas de una ventana y voltea a la cámara. Sonido de lluvia. Sin texto ni logos."],
    ],
  }, "acercamiento"),
  video({
    id: "gatito-habla", title: "Gatito que te dice algo",
    hook: "Una voz graciosa en español: el formato que invita a etiquetar a alguien.",
    prompt: "Un gatito naranja diminuto, cría de pocas semanas, sentado en un sofá enorme para él, mira a la cámara y mueve la boca diciendo con voz muy aguda y graciosa en español latino: «Ya sé que comí hace cinco minutos, pero tengo hambre». Sonido ambiente de casa. Video realista, cámara fija. Sin subtítulos ni logos.",
    v: [
      ["Lunes", "Un gatito diminuto con corbata frente a una laptop dice con voz muy aguda: «Hoy no trabajo, es lunes». Sin subtítulos ni logos."],
      ["Celos", "Un gatito diminuto mira a la cámara y dice con voz muy aguda: «¿Quién es ese perro en tu foto?». Sin subtítulos ni logos."],
      ["Amor", "Un gatito diminuto dice con voz muy tierna: «Te quiero, pero [frase: dame atún / abre la puerta]». Sin subtítulos ni logos."],
    ],
  }, "fija"),
];
