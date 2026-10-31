// Ideas de generación listas para usar (página /ideas). "Usar esta idea" abre el estudio con
// /estudio?idea=<id>: precarga modelo, formato, duración, movimiento y prompt.
// Los ejemplos son generaciones reales de la plataforma (public/showcase).
import type { Aspect, Kind } from "@/app/lib/catalog";

export interface Idea {
  id: string;
  category: string;
  title: string;
  hook: string;
  /** Ejemplo: imagen (y video en bucle si existe). */
  image: string;
  video?: string;
  kind: Kind;
  model: string;
  aspect: Aspect;
  duration?: number;
  resolution?: "480p" | "720p" | "1080p";
  motion?: string;
  prompt: string;
}

const img = (n: string) => `/showcase/${n}.jpg`;
const vid = (n: string) => `/showcase/${n}.mp4`;

export const IDEA_CATEGORIES = [
  "Negocios y máquinas",
  "Brainrot",
  "Historias",
  "Influencers IA",
  "Productos y anuncios",
  "Comida",
  "Inmobiliaria",
  "Tecnología y granjas",
  "Motivación y paisajes",
] as const;

export const IDEAS: Idea[] = [
  // Negocios y máquinas
  {
    id: "maquina-cascos",
    category: "Negocios y máquinas",
    title: "Máquina lava cascos en un mall",
    hook: "El negocio que trabaja solo: muéstralo funcionando en un lugar real.",
    image: img("idea-maquina-cascos"),
    kind: "video",
    model: "ltx-25",
    aspect: "9:16",
    duration: 5,
    resolution: "720p",
    motion: "acercamiento",
    prompt:
      "Una máquina de autoservicio lava cascos futurista en un centro comercial de Lima, cuerpo negro brillante con paneles azul eléctrico y luces LED cian. Dentro de la cámara de vidrio un casco de moto gira mientras lo limpian con luz UV azul y vapor. Un motociclista se acerca, mira la pantalla y sonríe. Voz masculina peruana entusiasta dice: «Este negocio cobra mientras tú duermes». Sonido ambiente de centro comercial. Sin logos ni marcas.",
  },
  {
    id: "selladora-latas",
    category: "Negocios y máquinas",
    title: "Selladora de latas en feria",
    hook: "Bebidas en lata al momento: el clip que hace preguntar «¿dónde la compro?».",
    image: img("idea-selladora"),
    kind: "video",
    model: "ltx-25",
    aspect: "9:16",
    duration: 5,
    resolution: "720p",
    motion: "fija",
    prompt:
      "Una máquina selladora de latas de acero y negro con bordes LED azules en un mercado de comida de noche. Un vendedor pone un vaso de chicha morada, la máquina baja la tapa y sella la lata con un clic. La lata sale brillante y la entrega a un cliente. Sonido de la máquina sellando y murmullo del mercado. Sin logos.",
  },
  {
    id: "antes-despues",
    category: "Negocios y máquinas",
    title: "Antes y después",
    hook: "El formato que más comparte la gente: la transformación en una sola imagen.",
    image: img("idea-antes-despues"),
    kind: "image",
    model: "qwen-image",
    aspect: "9:16",
    prompt:
      "Imagen vertical dividida en dos: a la izquierda con la palabra ANTES un casco de moto sucio y gastado, a la derecha con la palabra DESPUÉS el mismo casco limpio y brillante como nuevo. Fondo blanco de estudio, etiquetas grandes en negro.",
  },

  // Brainrot
  {
    id: "brainrot-llama",
    category: "Brainrot",
    title: "Llamalicuadora Chichamorada",
    hook: "Animales y objetos peruanos fusionados, con su nombre cantado.",
    image: img("brainrot-llama"),
    video: vid("brainrot-llama"),
    kind: "video",
    model: "ltx-25",
    aspect: "9:16",
    duration: 5,
    resolution: "720p",
    prompt:
      "Render 3D hiperrealista y absurdo estilo meme brainrot: una llama peruana cuyo cuerpo es una licuadora gigante llena de chicha morada, girando y salpicando en la Plaza de Armas del Cusco. Una voz masculina dramática canta: «¡Llamalicuadora Chichamorada!». Sonido de licuadora. Sin subtítulos.",
  },
  {
    id: "brainrot-cuy",
    category: "Brainrot",
    title: "Cuyastronauto Mototaxino",
    hook: "Inventa tu propio personaje: un animal + un objeto + un lugar.",
    image: img("brainrot-cuy"),
    video: vid("brainrot-cuy"),
    kind: "video",
    model: "ltx-25",
    aspect: "9:16",
    duration: 5,
    resolution: "720p",
    prompt:
      "Render 3D hiperrealista y absurdo estilo meme brainrot: un cuy astronauta con traje plateado maneja un mototaxi volador sobre los cerros del Cusco al atardecer y saluda a la cámara. Voz épica grita: «¡Cuyastronauto Mototaxino!». Ruido de motor y viento. Sin subtítulos.",
  },
  {
    id: "brainrot-pollo",
    category: "Brainrot",
    title: "Pollerina Marinerina",
    hook: "Comida que baila: funciona en TikTok y Reels.",
    image: img("brainrot-pollo"),
    video: vid("brainrot-pollo"),
    kind: "video",
    model: "ltx-25",
    aspect: "9:16",
    duration: 5,
    resolution: "720p",
    prompt:
      "Render 3D hiperrealista y absurdo estilo meme brainrot: un pollo a la brasa dorado con piernas de bailarina baila marinera con un pañuelo blanco en un escenario de madera. Voz teatral canta: «¡Pollerina Marinerina!». Zapateo y guitarra festiva. Sin subtítulos.",
  },

  // Historias
  {
    id: "frutinovela",
    category: "Historias",
    title: "Frutinovela: el mensaje",
    hook: "Capítulos cortos con final en suspenso; el mismo personaje en cada escena.",
    image: img("fresa-llorando"),
    kind: "image",
    model: "qwen-image",
    aspect: "9:16",
    prompt:
      "Una fresa con rasgos humanos, ojos grandes, vestido rojo y aretes dorados, llorando mientras lee un mensaje en el celular, sentada en la cocina de su casa. Animación 3D cinematográfica, iluminación dramática de telenovela. Sin texto.",
  },
  {
    id: "miniserie-taxi",
    category: "Historias",
    title: "Miniserie: el sobre",
    hook: "Gancho en el primer segundo y corte justo en la reacción.",
    image: img("miniserie-taxi"),
    kind: "video",
    model: "ltx-25",
    aspect: "9:16",
    duration: 8,
    resolution: "720p",
    motion: "acercamiento",
    prompt:
      "Plano cinematográfico de noche dentro de un taxi en Lima: un taxista de cuarenta años abre un sobre con su nombre escrito, lee y su cara se congela. Dice en voz baja: «¿Cómo sabían que era yo?». Reflejos de neón en el parabrisas mojado, sonido de lluvia. Sin subtítulos.",
  },
  {
    id: "fabula-zorro",
    category: "Historias",
    title: "Fábula con narrador",
    hook: "Un animal sabio que cuenta lecciones de dinero y trabajo.",
    image: img("fabula-zorro"),
    kind: "image",
    model: "z-image",
    aspect: "9:16",
    prompt:
      "Ilustración cinematográfica vintage en tonos sepia y dorado: un zorro sabio con traje de tweed sentado en un sillón de cuero junto a una lámpara de bronce, leyendo un libro de cuentas. Luz cálida de lámpara, textura de papel antiguo. Sin texto.",
  },

  // Influencers IA
  {
    id: "influencer-cafe",
    category: "Influencers IA",
    title: "Creadora hablando a cámara",
    hook: "Videos tipo UGC con voz en español para presentar productos.",
    image: img("ltx-cafe"),
    video: vid("ltx-cafe"),
    kind: "video",
    model: "ltx-25",
    aspect: "9:16",
    duration: 5,
    resolution: "720p",
    motion: "fija",
    prompt:
      "Una joven peruana en una cafetería de Lima mira a la cámara del celular y dice con voz alegre: «Hoy les traigo el mejor café de Miraflores». Se escucha el murmullo de la cafetería y una taza sobre la mesa. Luz cálida de mañana, cámara en mano.",
  },
  {
    id: "modelo-producto",
    category: "Influencers IA",
    title: "Modelo con tu producto",
    hook: "Sube la foto real de tu producto y ponla en manos de tu creadora virtual.",
    image: img("modelo-ia"),
    kind: "image",
    model: "qwen-image",
    aspect: "9:16",
    prompt:
      "Foto realista de celular de una creadora de contenido latina en un departamento luminoso de Miraflores, sosteniendo el producto de la imagen de referencia junto a su cara y sonriendo a la cámara. Luz natural de ventana, piel real.",
  },

  // Productos y anuncios
  {
    id: "producto-estudio",
    category: "Productos y anuncios",
    title: "Foto de estudio de producto",
    hook: "Luz, fondo y gotas de agua sin alquilar un estudio.",
    image: img("producto-serum"),
    kind: "image",
    model: "z-image",
    aspect: "9:16",
    prompt:
      "Foto publicitaria de alta gama de un frasco de sérum de vidrio ámbar sobre roca volcánica negra mojada, gotas de agua, luz lateral dramática, fondo turquesa desenfocado, fotografía comercial.",
  },
  {
    id: "unboxing",
    category: "Productos y anuncios",
    title: "Unboxing",
    hook: "Manos abriendo la caja: el formato clásico que vende.",
    image: img("idea-unboxing"),
    kind: "video",
    model: "ltx-25",
    aspect: "9:16",
    duration: 5,
    resolution: "720p",
    motion: "fija",
    prompt:
      "Unos manos abren lentamente una caja negra premium sobre un escritorio de madera y aparece un reloj inteligente con la pantalla encendida. Luz suave de ventana, papel de seda, sonido de la caja abriéndose. Video realista de celular, sin logos.",
  },
  {
    id: "afiche-texto",
    category: "Productos y anuncios",
    title: "Afiche con tu marca",
    hook: "El nombre de tu negocio escrito perfecto dentro de la imagen.",
    image: img("frutilandia"),
    kind: "image",
    model: "qwen-image",
    aspect: "9:16",
    prompt:
      "Póster vertical de una heladería llamada FRUTILANDIA, letras grandes rosadas arriba, helados de fresa y mango en primer plano, estilo fotografía publicitaria.",
  },

  // Comida
  {
    id: "ceviche",
    category: "Comida",
    title: "Plato del día",
    hook: "Comida que se ve irresistible, con el texto de la promo.",
    image: img("idea-ceviche"),
    kind: "image",
    model: "qwen-image",
    aspect: "9:16",
    prompt:
      "Foto publicitaria vertical de un ceviche peruano fresco en un bowl de cerámica con cebolla roja, camote y choclo, limones, fondo oscuro con un solo foco cálido, vapor y gotas, texto grande blanco arriba que dice CEVICHE DEL DÍA.",
  },
  {
    id: "chef-flambeado",
    category: "Comida",
    title: "Chef en acción",
    hook: "Fuego, chispas y sonido: el clip que detiene el scroll.",
    image: img("idea-chef"),
    kind: "video",
    model: "ltx-25",
    aspect: "9:16",
    duration: 5,
    resolution: "720p",
    motion: "acercamiento",
    prompt:
      "Un chef con uniforme negro flambea una sartén en la cocina oscura de un restaurante, grandes llamas y chispas, luz naranja dramática. Sonido del fuego y la sartén. Cinematográfico y realista.",
  },

  // Inmobiliaria
  {
    id: "depa-vista-mar",
    category: "Inmobiliaria",
    title: "Departamento con vista al mar",
    hook: "Recorridos que venden la sensación de vivir ahí.",
    image: img("idea-depa"),
    kind: "video",
    model: "ltx-25",
    aspect: "9:16",
    duration: 8,
    resolution: "720p",
    motion: "paneo",
    prompt:
      "Recorrido lento por la sala de un departamento moderno de lujo en Miraflores con ventanales de piso a techo frente al océano Pacífico al atardecer, muebles minimalistas y luces cálidas. Música suave de piano, sin voz.",
  },

  // Tecnología y granjas
  {
    id: "granja-iphones",
    category: "Tecnología y granjas",
    title: "Caja con decenas de iPhones",
    hook: "Plano cercano, de noche, con luces azules: el estilo de los virales de granjas.",
    image: img("ltx-granja"),
    video: vid("ltx-granja"),
    kind: "video",
    model: "ltx-25",
    aspect: "9:16",
    duration: 8,
    resolution: "720p",
    motion: "acercamiento",
    prompt:
      "Una caja de metal negra abierta sobre un escritorio de madera, llena de iPhones encendidos de pie en filas, cada uno con un cable USB-C en el puerto inferior. La cámara se acerca muy lento; las pantallas cambian de video y los LED azules parpadean. Detrás, un monitor con un mosaico de videos y luz morada. Zumbido de ventiladores y notificaciones suaves, sin voz.",
  },

  // Motivación y paisajes
  {
    id: "emprendedor-amanecer",
    category: "Motivación y paisajes",
    title: "Emprendedor al amanecer",
    hook: "El fondo perfecto para tu frase motivacional.",
    image: img("idea-motivacion"),
    kind: "video",
    model: "ltx-25",
    aspect: "9:16",
    duration: 5,
    resolution: "720p",
    motion: "orbita",
    prompt:
      "Un joven emprendedor peruano de pie en una azotea de Lima al amanecer mirando la ciudad, luz dorada y destello de lente, la cámara gira suave alrededor de él. Viento y ciudad despertando, sin voz. Cinematográfico, grano de película.",
  },
  {
    id: "machu-picchu",
    category: "Motivación y paisajes",
    title: "Machu Picchu desde el aire",
    hook: "Paisajes épicos del Perú para intros y fondos.",
    image: img("machu-picchu"),
    kind: "video",
    model: "ltx-25",
    aspect: "9:16",
    duration: 8,
    resolution: "720p",
    motion: "alejamiento",
    prompt:
      "Toma aérea cinematográfica de Machu Picchu al amanecer, nubes bajas moviéndose entre las montañas, luz dorada, la cámara se aleja lentamente revelando el valle. Viento suave y música épica, sin voz.",
  },
];

export function getIdea(id: string): Idea | undefined {
  return IDEAS.find((i) => i.id === id);
}
