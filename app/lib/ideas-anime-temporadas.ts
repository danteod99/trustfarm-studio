// Categorías pedidas por el gerente (06-11-2026): Anime y Navidad y temporadas. Personajes y estilos
// originales: nada de series ni personajes existentes. Solo salen en /ideas las listadas en
// ideas-publicadas.ts; los demás VIDEOS_ANIME_TEMPORADAS_POR_PROBAR entran ocultos por SQL hasta probarlos.
import type { Idea, Variacion } from "./ideas.ts";

const FUENTE = "Pedido del gerente: categoría nueva, no sale de una tendencia medida.";
const ANIME = "Anime";
const TEMPORADAS = "Navidad y temporadas";

type Base = Pick<Idea, "id" | "category" | "title" | "hook" | "prompt"> & { v: [string, string][] };

const variaciones = (v: [string, string][]): Variacion[] => v.map(([titulo, prompt]) => ({ titulo, prompt }));

function imagen({ v, ...b }: Base, model: "z-image" | "qwen-image" = "z-image"): Idea {
  return { ...b, kind: "image", model, aspect: "9:16", image: `/showcase/idea-${b.id}.jpg`, variaciones: variaciones(v), fuente: FUENTE, tendencia: true };
}

function video({ v, ...b }: Base, model: "ltx-25" | "veo-fast", duration: number, motion: string): Idea {
  return { ...b, kind: "video", model, aspect: "9:16", duration, resolution: "720p", motion, variaciones: variaciones(v), fuente: FUENTE, tendencia: true };
}

export const IDEAS_ANIME_TEMPORADAS: Idea[] = [
  // Anime
  imagen({
    id: "anime-pelea-lima", category: ANIME, title: "Pelea épica en una calle de Lima",
    hook: "Acción estilo anime en un lugar que tu público reconoce.",
    prompt: "Ilustración anime original de acción: un joven de cabello negro con chaqueta roja lanza un golpe envuelto en energía azul en una avenida oscura de Lima de noche, combis detenidas con sus faros encendidos, edificios bajos con ventanas iluminadas, sin neón ni letreros ni carteles, líneas de velocidad, polvo y chispas, composición dinámica. Sin texto.",
    v: [
      ["En el mercado", "Ilustración anime original de acción: una luchadora con trenzas salta entre puestos de fruta de un mercado latinoamericano, energía [color: dorada / verde], líneas de velocidad. Sin texto."],
      ["En Machu Picchu", "Ilustración anime original de acción: dos guerreros chocan sus espadas de luz sobre las terrazas de Machu Picchu al amanecer. Sin texto."],
      ["En la azotea", "Ilustración anime original de acción: dos rivales frente a frente, de perfil y separados, a punto de chocar en una azotea bajo la lluvia, ropa al viento, relámpago detrás. Sin texto."],
    ],
  }),
  imagen({
    id: "anime-otro-mundo", category: ANIME, title: "Renací en otro mundo",
    hook: "Un oficinista latino aparece en un mundo de fantasía: el gancho se explica solo.",
    prompt: "Ilustración anime original de fantasía: un joven latino con ropa de oficina y mochila mira asombrado un valle con castillos flotantes, dos lunas y dragones lejanos, luz dorada de atardecer, composición amplia, fondos pintados a mano. Sin texto.",
    v: [
      ["Repartidor", "Ilustración anime original de fantasía: un repartidor con su moto llega a una aldea de casas de madera y tres elfos de aspecto humano, altos, con orejas puntiagudas y túnicas, lo miran sorprendidos. Sin texto."],
      ["Con poderes", "Ilustración anime original de fantasía: una joven con uniforme de cajera descubre que controla [elemento: fuego / agua] en un bosque mágico. Sin texto."],
      ["Andes", "Ilustración anime original de fantasía: una aldea andina de casas de adobe flota entre nubes, alpacas blancas con alas de plumas vuelan alrededor y una joven viajera con poncho en primer plano. Sin texto."],
    ],
  }),
  imagen({
    id: "anime-retrato-personaje", category: ANIME, title: "Tu personaje de anime",
    hook: "Crea un protagonista propio con rasgos latinos y úsalo en toda la serie.",
    prompt: "Retrato de personaje de anime original, de medio cuerpo: una mujer latina adulta de 40 años, de rostro maduro con pómulos marcados, mandíbula definida y líneas de expresión junto a los ojos y la boca, piel morena, cabello negro ondulado y ojos cafés, con chaqueta de jean abotonada hasta el cuello que cubre todo el torso, sonrisa segura, fondo de colores suaves con luz de tarde, trazos limpios. Sin texto.",
    v: [
      ["Hombre", "Retrato de personaje de anime original, dibujo 2D con trazos limpios: un hombre latino adulto de 35 años de piel [tono: morena / trigueña], cabello negro rizado y polo blanco, mirada decidida, fondo liso. Sin texto."],
      ["Villana", "Retrato de villana de anime original: mujer elegante de cabello plateado y ojos rojos, sonrisa fría, fondo oscuro con pétalos. Sin texto."],
      ["Mascota", "Retrato de mascota de anime original, dibujo 2D con trazos limpios y colores planos: una cría de llama de cuello largo, orejas largas y lana blanca, tierna, con bufanda roja, ojos grandes, fondo pastel. Sin texto."],
    ],
  }),
  imagen({
    id: "anime-comida", category: ANIME, title: "Comida peruana en estilo anime",
    hook: "Esa comida brillante de las series de anime, pero con tu plato favorito.",
    prompt: "Ilustración anime de comida muy apetitosa: un plato de lomo saltado humeante, tiras de carne de res con cebolla roja y tomate sobre papas fritas gruesas, con arroz blanco, sobre una mesa de madera, brillos exagerados, vapor y destellos, luz cálida, fondos pintados a mano. Sin texto.",
    v: [
      ["Ceviche", "Ilustración anime de comida: un plato de ceviche, cubos de pescado blanco con cebolla roja y camote naranja, gotas brillantes, fondo de mar, muchos destellos, sin animales ni personajes. Sin texto."],
      ["Postre", "Ilustración anime de comida: un [postre: alfajor de dos galletas pálidas con manjar blanco y azúcar en polvo / picarón con miel] en primer plano, brillos exagerados, luz cálida. Sin texto."],
      ["Puesto callejero", "Ilustración anime: un puesto de anticuchos de noche, brochetas de carne en palitos sobre una parrilla con humo y luces cálidas, cliente de espaldas. Sin texto."],
    ],
  }),
  imagen({
    id: "anime-romance-combi", category: ANIME, title: "Romance en la combi",
    hook: "El clásico encuentro de anime, pero en el transporte de tu ciudad.",
    prompt: "Ilustración anime original de romance: interior de una combi llena de pasajeros sentados en Lima al atardecer, visto desde el pasillo; dos jóvenes latinos de piel morena de pie, separados, agarrados del pasamanos, se miran con timidez mientras la luz dorada entra por la ventana, tonos suaves, fondos pintados a mano. Sin texto.",
    v: [
      ["En la universidad", "Ilustración anime original de romance: dos estudiantes latinos comparten un paraguas al salir de la universidad bajo la lluvia. Sin texto."],
      ["En la playa", "Ilustración anime original de romance: una pareja en un malecón al atardecer con el mar de [ciudad: Lima / Cartagena] detrás. Sin texto."],
      ["En la cafetería", "Ilustración anime original de romance: un barista y una clienta se miran sobre el mostrador de una cafetería cálida. Sin texto."],
    ],
  }),
  imagen({
    id: "anime-portada-serie", category: ANIME, title: "Portada de tu serie de anime",
    hook: "Una portada con título grande para tu primer capítulo y tu perfil.",
    prompt: "Portada vertical de una serie de anime original con un joven latino de chaqueta roja en primer plano y la ciudad de Lima de noche detrás, energía azul. Título grande arriba: \"EL ÚLTIMO BARRIO\". Abajo, etiqueta: \"CAPÍTULO 1\".",
    v: [
      ["Fantasía", "Portada de serie de anime original con una viajera y un castillo flotante. Título grande: \"OTRO MUNDO\". Etiqueta: \"CAPÍTULO 1\"."],
      ["Romance", "Portada de serie de anime original con una pareja bajo la lluvia. Título grande: \"NO TE VAYAS\". Etiqueta: \"CAPÍTULO 2\"."],
      ["Terror", "Portada de serie de anime original con una escuela de noche y una silueta. Título grande: \"NO MIRES ATRÁS\". Etiqueta: \"CAPÍTULO 3\"."],
    ],
  }, "qwen-image"),
  imagen({
    id: "anime-fondo-ciudad", category: ANIME, title: "Fondo de ciudad para tus escenas",
    hook: "Un fondo pintado a mano sin personajes, para narrar encima o poner subtítulos.",
    prompt: "Fondo de anime pintado a mano sin personajes: una calle en pendiente de una ciudad latinoamericana al atardecer, casas de colores, cables de luz, un perro lejano, nubes grandes y luz dorada. Sin texto.",
    v: [
      ["De noche", "Fondo de anime sin personajes: una avenida vacía de noche, sin personas ni carros, con luces reflejadas en el piso mojado, sin letreros. Sin texto."],
      ["Salón de clases", "Fondo de anime sin personajes: un salón de clases vacío con luz de tarde y pizarra en blanco. Sin texto."],
      ["Montaña", "Fondo de anime sin personajes: un valle de los Andes con [clima: niebla / sol], casas pequeñas y nubes grandes. Sin texto."],
    ],
  }),

  // Navidad y temporadas
  imagen({
    id: "navidad-producto", category: TEMPORADAS, title: "Tu producto con ambiente navideño",
    hook: "Convierte la foto de tu producto en foto de campaña navideña sin alquilar estudio.",
    prompt: "Foto publicitaria realista de un frasco de perfume de vidrio sobre una mesa de madera con ramas de pino, luces cálidas desenfocadas y esferas doradas, ambiente navideño elegante. Sin texto ni logos.",
    v: [
      ["Zapatillas", "Foto publicitaria de unas zapatillas junto a un árbol de Navidad con luces cálidas desenfocadas y cajas de regalo. Sin texto ni logos."],
      ["Comida", "Foto publicitaria de un panetón sobre una mesa navideña con taza de chocolate caliente, luces cálidas. Sin texto ni logos."],
      ["Canasta", "Foto publicitaria de una canasta navideña con [producto: chocolates / vinos] y lazo rojo, fondo cálido. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "navidad-familia-latina", category: TEMPORADAS, title: "Navidad en una familia latina",
    hook: "Una escena cálida y creíble de tu país, para anuncios o tu saludo de marca.",
    prompt: "Foto casual sin producción de una familia peruana mestiza de tres generaciones, abuela, padres y niños de piel morena, brindando con tazas de chocolate caliente en la sala sencilla de su casa en Navidad, muebles viejos, paredes con pintura gastada, panetón en la mesa, árbol pequeño de plástico con luces sencillas, ropa común, risas naturales, piel real con poros. Sin texto ni logos.",
    v: [
      ["Medianoche", "Foto casual sin producción de una familia peruana mestiza de piel morena abrazándose a medianoche en Navidad en la sala sencilla de su casa, junto a una ventana con fuegos artificiales afuera, ropa común, piel real con poros. Sin texto ni logos."],
      ["Abuela", "Foto casual sin producción de una abuela peruana mestiza de piel morena sirviendo la cena de Navidad a sus nietos en una casa humilde, mesa sencilla con mantel de plástico, luz cálida, piel real con poros. Sin texto ni logos."],
      ["Barrio", "Foto realista de vecinos latinos en una calle de barrio decorada con luces de Navidad de noche, niños jugando. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "black-friday-afiche", category: TEMPORADAS, title: "Afiche de Black Friday",
    hook: "Precio grande y urgencia: se lee en un segundo y sirve para cualquier tienda.",
    prompt: "Afiche publicitario vertical con fondo negro y destellos dorados. Texto grande arriba: \"BLACK FRIDAY\". En el centro, unos audífonos negros y unas zapatillas de lona blancas y lisas, sin logos. Abajo, en amarillo: \"50% OFF SOLO HOY\".",
    v: [
      ["Moda", "Afiche con fondo negro. Texto grande: \"BLACK FRIDAY\". En el centro, un perchero con ropa. Abajo, en rojo: \"TODO A MITAD DE PRECIO\"."],
      ["Tecnología", "Afiche con fondo azul oscuro. Texto grande: \"BLACK FRIDAY\". En el centro, un celular y una laptop. Abajo, en blanco: \"HASTA 40% OFF\"."],
      ["Última hora", "Afiche con fondo [color: rojo / negro]. Texto grande: \"ÚLTIMAS HORAS\". En el centro, una caja de regalo. Abajo, en amarillo: \"NO TE LO PIERDAS\"."],
    ],
  }, "qwen-image"),
  imagen({
    id: "navidad-tarjeta", category: TEMPORADAS, title: "Tarjeta de saludo de tu negocio",
    hook: "Tu saludo navideño listo para WhatsApp, sin diseñador.",
    prompt: "Tarjeta de saludo vertical con fondo rojo oscuro, ramas de pino y luces doradas en los bordes. Texto grande en blanco en el centro: \"FELIZ NAVIDAD\". Debajo, en dorado: \"Gracias por confiar en nosotros\".",
    v: [
      ["Año Nuevo", "Tarjeta vertical con fondo azul noche y fuegos artificiales dorados. Texto grande: \"FELIZ 2027\". Debajo: \"Vamos por más\"."],
      ["Equipo", "Tarjeta vertical con fondo verde oscuro y luces doradas. Texto grande: \"FELICES FIESTAS\". Debajo: \"De parte de todo el equipo\"."],
      ["Minimalista", "Tarjeta vertical con fondo [color: blanco / crema] y una rama de pino abajo. Arriba, texto grande en verde oscuro: \"FELIZ NAVIDAD\". Sin más adornos."],
    ],
  }, "qwen-image"),
  imagen({
    id: "dia-madre-regalo", category: TEMPORADAS, title: "Regalo para el Día de la Madre",
    hook: "Una imagen tierna y real para vender regalos en la fecha que más mueve al público.",
    prompt: "Foto casual sin producción de una señora peruana mestiza de 55 años, piel morena, emocionada abriendo un regalo con flores en la cocina sencilla de su casa con mayólicas gastadas, su hija la abraza por detrás, luz de mañana, piel real con poros y arrugas. Sin texto ni logos.",
    v: [
      ["Desayuno", "Foto casual sin producción de una hija joven de pie entregando una bandeja de desayuno con flores a su madre peruana mestiza de 50 años sentada en la cama, cuarto sencillo, luz de mañana. Sin texto ni logos."],
      ["Abuelita", "Foto casual sin producción de una abuelita peruana mestiza de piel morena rodeada de sus hijos adultos con un pastel en la mesa, sala sencilla. Sin texto ni logos."],
      ["Producto", "Foto publicitaria de una caja de regalo lisa con [regalo: un frasco de perfume sin etiqueta / joyas] y flores rosadas sobre una mesa clara. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "fiestas-patrias-peru", category: TEMPORADAS, title: "Fiestas Patrias en tu negocio",
    hook: "Rojo y blanco en tu local para campañas de julio. Cambia el país en las variaciones.",
    prompt: "Foto realista de una pequeña tienda de barrio en Lima decorada para Fiestas Patrias con banderines rojos y blancos, la dueña sonríe en la puerta, cielo soleado de julio, ambiente festivo. Sin texto ni logos legibles.",
    v: [
      ["Comida", "Foto publicitaria de un plato de anticuchos, brochetas de carne en palitos con papa y choclo, con adornos rojos y blancos en una mesa de fiesta, luz cálida. Sin texto ni logos."],
      ["Colombia", "Foto realista de una tienda de barrio en Colombia decorada con banderines amarillos, azules y rojos para el 20 de julio. Sin texto ni logos."],
      ["México", "Foto realista de una fonda mexicana con mesas en la vereda y clientes comiendo, decorada con papel picado de banderines verdes, blancos y rojos colgados, para el 15 de septiembre. Sin texto ni logos."],
    ],
  }),
  imagen({
    id: "san-valentin-pareja", category: TEMPORADAS, title: "San Valentín en tu negocio",
    hook: "Una escena romántica y creíble para vender regalos, flores o cenas en febrero.",
    prompt: "Foto casual sin producción de una pareja peruana mestiza, ambos de 30 años y piel morena, riendo en una mesa de un restaurante pequeño de barrio en San Valentín, una rosa roja y velas en la mesa, luz cálida, piel real con poros, ambiente sencillo. Sin texto ni logos.",
    v: [
      ["Flores", "Foto casual sin producción de un joven peruano mestizo de piel morena recogiendo un ramo de rosas en una florería de barrio, la vendedora sonríe. Sin texto ni logos."],
      ["Producto", "Foto publicitaria de una caja de [regalo: chocolates / perfume] con pétalos de rosa sobre una mesa, luz cálida. Sin texto ni logos."],
      ["Años juntos", "Foto realista de una pareja de ancianos latinos, un señor y una señora con vestido, ambos de 70 años, con canas y arrugas, vistos de frente, tomados de la mano en un parque al atardecer. Sin texto ni logos."],
    ],
  }),
];

export const VIDEOS_ANIME_TEMPORADAS_POR_PROBAR: Idea[] = [
  video({
    id: "anime-opening", category: ANIME, title: "Opening de tu propia serie",
    hook: "Unos segundos con energía de opening para presentar a tu personaje.",
    prompt: "Animación anime original: un joven latino con chaqueta roja corre por una azotea de la ciudad al amanecer y salta hacia la cámara, el cielo se llena de luz dorada y pétalos. Música de rock enérgica instrumental. Sin voz, sin subtítulos ni texto.",
    v: [
      ["Grupo", "Animación anime original: cuatro amigos caminan hacia la cámara en una calle al atardecer con viento fuerte. Música de rock instrumental. Sin texto."],
      ["Chica", "Animación anime original: una joven gira con su cabello al viento en un puente sobre un río de [ciudad: Arequipa / Medellín]. Sin texto."],
      ["Fantasía", "Animación anime original: una viajera avanza por un valle con castillos flotantes y la cámara se eleva. Sin texto."],
    ],
  }, "veo-fast", 8, "acercamiento"),
  video({
    id: "anime-transformacion", category: ANIME, title: "Transformación de poder",
    hook: "El momento que todos comparten: el personaje despierta su poder.",
    prompt: "Animación anime original de acción: un joven latino cierra los ojos en una calle de noche, su cabello se levanta y una energía azul lo envuelve, las piedras flotan a su alrededor, grita con fuerza. Música tensa que crece. Sin subtítulos ni texto.",
    v: [
      ["Oficinista", "Animación anime original: un oficinista cansado aprieta el puño frente a su jefe y una energía dorada lo envuelve, con humor. Sin texto."],
      ["Abuela", "Animación anime original: una abuelita tierna se transforma en guerrera con energía [color: roja / verde] en su cocina, con humor. Sin texto."],
      ["Llama", "Animación anime original: una llama pequeña se transforma en una criatura gigante y brillante en los Andes. Sin texto."],
    ],
  }, "veo-fast", 6, "orbita"),
  video({
    id: "anime-voz-latina", category: ANIME, title: "Escena de anime con voz en español",
    hook: "Diálogo corto con voz: se siente como un doblaje latino.",
    prompt: "Animación anime original de drama: una joven de cabello negro corto en una estación de noche se voltea hacia la cámara con lágrimas y dice con voz quebrada en español latino: \"Nunca me dijiste la verdad\". Sonido de tren lejano. Sin subtítulos ni texto.",
    v: [
      ["Rival", "Animación anime original: un rival sonríe bajo la lluvia y dice en español latino: \"Esto recién empieza\". Sin subtítulos ni texto."],
      ["Comedia", "Animación anime original: una estudiante grita en su cuarto en español latino: \"¡Otra vez me quedé dormida!\". Sin subtítulos ni texto."],
      ["Mentor", "Animación anime original: un anciano sabio dice en español latino: \"La fuerza no está en tus puños\". Sin subtítulos ni texto."],
    ],
  }, "ltx-25", 8, "acercamiento"),
  video({
    id: "navidad-saludo-negocio", category: TEMPORADAS, title: "Saludo navideño de tu negocio",
    hook: "Una persona de tu equipo deseando felices fiestas: cercano y listo para enviar.",
    prompt: "Una dueña de negocio latina de 40 años en su tienda decorada con luces de Navidad mira a la cámara y dice con voz cálida en español latino: \"Gracias por acompañarnos este año. Feliz Navidad\". Luz cálida, cámara en mano. Sin subtítulos ni logos.",
    v: [
      ["Equipo", "Un equipo de cinco personas latinas en su local dice a coro: \"¡Felices fiestas!\" con gorros navideños. Sin subtítulos ni logos."],
      ["Restaurante", "Un chef latino en su restaurante decorado dice: \"Te esperamos esta Navidad\". Luz cálida. Sin subtítulos ni logos."],
      ["Año Nuevo", "Una persona latina con fuegos artificiales detrás dice: \"Que este año venga con todo\". Sin subtítulos ni logos."],
    ],
  }, "ltx-25", 5, "fija"),
  video({
    id: "navidad-producto-giro", category: TEMPORADAS, title: "Producto girando entre luces navideñas",
    hook: "Un anuncio de temporada sin voz, listo para tus historias.",
    prompt: "Un frasco de perfume gira lentamente sobre una base de madera con ramas de pino y nieve artificial, luces doradas desenfocadas detrás, la cámara orbita alrededor. Música navideña suave instrumental, sin voz. Sin texto ni logos.",
    v: [
      ["Zapatillas", "Unas zapatillas giran sobre una caja de regalo roja con luces desenfocadas, música navideña suave. Sin texto ni logos."],
      ["Panetón", "Un panetón gira sobre una mesa navideña con vapor de chocolate caliente al lado. Sin texto ni logos."],
      ["Joyas", "Un [joya: collar / reloj] gira dentro de una caja de terciopelo con brillo dorado. Sin texto ni logos."],
    ],
  }, "ltx-25", 5, "orbita"),
  video({
    id: "black-friday-hook", category: TEMPORADAS, title: "Gancho de oferta de Black Friday",
    hook: "Una vendedora avisa la oferta con urgencia: directo para anuncios.",
    prompt: "Una vendedora latina de 28 años en su tienda de ropa mira a la cámara con emoción y dice en español latino: \"Solo por hoy, todo a mitad de precio. Corre\". Percheros detrás, cámara en mano, luz de tienda. Sin subtítulos ni logos.",
    v: [
      ["Tecnología", "Un vendedor latino en una tienda de celulares dice: \"Este precio no vuelve hasta el otro año\". Sin subtítulos ni logos."],
      ["Última hora", "Una emprendedora latina en su casa con cajas detrás dice: \"Me quedan [cantidad: diez / cinco], escríbeme ahora\". Sin subtítulos ni logos."],
      ["Comida", "Un dueño de restaurante latino dice: \"Hoy, dos por uno en todo el menú\". Sin subtítulos ni logos."],
    ],
  }, "ltx-25", 5, "fija"),
];
