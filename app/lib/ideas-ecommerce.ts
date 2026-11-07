// Ideas para ecommerce y realismo LATAM (pedido del gerente, 06-11-2026): gente vendiendo sus productos
// con imágenes y videos que parezcan reales. Solo salen en /ideas las listadas en ideas-publicadas.ts;
// los demás VIDEOS_ECOMMERCE_POR_PROBAR entran ocultos por SQL hasta que alguien los pruebe.
import type { Idea, Variacion } from "./ideas.ts";

const CATEGORIA = "Ecommerce y tiendas";
const FUENTE = "Pedido del gerente: ecommerce y realismo LATAM, no sale de una tendencia medida.";

type Base = Pick<Idea, "id" | "title" | "hook" | "prompt"> & { category?: string; v: [string, string][] };

const variaciones = (v: [string, string][]): Variacion[] => v.map(([titulo, prompt]) => ({ titulo, prompt }));

function imagen({ v, category, ...b }: Base, model: "z-image" | "qwen-image" = "z-image"): Idea {
  return { ...b, category: category ?? CATEGORIA, kind: "image", model, aspect: "9:16", image: `/showcase/idea-${b.id}.jpg`, variaciones: variaciones(v), fuente: FUENTE, tendencia: true };
}

function video({ v, category, ...b }: Base, duration: number, motion: string): Idea {
  return { ...b, category: category ?? CATEGORIA, kind: "video", model: "ltx-25", aspect: "9:16", duration, resolution: "720p", motion, variaciones: variaciones(v), fuente: FUENTE, tendencia: true };
}

export const IDEAS_ECOMMERCE: Idea[] = [
  imagen({
    id: "ecom-fondo-blanco", title: "Foto limpia para tu catálogo",
    hook: "Fondo blanco parejo, como exigen los marketplaces. Cambia el producto por el tuyo.",
    prompt: "Fotografía de catálogo de una licuadora de cocina con base de acero cepillado totalmente lisa, con una sola perilla redonda y sin ninguna marca, palabra ni letra, aislada sobre fondo blanco puro #FFFFFF, imagen de producto recortada y sin sombra, producto centrado y nítido, sin objetos alrededor. Sin texto.",
    v: [
      ["Zapatillas", "Fotografía de catálogo de unas zapatillas [color: blancas / negras] sobre fondo blanco puro, vista lateral, sombra suave, producto nítido. Sin texto."],
      ["Bolso", "Fotografía de catálogo de un bolso de cuero marrón sobre fondo blanco puro, vista frontal, luz pareja, sombra suave. Sin texto."],
      ["Perfume", "Fotografía de catálogo de un frasco de perfume de vidrio sobre fondo blanco puro, reflejo suave debajo, luz de estudio. Sin texto."],
    ],
  }),
  imagen({
    id: "ecom-flatlay", title: "Kit completo visto desde arriba",
    hook: "Todo lo que trae tu producto, ordenado en una foto: resuelve dudas antes de que pregunten.",
    prompt: "Foto flat lay tomada justo desde arriba, con la cámara apuntando en vertical hacia la mesa: un kit de cuidado facial ordenado sobre una mesa de madera clara, un frasco de vidrio con gotero, un pote de crema de vidrio transparente, una botella de vidrio de tónico y una toalla doblada, todos sin etiquetas ni letras, ramitas verdes alrededor, luz natural de ventana. Sin texto ni logos.",
    v: [
      ["Café", "Foto flat lay tomada justo desde arriba, con la cámara apuntando en vertical: un kit de café artesanal sobre tela de yute, bolsa de papel lisa, taza de cerámica, prensa francesa de vidrio con émbolo y granos, luz natural. Sin texto ni logos."],
      ["Accesorios", "Foto cenital de accesorios de [color: dorado / plateado] ordenados sobre tela de lino: aretes, collar y pulsera, luz suave. Sin texto ni logos."],
      ["Regalo", "Foto flat lay tomada justo desde arriba, con la cámara apuntando en vertical: una caja de regalo abierta con velas, jabones y una tarjeta en blanco, sobre fondo color crema. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "ecom-cocina-real", title: "Tu producto en una cocina de verdad",
    hook: "Una cocina latina normal, no un estudio: se ve como lo usaría tu cliente.",
    prompt: "Foto casual sin producción de una licuadora blanca de cuerpo totalmente liso, sin marcas ni letras, sobre el mostrador de una cocina de casa peruana sencilla, azulejos blancos gastados, cocina a gas y repostero viejo, maracuyás amarillos y plátanos al lado, una mano de piel morena apoyada en la tapa, luz de mañana por una ventana con reja, encuadre imperfecto. Sin texto ni logos.",
    v: [
      ["Olla", "Foto casual sin producción de una olla arrocera eléctrica blanca, lisa y sin marcas, abierta, con arroz recién hecho y vapor, sobre la mesa con mantel de hule de una cocina peruana sencilla con mayólicas gastadas, luz de ventana, encuadre imperfecto. Sin texto ni logos."],
      ["Sala", "Foto casual sin producción de una aspiradora [color: roja / negra] en la sala de una casa peruana sencilla, sofá viejo de tela, alfombra gastada, paredes con la pintura usada, luz de tarde, encuadre imperfecto. Sin texto ni logos."],
      ["Terraza", "Foto casual sin producción de una parrilla eléctrica negra de mesa, con cable enchufado y carne asándose, en primer plano sobre una mesa, en la azotea de una casa en Lima con paredes de ladrillo sin tarrajear y ropa tendida, familia desenfocada al fondo. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "ecom-empaquetando", title: "Empacando pedidos en casa",
    hook: "Detrás de cámaras: mostrar los pedidos saliendo da confianza y prueba que vendes.",
    prompt: "Foto casual sin producción de una emprendedora peruana de 30 años, mestiza, piel morena, rostro redondo y pelo negro recogido, con ropa común, empacando pedidos en la mesa de su sala sencilla, cajas de cartón, cinta y bolsas apiladas, ropa doblada, muebles viejos, luz natural de ventana, concentrada y sonriendo, piel real con poros. Sin texto ni logos.",
    v: [
      ["Solo manos", "Primer plano realista de manos cerrando una caja de cartón con cinta sobre una mesa, otras cajas apiladas detrás, luz natural. Sin texto ni logos."],
      ["Hombre", "Foto casual sin producción de un emprendedor peruano de [edad: 25 / 40] años, mestizo de piel morena y pelo negro corto, con polo común, revisando pedidos en un pequeño depósito con estantes de metal y cajas sin etiquetas, luz fluorescente. Sin texto ni logos."],
      ["Montaña de pedidos", "Foto casual sin producción de una pila grande de paquetes listos para enviar en la sala sencilla de una casa peruana, muebles viejos, una mujer mestiza de piel morena detrás celebrando. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "ecom-galeria-ropa", title: "Tu tienda de ropa en galería",
    hook: "Muestra tu puesto como es: el ambiente que tu clienta reconoce.",
    prompt: "Foto casual sin producción de una vendedora peruana de 28 años, mestiza de piel morena, atendiendo en un pequeño puesto de ropa dentro de una galería comercial de Gamarra en Lima, pasillo angosto bajo techo, percheros llenos de prendas y maniquíes, luz fluorescente, ambiente real. Sin texto ni logos legibles.",
    v: [
      ["Con clienta", "Foto casual sin producción de una clienta peruana mestiza de piel morena probándose una blusa frente a un espejo en un puesto de una galería de ropa, la vendedora al lado le acomoda la blusa, pasillo angosto, luz fluorescente. Sin texto ni logos."],
      ["Vitrina", "Foto casual sin producción de la vitrina angosta de una tienda de [producto: zapatos / bolsos] en una galería comercial popular de Latinoamérica, sin letreros en la fachada, gente pasando desenfocada, luz fluorescente. Sin texto ni logos."],
      ["Calzado", "Foto casual sin producción de un vendedor peruano mestizo de piel morena mostrando zapatillas a un cliente en su pequeño puesto de un centro comercial popular, pasillo angosto, estantes llenos, sin letreros. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "ecom-zapatillas-calle", title: "Zapatillas en la vereda",
    hook: "Foto de calle, no de catálogo: el estilo que funciona en tiendas de Instagram.",
    prompt: "Foto casual sin producción, plano a la altura de los tobillos, de unos pies con zapatillas deportivas blancas de tela caminando por una vereda gastada de una calle de Barranco con muros de colores, luz de tarde, fondo desenfocado. Sin texto ni logos.",
    v: [
      ["En la escalera", "Foto casual sin producción de unas zapatillas deportivas de tela con cordones, de color [color: negras / rojas], apoyadas en una escalera de piedra de una calle colonial, luz de tarde. Sin texto ni logos."],
      ["Con jean", "Foto casual sin producción de piernas con jean y zapatillas deportivas blancas con cordones, sentadas al borde de una vereda, a la altura del suelo. Sin texto ni logos."],
      ["Lluvia", "Foto realista de botas de cuero en una vereda mojada con reflejos de luces de la ciudad de noche. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "ecom-bolso-mercado", title: "Tu bolso en la calle, con una modelo latina",
    hook: "Una persona real de tu país usando el producto vende más que el producto solo.",
    prompt: "Foto casual sin producción de una mujer peruana de 32 años, mestiza, piel morena, rostro redondo y cabello negro, caminando por un mercado de flores de Lima con las manos libres y un bolso de cuero marrón al hombro, sonrisa natural, luz de mañana, piel real con poros sin retoque. Sin texto ni logos.",
    v: [
      ["Oficina", "Foto casual sin producción de una mujer peruana de [edad: 28 / 40] años, mestiza de piel morena, con ropa de oficina sencilla, entrando a un edificio de oficinas común de Lima con un bolso negro al hombro, luz natural, piel real con poros. Sin texto ni logos."],
      ["Playa", "Foto casual sin producción de una mujer peruana mestiza de piel morena con vestido sencillo y bolso de paja en un malecón de Lima, baranda de concreto junto al mar, viento en el pelo, cielo gris, luz de tarde, piel real con poros. Sin texto ni logos."],
      ["Mochila", "Foto casual sin producción de un joven peruano de piel morena con una sola mochila gris lisa en la espalda, esperando la combi en un paradero de una avenida de Lima, luz de mañana. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "ecom-razones-compra", title: "3 razones para comprar",
    hook: "Una imagen con tres beneficios claros, lista para tu anuncio o carrusel.",
    prompt: "Anuncio vertical de diseño limpio con fondo crema. Arriba el título grande negro: \"3 RAZONES\". En el centro la foto de un frasco de sérum de vidrio ámbar. Debajo tres líneas cortas en letras grandes: \"HIDRATA\", \"NO ENGRASA\", \"DURA 3 MESES\".",
    v: [
      ["Zapatillas", "Anuncio vertical con fondo azul. Título grande: \"3 RAZONES\". Foto de unas zapatillas blancas. Tres líneas: \"LIVIANAS\", \"RESISTENTES\", \"CÓMODAS\"."],
      ["Café", "Anuncio vertical con fondo marrón. Título grande: \"3 RAZONES\". Foto de una bolsa de café. Tres líneas: \"DE ALTURA\", \"RECIÉN TOSTADO\", \"SIN AMARGOR\"."],
      ["Licuadora", "Anuncio vertical con fondo [color: rojo / verde]. Título grande: \"3 RAZONES\". Foto de una licuadora. Tres líneas: \"POTENTE\", \"SILENCIOSA\", \"FÁCIL DE LAVAR\"."],
    ],
  }, "qwen-image"),
  imagen({
    id: "ecom-envios", title: "Anuncio de envíos a todo el país",
    hook: "Responde la pregunta que más te hacen antes de que te la hagan.",
    prompt: "Anuncio vertical con fondo azul intenso. Texto grande blanco arriba: \"ENVÍOS A TODO EL PERÚ\". En el centro, una caja de cartón lisa sin letras con una moto de reparto detrás. Abajo, en amarillo: \"PAGAS AL RECIBIR\".",
    v: [
      ["Colombia", "Anuncio vertical con fondo verde. Texto grande blanco: \"ENVÍOS A TODA COLOMBIA\". Una caja de cartón en el centro. Abajo en amarillo: \"PAGO CONTRA ENTREGA\"."],
      ["México", "Anuncio vertical con fondo rojo. Texto grande blanco: \"ENVÍOS A TODO MÉXICO\". Una caja de cartón en el centro. Abajo en amarillo: \"RECIBE EN 3 DÍAS\"."],
      ["Hoy mismo", "Anuncio vertical con fondo [color: negro / morado]. Texto grande blanco: \"ENTREGA HOY MISMO\". Una moto de reparto en el centro. Abajo en amarillo: \"EN LIMA\"."],
    ],
  }, "qwen-image"),
  imagen({
    id: "ecom-perfume-mano", title: "Producto en la mano, con la calle detrás",
    hook: "El plano simple que parece foto de cliente y genera confianza.",
    prompt: "Foto realista de celular de una mano latina sosteniendo un frasco de perfume de vidrio frente a la cámara, fondo desenfocado de una calle de ciudad latinoamericana al atardecer, luz cálida, uñas naturales. Sin texto ni logos.",
    v: [
      ["Crema", "Foto realista de una mano sosteniendo un pote de crema frente a un espejo de baño de casa, luz de mañana. Sin texto ni logos."],
      ["Suplemento", "Foto realista de una mano sosteniendo un frasco de vitaminas blanco, liso y sin etiqueta, en un gimnasio desenfocado, luz de gimnasio. Sin texto ni logos."],
      ["Café", "Foto realista de una mano sosteniendo una bolsa de café de papel kraft lisa, llena y cerrada, frente a un cafetal de [lugar: Chanchamayo / Antioquia] con plantas de café con frutos rojos. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "latam-bodega", category: "Negocios y máquinas", title: "Dueña de bodega con su negocio",
    hook: "Rostros y lugares que la gente reconoce: realismo de barrio para tu marca.",
    prompt: "Foto casual sin producción de una señora peruana mestiza de 50 años, dueña de una bodega de barrio en Lima, sonriendo detrás de su mostrador con estantes de abarrotes, bolsas de arroz, latas y galletas de etiquetas borrosas, sin licores, luz natural desde la puerta, piel real con arrugas, delantal, ambiente auténtico. Sin texto ni logos legibles.",
    v: [
      ["Peluquería", "Foto casual sin producción de una peluquera peruana de 35 años, mestiza de piel morena, de pie detrás de una clienta sentada en un sillón gastado, le corta el pelo con tijeras y mira a la cámara, en su pequeño salón de barrio con espejo, luz natural, piel real con poros. Sin texto ni logos."],
      ["Taller", "Foto casual sin producción de un mecánico peruano de [edad: 30 / 55] años, mestizo de piel morena y rostro ancho, overol manchado liso, en su taller de motos de barrio, manos con grasa y sonrisa orgullosa, piel real con poros. Sin texto ni logos."],
      ["Panadería", "Foto casual sin producción de un panadero peruano mestizo de piel morena sacando del horno una bandeja de panes franceses pequeños en su panadería de barrio de madrugada, paredes viejas, luz cálida. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "latam-feria", category: "Negocios y máquinas", title: "Tu puesto en la feria",
    hook: "Presenta tu emprendimiento en el lugar donde de verdad se vende.",
    prompt: "Foto casual sin producción de una joven emprendedora peruana, mestiza de piel morena y rostro redondo, atendiendo su puesto de jabones artesanales en una feria al aire libre de Lima, mesa con mantel, toldo blanco, clientes desenfocados, luz de mañana, piel real con poros. Sin texto ni logos legibles.",
    v: [
      ["Comida", "Foto casual sin producción de una pareja peruana, mestizos de piel morena, atendiendo un puesto de postres en una feria gastronómica de noche, luces colgantes, sin carteles. Sin texto ni logos."],
      ["Artesanía", "Foto realista de una artesana andina con su puesto de tejidos en una feria de [ciudad: Cusco / Otavalo], colores vivos. Sin logos."],
      ["Plantas", "Foto casual sin producción de un joven peruano mestizo de piel morena vendiendo plantas en macetas en un mercado de fin de semana, luz suave. Sin texto ni logos."],
    ],
  }),
];

export const VIDEOS_ECOMMERCE_POR_PROBAR: Idea[] = [
  video({
    id: "ecom-ugc-crema", title: "Clienta recomendando tu crema",
    hook: "UGC con acento latino: una persona normal que parece clienta real.",
    prompt: "Una mujer latina de 34 años con polo gris de algodón, cabello recogido y sin maquillaje, en el baño de su casa, sostiene un pote de crema sin marca, mira a la cámara del celular y dice una sola vez con voz natural en español latino: \"Llevo dos semanas usándola y mi piel cambió\". Luz de ventana, cámara en mano, piel real. Sin subtítulos ni logos.",
    v: [
      ["Suplemento", "Un hombre latino de 40 años en su cocina sostiene un frasco y dice en español latino: \"Lo tomo cada mañana, y ya no me canso\". Cámara en mano. Sin subtítulos."],
      ["Limpieza", "Una señora latina en su casa muestra un producto de limpieza y dice: \"Con esto se fue la mancha de [lugar: la cocina / el baño]\". Cámara en mano. Sin subtítulos."],
      ["Café", "Una joven latina en su terraza toma café y dice: \"Este es el que pido cada mes\". Luz de mañana, cámara en mano. Sin subtítulos."],
    ],
  }, 8, "fija"),
  video({
    id: "ecom-demo-licuadora", title: "Demostración en 5 segundos",
    hook: "Muestra que funciona: el video de producto más directo para ecommerce.",
    prompt: "Primer plano en una cocina latinoamericana: una mano enciende una licuadora y el mango se convierte en jugo en segundos, salpicaduras dentro del vaso. Sonido fuerte del motor y una voz dice en español latino: \"Mira cómo queda\". Luz natural. Sin subtítulos ni logos.",
    v: [
      ["Aspiradora", "Una aspiradora pequeña limpia migas de un sofá en una pasada, primer plano. Voz: \"Una pasada y listo\". Sin subtítulos ni logos."],
      ["Plancha de pelo", "Una mano pasa una plancha por un mechón ondulado de cabello negro y queda lacio. Voz: \"Sin maltratar\". Sin subtítulos ni logos."],
      ["Quitamanchas", "Una mano limpia una mancha de [mancha: café / vino] en una camisa blanca y desaparece. Voz: \"Así de fácil\". Sin subtítulos ni logos."],
    ],
  }, 5, "acercamiento"),
  video({
    id: "ecom-prueba-ropa", title: "Se prueba la prenda frente al espejo",
    hook: "Probarse la ropa en un cuarto real: el formato que más vende moda en redes.",
    prompt: "Una joven latina de 25 años frente al espejo de su cuarto se mira con un vestido floral, gira y dice con voz alegre en español latino: \"Me quedó perfecto, y es talla M\". Cámara de celular, luz de tarde, cuarto ordenado y real. Sin subtítulos ni logos.",
    v: [
      ["Jean", "Una mujer latina de talla grande se prueba un jean frente al espejo y dice: \"Por fin uno que me queda bien\". Cámara de celular. Sin subtítulos ni logos."],
      ["Zapatillas", "Un joven latino se sienta en su cama, se pone unas zapatillas y dice: \"Mira qué livianas\". Sin subtítulos ni logos."],
      ["Conjunto", "Una mujer latina muestra un conjunto [estilo: deportivo / de oficina] frente al espejo y gira despacio. Sin subtítulos ni logos."],
    ],
  }, 5, "fija"),
  video({
    id: "ecom-haul", title: "Haul: lo que me llegó esta semana",
    hook: "Varias compras sobre la cama: entretiene y muestra tu catálogo sin parecer anuncio.",
    prompt: "Una joven latina sentada en su cama con paquetes abiertos a su alrededor levanta una blusa frente a la cámara y dice con emoción en español latino: \"Y esto me costó menos de treinta soles\". Luz de ventana, cámara de celular, cuarto real. Sin subtítulos ni logos.",
    v: [
      ["Cocina", "Una señora latina en su cocina saca utensilios de una caja y dice: \"Miren lo que llegó\". Cámara de celular. Sin subtítulos ni logos."],
      ["Tecnología", "Un joven latino en su escritorio abre paquetes con audífonos y cables y dice: \"Esto sí valió la pena\". Sin subtítulos ni logos."],
      ["Maquillaje", "Una joven latina frente a su tocador muestra productos de maquillaje y dice: \"El [producto: labial / rubor] es mi favorito\". Sin subtítulos ni logos."],
    ],
  }, 8, "fija"),
  video({
    id: "ecom-problema-solucion", title: "Problema y solución en un plano",
    hook: "Empieza con el problema de tu cliente y termina con tu producto: estructura clásica de anuncio.",
    prompt: "En una cocina real, una mujer latina intenta abrir un frasco y no puede, resopla, luego usa un abridor pequeño y el frasco se abre de inmediato. Sonríe a la cámara y dice en español latino: \"Ojalá lo hubiera comprado antes\". Luz natural. Sin subtítulos ni logos.",
    v: [
      ["Cables", "Un joven enreda los cables de su escritorio, usa un organizador y queda ordenado. Dice: \"Por fin\". Sin subtítulos ni logos."],
      ["Dolor de espalda", "Un hombre latino se toca la espalda en su silla de oficina, coloca un cojín lumbar y se relaja. Dice: \"Mucho mejor\". Sin subtítulos ni logos."],
      ["Mascota", "Una mujer quita pelos de perro del sofá sin éxito, usa un rodillo y queda limpio. Dice: \"Así de simple\". Sin subtítulos ni logos."],
    ],
  }, 8, "fija"),
  video({
    id: "ecom-venta-en-vivo", title: "Venta en vivo desde tu tienda",
    hook: "El formato de vender en vivo, listo para clips cortos y anuncios.",
    prompt: "Una vendedora latina de 30 años frente a un celular en un trípode con aro de luz, en su pequeña tienda con ropa colgada detrás, levanta una blusa y dice con energía en español latino: \"Quedan solo cinco, escríbeme ahora\". Sin subtítulos ni logos.",
    v: [
      ["Maquillaje", "Una vendedora latina muestra un labial a la cámara en vivo y dice: \"Este se agotó dos veces\". Aro de luz. Sin subtítulos ni logos."],
      ["Zapatillas", "Un vendedor latino muestra un par de zapatillas en vivo y dice: \"Solo por hoy, envío gratis\". Sin subtítulos ni logos."],
      ["Comida", "Una señora latina vende [plato: tamales / empanadas] en vivo desde su cocina y dice: \"Recién salidos\". Sin subtítulos ni logos."],
    ],
  }, 8, "fija"),
  video({
    id: "latam-historia-emprendedora", category: "Negocios y máquinas", title: "Empecé vendiendo desde mi cuarto",
    hook: "Historia real de emprendedor: el video que genera confianza y comentarios.",
    prompt: "Una emprendedora latina de 29 años en su pequeño depósito lleno de cajas mira a la cámara y dice con voz cercana en español latino: \"Hace un año vendía desde mi cuarto. Hoy envío cien pedidos al día\". Cámara en mano, luz natural. Sin subtítulos ni logos.",
    v: [
      ["Food truck", "Un joven latino frente a su carrito de comida dice: \"Dejé la oficina por este carrito, y no me arrepiento\". Luz de tarde. Sin subtítulos ni logos."],
      ["Señora", "Una señora latina en su taller de costura dice: \"Empecé con una máquina prestada\". Luz de ventana. Sin subtítulos ni logos."],
      ["Barbero", "Un barbero latino en su barbería de [ciudad: Lima / Caracas] dice: \"Primero cortaba en la sala de mi mamá\". Sin subtítulos ni logos."],
    ],
  }, 8, "fija"),
  video({
    id: "latam-repartidor", title: "El pedido llega a la puerta",
    hook: "El momento de la entrega: transmite que comprarte es seguro.",
    prompt: "Un repartidor latino en moto llega a la puerta de una casa de barrio en Lima, entrega una caja a una clienta sonriente, ella la abre emocionada y dice en español latino: \"¡Llegó rapidísimo!\". Luz de tarde, cámara en mano. Sin subtítulos ni logos.",
    v: [
      ["Edificio", "Un repartidor entrega un paquete en la recepción de un edificio y una joven lo recibe. Dice: \"Justo a tiempo\". Sin subtítulos ni logos."],
      ["Provincia", "Una señora recibe un paquete en la plaza de un pueblo de [lugar: los Andes / la costa] y lo abre feliz. Sin subtítulos ni logos."],
      ["Reacción", "Primer plano de una persona abriendo una caja en la puerta de su casa, sonrisa y sonido del cartón. Sin subtítulos ni logos."],
    ],
  }, 5, "fija"),
];
