// Ideas del research de tendencias del 06-11-2026 (tarea 2). Las fuentes son de SEO y vendedores de
// prompts: sirven de inspiración, no son métrica de plataforma.
// Solo salen en /ideas las listadas en ideas-publicadas.ts. Los demás VIDEOS_POR_PROBAR entran ocultos por
// SQL (supabase/16_ideas_videos_tendencia.sql): se publican desde admin cuando alguien los pruebe.
import type { Idea, Variacion } from "./ideas.ts";

type Base = Pick<Idea, "id" | "category" | "title" | "hook" | "prompt"> & { v: [string, string][] };

const variaciones = (v: [string, string][]): Variacion[] => v.map(([titulo, prompt]) => ({ titulo, prompt }));

function imagen(b: Base, model: "z-image" | "qwen-image", fuente: string): Idea {
  const { v, ...resto } = b;
  return { ...resto, kind: "image", model, aspect: "9:16", image: `/showcase/idea-${b.id}.jpg`, variaciones: variaciones(v), fuente, tendencia: true };
}
const flash = (b: Base, fuente: string) => imagen(b, "z-image", fuente);
const conTexto = (b: Base, fuente: string) => imagen(b, "qwen-image", fuente);

function video(b: Base, model: "ltx-25" | "veo-fast", duration: number, motion: string, fuente: string): Idea {
  const { v, ...resto } = b;
  return { ...resto, kind: "video", model, aspect: "9:16", duration, resolution: "720p", motion, variaciones: variaciones(v), fuente, tendencia: true };
}

const F = {
  figurita: "Tendencia: figurita coleccionable 1/7 con base acrílica (posible fatiga).",
  miniatura: "Tendencia: mundos en miniatura tilt-shift.",
  iaVsReal: "Tendencia: AI vs Handmade / Dame Hombro, pantalla dividida.",
  antesDespues: "Variación de negocio: antes y después con la caja.",
  afiche: "Tendencia: afiche de Hollywood de cosas cotidianas.",
  revista: "Tendencia: Polaroid y portada de revista.",
  polaroid: "Tendencia: Polaroid y portada de revista.",
  selfie: "Tendencia: personajes históricos con selfie moderna.",
  anuario: "Tendencia: anuario 2085.",
  abrazo: "Tendencia: abrazo a tu yo joven.",
  anime: "Tendencia: redibujo en animación japonesa clásica.",
  baile: "Tendencia: foto a baile (Raindance AI, baile con foto).",
  bebe: "Tendencia: AI Baby Dance, adaptada a un bebé animado.",
  perro: "Tendencia: Singing Dog AI.",
  sinRostro: "Tendencia: canales sin rostro con avatar y voz consistentes.",
  diaEnLaVida: "Variación de negocio: un día en la vida de la máquina.",
} as const;

export const IDEAS_TENDENCIA: Idea[] = [
  // Tecnología y granjas: primeros planos de la caja, donde mejor funciona el estilo de granjas.
  flash({
    id: "granja-figurita", category: "Tecnología y granjas", title: "Figurita de la caja de iPhones",
    hook: "Tu granja como pieza de colección: la tendencia de figuritas aplicada a tu negocio.",
    prompt: "Figurita de juguete coleccionable diminuta, del tamaño de una moneda grande, hecha de plástico pintado: una caja de metal negra abierta llena de iPhones en filas con cables USB-C, sobre una base redonda de acrílico transparente, encima de un escritorio, junto a un lápiz normal que muestra lo pequeña que es. Foto macro de producto realista, luz de estudio suave, fondo desenfocado. Sin texto ni logos.",
    v: [
      ["Con su caja", "Réplica de juguete en miniatura, tan pequeña como una caja de fósforos, de una caja negra llena de iPhones en filas, sobre una base de acrílico transparente, sin muñecos ni personas, junto a un empaque de juguete de cartón vacío de color [color: azul / negro]. Foto macro de producto realista. Sin texto ni logos."],
      ["En la mano", "Una mano real con la palma abierta y, sobre la palma, una réplica de juguete en miniatura, tan pequeña como una caja de fósforos, de una caja de metal negra llena de iPhones en filas con cables USB-C, fondo de [lugar: una oficina / un cuarto oscuro] desenfocado, foto macro realista. Sin texto ni logos."],
      ["En la vitrina", "Réplica de juguete en miniatura de una caja de iPhones en filas, tan pequeña como una caja de fósforos, sin muñecos ni personas, sobre una base de acrílico transparente en el estante de una vitrina de coleccionista iluminada con luz [color: azul / morada], foto macro realista. Sin texto ni logos."],
    ],
  }, F.figurita),
  flash({
    id: "granja-miniatura", category: "Tecnología y granjas", title: "Granja en miniatura tilt-shift",
    hook: "Efecto maqueta: tu caja de iPhones parece un mundo diminuto y detiene el scroll.",
    prompt: "Fotografía tilt-shift de una caja de metal negra llena de iPhones encendidos en filas con cables USB-C, vista como una maqueta en miniatura, personas diminutas caminando entre los cables, foco selectivo, colores saturados, luz azul. Sin texto.",
    v: [
      ["Con obreros", "Fotografía tilt-shift de una caja de metal negra llena de iPhones encendidos en filas con cables USB-C, vista como una maqueta en miniatura, obreros diminutos con casco revisando los cables entre los teléfonos, foco selectivo, luz [color: azul / cian]. Sin texto."],
      ["Ciudad de cables", "Fotografía tilt-shift de una caja de metal negra llena de iPhones encendidos en filas con cables USB-C, vista como una ciudad nocturna en miniatura: las pantallas parecen edificios encendidos y autos diminutos circulan sobre los cables. Sin texto."],
      ["Sobre el escritorio", "Maqueta tilt-shift de una caja de iPhones en filas sobre un escritorio de [material: madera / vidrio], una taza de café gigante al lado, foco selectivo. Sin texto."],
    ],
  }, F.miniatura),
  flash({
    id: "granja-antes-despues", category: "Tecnología y granjas", title: "Tu cuarto vs. tu cuarto con la caja",
    hook: "Antes y después en una sola imagen: el cambio se entiende sin explicar nada.",
    prompt: "Imagen dividida en dos mitades verticales. Izquierda: un cuarto simple y desordenado con un solo celular sobre la cama, luz apagada. Derecha: el mismo cuarto ordenado con una caja de metal negra llena de iPhones encendidos en filas con cables USB-C sobre el escritorio y luces LED azules. Foto realista. Sin texto.",
    v: [
      ["Escritorio", "Imagen dividida en dos mitades verticales con una línea blanca al centro. Izquierda: un escritorio vacío con una laptop vieja, luz apagada. Derecha: el mismo escritorio con una caja negra llena de iPhones en filas y luz [color: azul / morada]. Foto realista. Sin texto ni logos."],
      ["Garaje", "Imagen dividida en dos mitades verticales con una línea blanca al centro. Izquierda: un garaje desordenado lleno de trastos y cajas de cartón. Derecha: el mismo garaje ordenado con cajas de metal llenas de iPhones en filas sobre un estante y luces LED. Foto realista. Sin texto ni logos."],
      ["De día y de noche", "Imagen dividida en dos mitades verticales con una línea blanca al centro. Izquierda: una caja de metal llena de iPhones en filas sobre un escritorio de día, ventana soleada. Derecha: la misma caja de noche en un cuarto oscuro con todas las pantallas encendidas. Foto realista. Sin texto ni logos."],
    ],
  }, F.antesDespues),
  flash({
    id: "granja-ia-vs-real", category: "Tecnología y granjas", title: "Maqueta vs. real: la caja",
    hook: "Pantalla dividida: la caja en cartón y la caja real, un contraste que dispara los comentarios.",
    prompt: "Imagen dividida: a la izquierda, una maqueta de cartón de una caja con iPhones en filas; a la derecha, la caja real de metal con pantallas encendidas. Sin texto.",
    v: [
      ["Celular vs. cine", "Imagen dividida en dos mitades verticales con una línea blanca al centro y el mismo encuadre. Izquierda: una caja de iPhones en filas en una foto casera con flash de celular. Derecha: la misma caja de iPhones en filas con iluminación de cine [color: azul / cian]. Sin texto ni logos."],
      ["Boceto vs. foto", "Imagen dividida: a la izquierda, un boceto a lápiz de una caja llena de iPhones en filas; a la derecha, la misma caja en foto realista. Sin texto."],
      ["Acuarela vs. foto", "Imagen dividida: a la izquierda, una pintura en acuarela sobre papel de una caja llena de iPhones en filas; a la derecha, la misma caja en foto realista. Sin texto."],
    ],
  }, F.iaVsReal),
  conTexto({
    id: "granja-afiche", category: "Tecnología y granjas", title: "Afiche de película de la caja",
    hook: "Tu caja de iPhones como estreno de Hollywood: gracioso y muy compartible.",
    prompt: "Afiche de película de acción de Hollywood protagonizado por una caja de metal negra abierta, vista de frente, llena de iPhones encendidos en filas con sus cámaras y bordes bien reconocibles y cables USB-C, en el centro, con luces azules dramáticas, humo y chispas. Título grande arriba: \"LA CAJA\". Abajo, en letras pequeñas: \"PRÓXIMAMENTE\".",
    v: [
      ["Terror", "Afiche de película de terror: una caja de metal llena de iPhones en filas brilla en un sótano oscuro. Título grande: \"NO LA TOQUES\"."],
      ["Comedia", "Afiche de comedia de los 90 con una caja llena de iPhones en filas sobre fondo [color: amarillo / celeste]. Título grande: \"MI SOCIO EL ROUTER\"."],
      ["Ciencia ficción", "Afiche de ciencia ficción: una caja de iPhones en filas flota sobre la ciudad de Lima de noche con rayos de luz. Título grande: \"40 CELULARES\"."],
    ],
  }, F.afiche),
  flash({
    id: "granja-macro-cables", category: "Tecnología y granjas", title: "Macro de cables y pantallas",
    hook: "Primer plano hipnótico: cables ordenados y pantallas encendidas, ideal para un gancho sin rostro.",
    prompt: "Primer plano macro de una fila de iPhones encendidos de pie dentro de una caja de metal negra, cada uno con un cable USB-C en el puerto inferior, cables ordenados, profundidad de campo corta, luces LED azules y cian, de noche. Foto realista. Sin texto.",
    v: [
      ["Luz morada", "Primer plano macro de iPhones de pie en una caja negra con cables USB-C, profundidad de campo corta, luz LED [color: morada / rosada]. Foto realista. Sin texto."],
      ["Desde arriba", "Vista cenital de una caja de metal llena de iPhones en filas con cables USB-C ordenados y pantallas encendidas, luz azul. Foto realista. Sin texto."],
      ["Con ventilador", "Primer plano de una caja de metal negra llena de iPhones en filas con cables USB-C y, a un lado, un pequeño ventilador redondo de aspas encendido, luz [color: azul / blanca]. Foto realista. Sin texto ni logos."],
    ],
  }, "Refuerzo de Tecnología y granjas: primer plano, el punto fuerte del estilo."),
  flash({
    id: "granja-escritorio-noche", category: "Tecnología y granjas", title: "La caja trabajando de noche",
    hook: "La imagen del negocio que sigue corriendo mientras duermes.",
    prompt: "Foto realista de una caja de metal negra abierta, lisa y sin letras, sobre un escritorio de madera, llena de iPhones encendidos en filas con cables USB-C, junto a una laptop abierta y una taza de café, de noche, la única luz viene de las pantallas y de una tira LED azul. Sin texto ni logos.",
    v: [
      ["Con la ciudad", "Caja negra lisa y sin letras, llena de iPhones en filas, sobre un escritorio junto a una ventana con la ciudad de [ciudad: Lima / Bogotá] de noche, luz de las pantallas. Foto realista. Sin texto ni logos."],
      ["De madrugada", "Una caja de metal negra llena de iPhones en filas sobre una mesa de madera, al lado un reloj de agujas, de madrugada, cuarto oscuro, luz azul de las pantallas. Foto realista. Sin texto ni logos."],
      ["Dos cajas", "Vista de frente de dos cajas de metal negras iguales, lado a lado, ambas abiertas y llenas de iPhones en filas, con el metal liso sin letras, sobre un escritorio de noche, cables USB-C ordenados, luz LED [color: azul / morada]. Foto realista. Sin texto ni logos."],
    ],
  }, "Refuerzo de Tecnología y granjas: primer plano, el punto fuerte del estilo."),
  conTexto({
    id: "granja-revista", category: "Tecnología y granjas", title: "Portada de revista de tu granja",
    hook: "Como si tu negocio saliera en la portada: prueba social con humor.",
    prompt: "Portada de una revista de negocios con una caja de metal negra abierta llena de iPhones encendidos en filas, con sus cámaras y bordes bien reconocibles, como protagonista, sobre fondo oscuro con luz azul. Título grande arriba: \"NEGOCIOS\". Texto abajo: \"La caja que trabaja sola\". Ningún otro texto.",
    v: [
      ["Tecnología", "Portada de revista de tecnología con una caja llena de iPhones en filas, fondo [color: negro / azul]. Título grande: \"TECH\". Texto abajo: \"40 pantallas, 1 persona\"."],
      ["Con el dueño", "Portada de revista: una persona joven sonríe con los brazos cruzados junto a una caja llena de iPhones en filas. Título grande: \"EMPRENDER\". Texto abajo: \"Empezó en su cuarto\"."],
      ["Retro", "Portada de revista retro de los 80 con una caja de iPhones en filas y colores neón. Título grande: \"FUTURO\"."],
    ],
  }, F.revista),

  // Negocios y máquinas
  conTexto({
    id: "selladora-afiche", category: "Negocios y máquinas", title: "Afiche de película de tu selladora",
    hook: "La selladora de vasos como héroe de acción: tu máquina se vuelve el personaje.",
    prompt: "Afiche de película de acción de Hollywood protagonizado por una máquina selladora de vasos de mostrador, de acero inoxidable con una palanca negra arriba y un vaso de plástico con jugo debajo de la placa selladora, en un local de bebidas, con luces dramáticas y chispas. Título grande arriba: \"LA SELLADORA\". Abajo, en letras pequeñas: \"NUNCA FALLA UN VASO\".",
    v: [
      ["Comedia", "Afiche de comedia con una máquina selladora de vasos de mostrador, de acero con una palanca negra, en el centro, sobre fondo [color: amarillo / rosado] y vasos de plástico con tapa de film volando alrededor. Título grande: \"SELLADA Y MUY FELIZ\"."],
      ["Terror", "Afiche de terror: una máquina selladora de vasos de mostrador, de acero con una palanca negra y un vaso de plástico debajo, brilla en un local de bebidas oscuro. Título grande: \"EL ÚLTIMO VASO\"."],
      ["Romance", "Afiche romántico: una máquina selladora de vasos de mostrador, de acero con una palanca negra, y al lado un vaso de plástico con jugo sellado con film, al atardecer. Título grande: \"PARA SIEMPRE SELLADOS\"."],
    ],
  }, F.afiche),
  flash({
    id: "maquina-cascos-miniatura", category: "Negocios y máquinas", title: "Lava cascos en miniatura",
    hook: "Tu máquina como maqueta: un formato de tendencia que muestra el producto sin venderlo.",
    prompt: "Fotografía tilt-shift de una máquina de autoservicio lava cascos, un gabinete alto negro y azul con una cámara de vidrio y un casco de moto adentro, en el pasillo de un centro comercial visto como una maqueta en miniatura, personas diminutas con cascos de moto haciendo fila frente a la máquina, foco selectivo, colores saturados. Sin texto.",
    v: [
      ["En la calle", "Tilt-shift de una máquina de autoservicio lava cascos, un gabinete alto negro y azul con una cámara de vidrio y un casco de moto adentro, en una esquina de [ciudad: Lima / Medellín] como maqueta, motos diminutas alrededor, foco selectivo. Sin texto."],
      ["En la plaza", "Tilt-shift de una máquina de autoservicio lava cascos, un gabinete alto negro y azul con una cámara de vidrio y un casco de moto adentro, en una plaza con árboles y bancas como maqueta, motociclistas diminutos alrededor, foco selectivo. Sin texto."],
      ["Fila de motos", "Tilt-shift visto desde arriba de una máquina de autoservicio lava cascos, un gabinete alto negro y azul con una cámara de vidrio y un casco de moto adentro, en una calle como maqueta, con una fila larga de motos diminutas esperando, foco selectivo. Sin texto."],
    ],
  }, F.miniatura),
  flash({
    id: "maquina-cascos-figurita", category: "Negocios y máquinas", title: "Figurita del lava cascos",
    hook: "La máquina convertida en juguete de colección: gracioso y fácil de recordar.",
    prompt: "Réplica de juguete coleccionable a escala 1/7 de una máquina de autoservicio lava cascos: un gabinete negro con paneles azules lisos, sin letreros ni letras, con una cámara de vidrio y solo un casco de moto diminuto dentro, sin muñecos ni personas, sobre una base acrílica transparente, en un escritorio. Foto de producto realista, luz de estudio suave, fondo desenfocado. Sin texto.",
    v: [
      ["Con su empaque", "Réplica de juguete 1/7 de una máquina de autoservicio lava cascos, un gabinete negro con paneles azules lisos, sin letreros, con una cámara de vidrio y solo un casco diminuto dentro, sin muñecos, junto a una caja de cartón de juguete vacía de color [color: rojo / azul], base acrílica, foto de producto. Sin texto."],
      ["En la mano", "Mano real con la palma abierta sosteniendo una réplica de juguete diminuta de una máquina de autoservicio lava cascos, un gabinete negro y azul liso con una cámara de vidrio y un casco diminuto dentro, sin muñecos, fondo de un mall desenfocado, foto realista. Sin texto."],
      ["Colección", "Tres réplicas de juguete pequeñas y del mismo tamaño, en fila sobre un estante: un gabinete negro con un casco de moto dentro de una cámara de vidrio, una máquina selladora de vasos de acero con palanca y una máquina expendedora roja de bebidas, foto realista. Sin texto."],
    ],
  }, F.figurita),
  flash({
    id: "selladora-antes-despues", category: "Negocios y máquinas", title: "Vaso con y sin selladora",
    hook: "El antes y después que convence a quien vende bebidas.",
    prompt: "Imagen dividida en dos mitades verticales con una línea blanca al centro. Izquierda: un vaso de plástico de jugo volcado con la tapa suelta, el jugo derramándose sobre un mostrador. Derecha: el mismo vaso de pie con tapa de film sellada, limpio, junto a una máquina selladora de vasos de acero inoxidable con palanca negra. Foto realista de local de bebidas. Sin texto.",
    v: [
      ["Delivery", "Imagen dividida en dos mitades verticales con una línea blanca al centro. Izquierda: una bolsa de papel de delivery manchada y mojada por una bebida derramada. Derecha: una bolsa de papel limpia con un vaso sellado con film intacto dentro. Foto realista. Sin texto."],
      ["Mostrador", "Imagen dividida en dos mitades verticales con una línea blanca al centro. Izquierda: un mostrador de local de jugos desordenado con vasos de plástico con jugo sin tapa, gotas y manchas. Derecha: el mismo mostrador ordenado con una máquina selladora de acero con palanca negra y vasos de plástico con jugo de [bebida: maracuyá / boba] y tapa de film, en fila. Foto realista. Sin texto."],
      ["Bubble tea", "Imagen dividida en dos mitades verticales con una línea blanca al centro. Izquierda: un vaso de plástico de bubble tea tumbado con la tapa suelta, bebida y bolitas negras derramadas en la mesa. Derecha: un vaso de plástico liso de bubble tea de pie con sello de film, junto a una máquina selladora de acero con palanca negra. Vasos sin logos. Foto realista. Sin texto."],
    ],
  }, F.antesDespues),

  // Brainrot
  flash({
    id: "brainrot-figurita", category: "Brainrot", title: "Figurita de tu personaje brainrot",
    hook: "Convierte a tu personaje en pieza de colección y deja que la gente pida el suyo.",
    prompt: "Figurita coleccionable a escala 1/7 de un cuy animado con lentes oscuros y cadena dorada, sobre una base acrílica transparente, en un escritorio. Foto de producto realista, luz de estudio suave, fondo desenfocado. Sin texto.",
    v: [
      ["Llama", "Figurita 1/7 de una llama animada con [accesorio: corona / audífonos] sobre base acrílica, foto de producto realista. Sin texto."],
      ["Pollo", "Figurita 1/7 de un pollo a la brasa animado con piernas y brazos, sobre base acrílica, foto de producto realista. Sin texto."],
      ["Choclo", "Figurita 1/7 de una mazorca de maíz amarilla animada, con sus granos visibles, sobre base acrílica, foto de producto realista. Sin texto."],
    ],
  }, F.figurita),

  // Mascotas
  conTexto({
    id: "mascota-afiche", category: "Mascotas", title: "Tu mascota en un afiche de cine",
    hook: "Tu perro protagonista de su propia película: el formato que todos quieren compartir.",
    prompt: "Afiche de película de acción de Hollywood protagonizado por un perro mestizo marrón con gafas de sol y chaqueta de cuero, explosiones suaves detrás. Título grande arriba: \"EL FIRULAIS\". Abajo, en letras pequeñas: \"ESTE VERANO\".",
    v: [
      ["Gato villano", "Afiche de película: un gato [color: negro / blanco] como villano elegante en un sillón. Título grande: \"MICHI\"."],
      ["Comedia romántica", "Afiche de comedia romántica con dos perros en un parque al atardecer. Título grande: \"AMOR DE PARQUE\"."],
      ["Terror", "Afiche de terror: un gato mira fijo desde la oscuridad de un pasillo. Título grande: \"LAS 3 DE LA MAÑANA\"."],
    ],
  }, F.afiche),
  flash({
    id: "mascota-miniatura", category: "Mascotas", title: "Mascota gigante en ciudad miniatura",
    hook: "Tu mascota como gigante tierno en un mundo diminuto.",
    prompt: "Fotografía tilt-shift de un perro mestizo marrón gigante y tierno caminando entre edificios en miniatura de una ciudad latinoamericana, autos diminutos y personas pequeñas mirando hacia arriba, foco selectivo, luz de mañana. Sin texto.",
    v: [
      ["Gato", "Tilt-shift de un gato [color: naranja / gris] gigante durmiendo sobre edificios en miniatura, foco selectivo. Sin texto."],
      ["En la playa", "Tilt-shift de un perro gigante jugando en una playa en miniatura con sombrillas diminutas, foco selectivo. Sin texto."],
      ["En el parque", "Tilt-shift de un conejo gigante en un parque en miniatura con niños diminutos, foco selectivo. Sin texto."],
    ],
  }, F.miniatura),

  // Influencers IA
  flash({
    id: "influencer-polaroid", category: "Influencers IA", title: "Polaroid de tu creadora virtual",
    hook: "Estética de foto instantánea: da cercanía real a una cuenta de IA.",
    prompt: "Foto instantánea estilo Polaroid de una joven latina de 24 años riendo en una azotea de Lima al atardecer, grano de película, colores cálidos y desvaídos, flash suave, marco blanco de la foto. Sin texto.",
    v: [
      ["En la playa", "Foto estilo Polaroid de una joven latina en [lugar: Máncora / Cartagena] con el viento en el pelo, grano de película, marco blanco. Sin texto."],
      ["Con amigas", "Foto estilo Polaroid de tres amigas latinas riendo en una cafetería, flash directo, grano de película, marco blanco. Sin texto."],
      ["De noche", "Foto estilo Polaroid de una joven latina de piel morena en una calle de Lima de noche con luces de neón sin letras, flash directo, colores desvaídos, marco blanco. Sin texto."],
    ],
  }, F.polaroid),
  conTexto({
    id: "influencer-revista", category: "Influencers IA", title: "Portada de revista de tu creadora",
    hook: "Una portada da estatus de marca a tu personaje: ideal para perfil y destacados.",
    prompt: "Portada de una revista de moda con una mujer latina de 26 años, cabello negro, traje color crema, mirando a la cámara sobre fondo liso. Título grande arriba: \"VISTA\". Texto al costado: \"La nueva cara de Lima\".",
    v: [
      ["Fitness", "Portada de revista de deporte con una mujer latina con ropa deportiva en un parque. Título grande: \"FUERTE\". Texto: \"Rutina de 15 minutos\"."],
      ["Negocios", "Portada de revista de negocios con un hombre latino de [edad: 30 / 45] años con saco. Título grande: \"LÍDER\". Texto: \"Empezó sin capital\"."],
      ["Retro", "Portada de revista de moda de los 80 con una mujer latina y colores neón. Título grande: \"DIVA\". Ningún otro texto."],
    ],
  }, F.revista),

  // Moda y belleza
  flash({
    id: "moda-polaroid", category: "Moda y belleza", title: "Outfit del día en Polaroid",
    hook: "Convierte un catálogo frío en un recuerdo: funciona para tiendas de ropa.",
    prompt: "Foto instantánea estilo Polaroid de una modelo latina de cuerpo entero con vestido floral en una calle colorida de Barranco, luz de tarde, grano de película, colores cálidos, marco blanco de la foto. Sin texto.",
    v: [
      ["Streetwear", "Foto estilo Polaroid de un joven con ropa urbana lisa y zapatillas blancas contra un mural abstracto de colores sin letras, flash directo, marco blanco. Sin texto."],
      ["Colección", "Tres fotos estilo Polaroid sobre una mesa de madera con outfits de [temporada: verano / invierno], vista cenital. Sin texto."],
      ["Accesorios", "Foto estilo Polaroid de primer plano de manos con anillos y un bolso de cuero, luz cálida, marco blanco. Sin texto."],
    ],
  }, F.polaroid),
  flash({
    id: "moda-figurita", category: "Moda y belleza", title: "Figurita de colección con tu outfit",
    hook: "La versión juguete del outfit: la tendencia que invita a pedir la propia.",
    prompt: "Figurita coleccionable a escala 1/7 de una joven latina con chaqueta de jean y zapatillas blancas, pose segura, sobre una base acrílica transparente, en un escritorio. Foto de producto realista, luz de estudio suave, fondo desenfocado. Sin texto.",
    v: [
      ["De gala", "Figurita 1/7 de una mujer con vestido de gala [color: rojo / negro] sobre base acrílica, foto de producto realista. Sin texto."],
      ["Deportiva", "Figurita 1/7 de un joven con ropa deportiva lisa, camiseta sin números, y balón sobre base acrílica, foto de producto realista. Sin texto."],
      ["Pareja", "Figurita 1/7 de una pareja con ropa de boda sobre base acrílica, foto de producto realista. Sin texto."],
    ],
  }, F.figurita),

  // Historias ficticias
  flash({
    id: "selfie-cleopatra", category: "Historias ficticias", title: "Selfie de Cleopatra",
    hook: "¿Y si la historia hubiera tenido celular? Un formato simple que da para mil partes.",
    prompt: "Selfie realista tomada con celular por Cleopatra sonriendo, con su tocado dorado y maquillaje egipcio, las pirámides y obreros detrás, luz de atardecer, encuadre de brazo extendido. Foto casual, sin ver el celular. Sin texto.",
    v: [
      ["Bolívar", "Selfie realista tomada con celular por Simón Bolívar, con uniforme azul de general de 1820 y patillas, su cara en primer plano, montado a caballo, su ejército detrás en [lugar: los Andes / una llanura], encuadre de brazo extendido. Foto casual, sin ver el celular. Sin texto."],
      ["Inca en Machu Picchu", "Selfie realista de un emperador inca con tocado real de borla roja y plumas, orejeras de oro y túnica andina, sin barba, en Machu Picchu recién construido, obreros detrás, encuadre de brazo extendido. Sin texto."],
      ["Vikingo", "Selfie realista tomada con celular por un vikingo con barba y casco de metal, en un barco en alta mar, otros vikingos remando detrás, encuadre de brazo extendido. Foto casual, sin ver el celular. Sin texto."],
    ],
  }, F.selfie),
  flash({
    id: "anuario-2085", category: "Historias ficticias", title: "Tu foto del anuario 2085",
    hook: "Así se vería el anuario escolar del futuro: nostalgia al revés.",
    prompt: "Foto de anuario escolar del año 2085: retrato de estudio de una adolescente latina con peinado futurista plateado y chaqueta metálica, fondo azul moteado clásico de foto escolar, sonrisa tímida, grano de película. Sin texto.",
    v: [
      ["Chico", "Foto de anuario escolar del futuro: retrato de estudio de un adolescente latino con visor [color: azul / rojo] y peinado futurista plateado, fondo azul moteado clásico de foto escolar, sonrisa tímida, grano de película. Sin texto."],
      ["Profesor robot", "Foto de anuario escolar de 2085: un profesor androide con rostro sintético, foto de medio cuerpo, con saco y corbata, sonrisa amable, fondo azul moteado clásico de foto escolar. Sin texto."],
      ["Foto de clase", "Foto grupal de anuario de 2085: treinta estudiantes con trajes plateados futuristas en gradas de un colegio en Marte, detrás una cúpula de vidrio y el paisaje rojo de Marte. Sin texto."],
    ],
  }, F.anuario),
  flash({
    id: "abrazo-yo-joven", category: "Historias ficticias", title: "Abrazo a tu yo de niño",
    hook: "El formato emotivo que hace llorar y compartir. Cuéntalo con tu propia historia.",
    prompt: "Foto realista y emotiva de un hombre adulto latino de 35 años abrazando a un niño de 8 años que es su versión de niño, misma cara y mismos ojos, en el patio de una casa antigua, luz cálida de tarde, nostalgia. Sin texto.",
    v: [
      ["Mujer", "Foto realista de una mujer latina de [edad: 30 / 50] años abrazando a su versión de niña en la puerta de un colegio, luz cálida. Sin texto."],
      ["Abuelo", "Foto realista de un abuelo latino abrazando a su versión de joven con uniforme de otra época, en una plaza de pueblo. Sin texto."],
      ["En la playa", "Foto realista de una persona adulta tomando de la mano a su versión de niño en una playa al atardecer, vista de espaldas. Sin texto."],
    ],
  }, F.abrazo),
  conTexto({
    id: "afiche-combi", category: "Historias", title: "La combi, la película",
    hook: "Lo cotidiano como superproducción de Hollywood: humor local que se comparte solo.",
    prompt: "Afiche de película de acción de Hollywood protagonizado por una combi de transporte público de Lima saltando sobre un bache con chispas y polvo, luz dramática de atardecer. Título grande arriba: \"LA COMBI\". Abajo, en letras pequeñas: \"BAJA EN LA ESQUINA\".",
    v: [
      ["El mototaxi", "Afiche de película épica con un mototaxi peruano, una moto de tres ruedas con cabina y techo de lona, en un desierto al atardecer. Título grande: \"EL ÚLTIMO MOTOTAXI\"."],
      ["La lavadora", "Afiche de terror con una lavadora vieja temblando en un cuarto oscuro. Título grande: \"ÚLTIMO CICLO\"."],
      ["El wifi", "Afiche de ciencia ficción con un router parpadeando en un cuarto [estilo: oscuro / futurista]. Título grande: \"SIN SEÑAL\"."],
    ],
  }, F.afiche),

  // Motivación y paisajes
  flash({
    id: "miniatura-lima", category: "Motivación y paisajes", title: "Lima en miniatura",
    hook: "Tu ciudad como maqueta perfecta: relajante, bonita y fácil de hacer en serie.",
    prompt: "Fotografía tilt-shift de la Costa Verde de Lima vista como una maqueta en miniatura, el mar y los acantilados, autos diminutos en la avenida, foco selectivo, colores saturados, luz de atardecer. Sin texto.",
    v: [
      ["Plaza de Armas", "Tilt-shift de la Plaza de Armas de [ciudad: Cusco / Arequipa] como maqueta en miniatura, personas diminutas, foco selectivo. Sin texto."],
      ["Mercado", "Tilt-shift de un mercado latinoamericano como maqueta, puestos de fruta diminutos, foco selectivo y colores saturados. Sin texto."],
      ["Playa", "Tilt-shift de una playa llena de sombrillas de colores como maqueta en miniatura, foco selectivo. Sin texto."],
    ],
  }, F.miniatura),
  flash({
    id: "machu-picchu-miniatura", category: "Motivación y paisajes", title: "Machu Picchu en miniatura",
    hook: "Un clásico visto como nunca: la maravilla convertida en maqueta.",
    prompt: "Fotografía tilt-shift de Machu Picchu visto como una maqueta en miniatura, terrazas de piedra, turistas diminutos y llamas pequeñas, neblina suave, foco selectivo, colores saturados, luz de amanecer. Sin texto.",
    v: [
      ["De noche", "Tilt-shift de Machu Picchu de noche con cielo estrellado, como maqueta, foco selectivo. Sin texto."],
      ["Sobre una mesa", "Maqueta de Machu Picchu sobre una mesa de madera con una taza de café gigante al lado, foco selectivo. Sin texto."],
      ["Otras maravillas", "Tilt-shift de [lugar: Cartagena / Tikal] visto como una maqueta en miniatura, personas diminutas, foco selectivo. Sin texto."],
    ],
  }, F.miniatura),

  // Anime novela
  flash({
    id: "anime-acuarela", category: "Anime novela", title: "Tu escena en animación clásica japonesa",
    hook: "Estética de película animada de los 90: cálida, nostálgica y muy compartida.",
    prompt: "Ilustración estilo animación japonesa clásica de los años 90, acuarela suave y fondos pintados a mano: una joven latina toma café en una azotea de una ciudad con ropa tendida, luz dorada de tarde, nubes grandes. Sin texto.",
    v: [
      ["Pueblo", "Ilustración de animación japonesa clásica: un niño corre por un pueblo andino de casas de adobe junto a [animal: una alpaca blanca / un perro], montañas de los Andes y fondos en acuarela. Sin texto."],
      ["Lluvia", "Ilustración de animación japonesa clásica: dos amigos esperan el bus bajo la lluvia en una calle de Lima, luz gris suave. Sin texto."],
      ["Cocina", "Ilustración de animación japonesa clásica: una abuela cocina en una cocina cálida llena de ollas, vapor y luz de ventana. Sin texto."],
    ],
  }, F.anime),

  // Comida
  conTexto({
    id: "ceviche-afiche", category: "Comida", title: "El ceviche, la película",
    hook: "Tu plato estrella como superproducción: ideal para restaurantes con humor.",
    prompt: "Afiche de película épica de Hollywood protagonizado por un plato de ceviche peruano, cubos de pescado blanco crudo marinado en limón con cebolla roja en juliana, camote naranja y choclo, en el centro, olas de mar y rayos de luz dorada detrás. Título grande arriba: \"EL CEVICHE\". Abajo, en letras pequeñas: \"HOY EN TU MESA\".",
    v: [
      ["Pollo a la brasa", "Afiche de acción con un pollo a la brasa: un pollo asado entero, ya cocido, dorado y crujiente, sin cabeza ni plumas, servido en una bandeja con papas fritas, con llamas detrás. Título grande: \"A LA BRASA\"."],
      ["Terror", "Afiche de terror con un plato de [plato: lentejas / sopa] en una cocina oscura. Título grande: \"OTRA VEZ\"."],
      ["Romance", "Afiche romántico con dos tazas de café y un pan francés relleno de chicharrón en un plato, al amanecer. Título grande: \"DESAYUNO PARA DOS\". Ningún otro texto."],
    ],
  }, F.afiche),
  flash({
    id: "comida-miniatura", category: "Comida", title: "Chefs diminutos en tu plato",
    hook: "Personas en miniatura cocinando sobre tu comida: imposible no detenerse a mirar.",
    prompt: "Fotografía macro tilt-shift de chefs diminutos con gorro blanco preparando un gran plato de lomo saltado, tiras de carne de res con cebolla roja, tomate, papas fritas y arroz blanco, como si fuera una montaña, escaleras pequeñas y carretillas, foco selectivo, luz cálida de cocina. Sin texto.",
    v: [
      ["Hamburguesa", "Macro tilt-shift de obreros diminutos con casco construyendo una hamburguesa gigante con una grúa pequeña, fondo liso, sin cajas ni envases, foco selectivo. Sin texto."],
      ["Café", "Macro tilt-shift de personas diminutas remando en una barca que flota dentro del café de una taza gigante, foco selectivo. Sin texto."],
      ["Postre", "Macro tilt-shift de chefs diminutos decorando un [postre: pastel de chocolate / suspiro limeño] enorme, foco selectivo. Sin texto."],
    ],
  }, F.miniatura),

  // Productos y anuncios
  conTexto({
    id: "producto-afiche", category: "Productos y anuncios", title: "Tu producto en un afiche de cine",
    hook: "El anuncio que no parece anuncio: tu producto como estrella de película.",
    prompt: "Afiche de película de acción de Hollywood protagonizado por un frasco de perfume negro sobre una roca volcánica, con humo, chispas y luz lateral dramática. Título grande arriba: \"NOCHE\". Abajo, en letras pequeñas: \"ESTRENO EXCLUSIVO\".",
    v: [
      ["Zapatillas", "Afiche de acción con unas zapatillas [color: blancas / rojas] sobre asfalto mojado y luz de neón. Título grande: \"SIN FRENOS\"."],
      ["Skincare", "Afiche de ciencia ficción con un frasco de sérum flotando entre gotas de agua. Título grande: \"LA FÓRMULA\"."],
      ["Café", "Afiche romántico con una bolsa de café artesanal al amanecer en una montaña. Título grande: \"PRIMER SORBO\"."],
    ],
  }, F.afiche),
  flash({
    id: "producto-miniatura", category: "Productos y anuncios", title: "Tu producto gigante en miniatura",
    hook: "Obreros diminutos alrededor de tu producto: una foto que se recuerda.",
    prompt: "Fotografía tilt-shift de una botella de perfume gigante de vidrio liso, sin etiqueta ni letras, rodeada de obreros diminutos con casco, andamios y una grúa pequeña, como si la estuvieran construyendo, foco selectivo, luz de estudio. Sin texto.",
    v: [
      ["Zapatilla", "Tilt-shift de una zapatilla de lona blanca gigante, lisa y sin logos ni franjas, con pintores diminutos en andamios dándole color [color: rojo / azul] con brochas, foco selectivo. Sin texto."],
      ["Celular", "Tilt-shift de un celular gigante con limpiadores diminutos en andamios puliendo la pantalla, foco selectivo. Sin texto."],
      ["Crema", "Tilt-shift de un frasco de crema gigante, blanco y liso sin etiqueta, con científicos diminutos de bata blanca, foco selectivo. Sin texto."],
    ],
  }, F.miniatura),

  // Inmobiliaria
  flash({
    id: "depa-maqueta", category: "Inmobiliaria", title: "Tu proyecto como maqueta viva",
    hook: "Muestra un edificio o depa como maqueta tilt-shift: se entiende de un vistazo.",
    prompt: "Fotografía tilt-shift de un edificio moderno de departamentos en una avenida arbolada de Lima visto como una maqueta en miniatura, autos y personas diminutas, foco selectivo, colores saturados, luz de mañana. Sin texto.",
    v: [
      ["Interior", "Maqueta tilt-shift de un departamento abierto sin techo, vista desde arriba, muebles diminutos de color [color: madera / blanco], foco selectivo. Sin texto."],
      ["Casa de playa", "Maqueta tilt-shift de una casa de playa moderna con piscina, personas diminutas, foco selectivo. Sin texto."],
      ["Condominio", "Maqueta tilt-shift de un condominio con áreas verdes y niños diminutos jugando, foco selectivo. Sin texto."],
    ],
  }, F.miniatura),
];

// Video: no se pueden probar desde la PC de casa (van por RunPod o Google). Quedan ocultos hasta probarlos.
export const VIDEOS_POR_PROBAR: Idea[] = [
  video({
    id: "granja-unboxing", category: "Tecnología y granjas", title: "Abriendo la caja por primera vez",
    hook: "El momento en que se encienden todas las pantallas: un gancho de unboxing.",
    prompt: "Dos manos abren una caja de metal negra sobre un escritorio de noche. Dentro se ven decenas de celulares en filas ordenadas, de pie, con la pantalla plana hacia la cámara, cada una encendida en color azul sólido y con un cable USB-C en el puerto inferior. Tapa vacía, sin logos ni íconos. Sonido de la tapa y zumbido suave y constante de ventiladores. Sin voz.",
    v: [
      ["Luz morada", "Manos abren una caja negra y los iPhones en filas se encienden con luz [color: morada / cian], de noche. Sin voz."],
      ["Con voz", "Manos abren una caja llena de iPhones en filas y una voz masculina dice en español latino: \"Esto trabaja mientras duermes\"."],
      ["Reacción", "Una persona joven abre una caja llena de iPhones encendidos y sonríe con la luz azul en la cara. Sin voz."],
    ],
  }, "ltx-25", 8, "fija", "Refuerzo de Tecnología y granjas: primer plano, el punto fuerte del estilo."),
  video({
    id: "granja-dia-en-la-vida", category: "Tecnología y granjas", title: "Un día en la vida de la caja",
    hook: "Del amanecer a la noche sin moverse: la caja sigue trabajando.",
    prompt: "Plano fijo de una caja de metal llena de iPhones encendidos en filas sobre un escritorio junto a una ventana; la luz de la ventana cambia rápido de día a noche mientras las pantallas siguen encendidas. Zumbido suave de ventiladores. Sin voz.",
    v: [
      ["Con una persona", "Plano fijo acelerado: una persona entra y sale del cuarto mientras una caja de iPhones en filas sigue trabajando del día a la noche. Sin voz."],
      ["Con voz", "Plano fijo de una caja de iPhones en filas al atardecer; una voz femenina dice en español latino: \"Mientras tú descansas, ella no\"."],
      ["Lluvia", "Plano fijo de una caja de iPhones junto a una ventana con [clima: lluvia / neblina], pantallas encendidas. Sonido de lluvia. Sin voz."],
    ],
  }, "ltx-25", 8, "fija", F.diaEnLaVida),
  video({
    id: "selladora-dia-en-la-vida", category: "Negocios y máquinas", title: "Un día en la vida de la selladora",
    hook: "Contada desde la máquina: la serie de negocio que entretiene y vende.",
    prompt: "Una máquina selladora de vasos de acero inoxidable en un local de jugos sella un vaso tras otro mientras clientes pasan, ritmo alegre, luz de mañana. Sonido de la máquina al sellar. Una voz masculina dice en español latino: \"Lunes. Vaso número cien. Sigo invicta\".",
    v: [
      ["Hora pico", "La selladora sella vasos sin parar en hora pico con una fila de clientes. Voz: \"Hora pico. Yo no me canso\"."],
      ["Cierre", "El local de jugos cierra de noche y la selladora queda sola con la luz encendida. Voz: \"[frase: Mañana seguimos / Otro día invicta]\"."],
      ["Lava cascos", "Una máquina lava cascos en un mall recibe un casco tras otro. Voz: \"Hoy ya van veinte cascos\"."],
    ],
  }, "ltx-25", 8, "fija", F.diaEnLaVida),
  video({
    id: "mascota-baile", category: "Brainrot", title: "Tu mascota bailando",
    hook: "Sube la foto de tu mascota y hazla bailar. Adjúntala como imagen de referencia.",
    prompt: "La mascota de la imagen de referencia baila de forma graciosa sobre dos patas en la sala de una casa, moviendo la cabeza al ritmo de una música alegre, cámara fija, luz cálida. Conserva su aspecto y colores.",
    v: [
      ["En la calle", "La mascota de la imagen de referencia baila en una calle de [ciudad: Lima / Medellín] con gente aplaudiendo alrededor."],
      ["Con lentes", "La mascota de la imagen de referencia baila con lentes oscuros y cadena dorada bajo luces de discoteca."],
      ["En grupo", "Tres copias de la mascota de la imagen de referencia bailan coordinadas en un escenario."],
    ],
  }, "veo-fast", 6, "fija", F.baile),
  video({
    id: "brainrot-ia-vs-real", category: "Brainrot", title: "Hecho a mano vs. IA",
    hook: "Pantalla dividida: el mismo personaje hecho a mano y con IA. Comenta cuál gana.",
    prompt: "Pantalla dividida por una línea negra vertical, dos estilos muy distintos. Lado izquierdo: un cuy, roedor redondo de orejas muy pequeñas y sin cola, hecho a mano de plastilina marrón con huellas de dedos visibles, sobre cartulina arrugada, que se mueve a saltos torpes de stop-motion. Lado derecho: un cuy realista en animación 3D de cine, con pelo detallado, que baila con fluidez bajo luces de discoteca de colores. No son conejos. Música alegre, sin voz.",
    v: [
      ["Llama", "Pantalla dividida: una llama de cartón movida a mano a la izquierda y la misma llama en animación 3D a la derecha. Sin voz."],
      ["Dibujo", "Pantalla dividida: un dibujo infantil de [personaje: un pollo / una papa] a la izquierda y el mismo personaje en animación 3D a la derecha. Sin voz."],
      ["Persona", "Pantalla dividida: una persona imita un baile con torpeza a la izquierda y un personaje 3D lo hace perfecto a la derecha. Sin voz."],
    ],
  }, "ltx-25", 5, "fija", F.iaVsReal),
  video({
    id: "perro-cantante", category: "Mascotas", title: "Tu perro cantando",
    hook: "Adjunta la foto de tu perro y hazlo cantar: el formato que más se comparte en familia.",
    prompt: "El perro de la imagen de referencia canta frente a un micrófono en un pequeño escenario con luces cálidas, mueve la boca con expresión dramática y una voz cómica canta en español: \"Te extraño, mi croqueta\". Conserva su aspecto y colores.",
    v: [
      ["Reguetón", "El perro de la imagen de referencia canta reguetón con gorra y cadena: \"Dame [comida: pollo / croqueta], mami\"."],
      ["Balada", "El perro de la imagen de referencia canta una balada triste bajo la lluvia: \"Volviste sin mi pelota\"."],
      ["Gato", "El gato de la imagen de referencia canta ópera en un teatro vacío con expresión muy seria."],
    ],
  }, "veo-fast", 6, "acercamiento", F.perro),
  video({
    id: "canal-sin-rostro", category: "Influencers IA", title: "Canal sin rostro con voz fija",
    hook: "Un presentador virtual y la misma voz en cada video: un canal sin mostrar tu cara.",
    prompt: "Un presentador virtual latino de 30 años con camisa azul habla a la cámara en un estudio simple con luz suave y dice con voz serena en español latino: \"Hoy te cuento tres cosas que nadie te explicó sobre el dinero\". Plano medio.",
    v: [
      ["Curiosidades", "La misma presentadora virtual dice en español latino: \"¿Sabías que tu celular escucha más de lo que crees?\". Plano medio, estudio simple."],
      ["Historias", "Un narrador virtual de [edad: 40 / 60] años dice en voz baja: \"Esta historia ocurrió en Lima en 1985\". Luz tenue."],
      ["Noticias", "Una presentadora virtual en un set de noticias dice: \"La tendencia de esta semana te va a sorprender\". Plano medio."],
    ],
  }, "ltx-25", 8, "fija", F.sinRostro),
  video({
    id: "persona-baile-foto", category: "Influencers IA", title: "Foto que se pone a bailar",
    hook: "Sube una foto tuya y baila bajo la lluvia. Adjúntala como imagen de referencia.",
    prompt: "La persona de la imagen de referencia baila con alegría bajo una lluvia suave en una calle de noche con luces reflejadas en el suelo, cámara fija, movimiento fluido. Conserva su cara y su ropa.",
    v: [
      ["En la playa", "La persona de la imagen de referencia baila en una playa al atardecer con movimiento fluido. Conserva su cara y su ropa."],
      ["En la oficina", "La persona de la imagen de referencia baila sola en una oficina vacía de noche, con humor. Conserva su cara y su ropa."],
      ["Años 80", "La persona de la imagen de referencia baila un paso de los años 80 en un set con [luces: neón / bola de disco]. Conserva su cara."],
    ],
  }, "veo-fast", 6, "fija", F.baile),
  video({
    id: "bebe-baile", category: "Brainrot", title: "Bebé animado que baila",
    hook: "Un bebé 3D animado con ritmo: tierno, simple y fácil de hacer en serie.",
    prompt: "Un bebé de animación 3D estilo película animada, con pañal y lentes oscuros, baila con mucho ritmo sobre una alfombra de colores en una sala, música alegre, cámara fija, luz cálida. Sin voz.",
    v: [
      ["Con gorra", "Un bebé de animación 3D con gorra baila en una calle animada con ritmo urbano, cámara fija. Sin voz."],
      ["En grupo", "Tres bebés de animación 3D bailan coordinados en un escenario de [estilo: teatro / discoteca], cámara fija. Sin voz."],
      ["Fruta", "Una fruta bebé animada en 3D con pañal baila sobre una mesa de cocina, cámara fija. Sin voz."],
    ],
  }, "ltx-25", 5, "fija", F.bebe),
];
