// Personajes de GTA 6 para clips virales (pedido de Dante, 11-11-2026). El juego sale el 19-11-2026.
// Tendencias vistas hoy: la pareja Lucia y Jason (discusiones y "widows" en TikTok) y el arte de fans con IA.
// Son homenajes de fans hechos con IA: sin logos, sin texto y sin armas. NO imitan "filtraciones" ni gameplay
// falso (esos videos engañaron a millones y Rockstar no los autoriza). Los prompts describen el aspecto en
// vez de depender de que el modelo "conozca" al personaje.
import type { Idea, Variacion } from "./ideas.ts";

const CATEGORIA = "Personajes GTA 6";
const FUENTE = "Pedido directo de Dante + tendencia TikTok 11-11-2026: Lucia y Jason (parejas, 'widows') y arte de fans de GTA 6 (estreno 19-11-2026). Homenaje de fans, no material oficial.";

type Base = Pick<Idea, "id" | "title" | "hook" | "prompt"> & { v: [string, string][] };

const variaciones = (v: [string, string][]): Variacion[] => v.map(([titulo, prompt]) => ({ titulo, prompt }));

function imagen({ v, ...b }: Base): Idea {
  return { ...b, category: CATEGORIA, kind: "image", model: "z-image", aspect: "9:16", image: `/showcase/idea-${b.id}.jpg`, variaciones: variaciones(v), fuente: FUENTE, tendencia: true };
}

const FIN = "Estilo ilustración cinematográfica de videojuego, colores neón rosa y turquesa. Sin texto, sin logos, sin armas.";

export const IDEAS_GTA6: Idea[] = [
  imagen({
    id: "gta6-lucia-playa", title: "Lucia en la playa de Vice City",
    hook: "La protagonista que todos buscan: una joven latina de trenza oscura y tatuajes en un atardecer neón.",
    prompt: `Retrato de cuerpo medio de una joven latina de unos 25 años, trenza oscura larga, tatuajes pequeños en el brazo, top deportivo y shorts de mezclilla, mirando a cámara con media sonrisa segura, de pie en una playa tropical de Florida al atardecer, palmeras y un malecón con luces neón rosa y turquesa detrás, un convertible clásico estacionado al fondo. ${FIN}`,
    v: [
      ["Con overol naranja", `Retrato de una joven latina de unos 25 años, trenza oscura y tatuajes pequeños, con un overol naranja de uniforme abierto en la cintura sobre un top blanco, apoyada en una cerca de alambre al amanecer en una carretera rodeada de pantanos y palmeras, expresión decidida. ${FIN}`],
      ["Selfie en Ocean Drive", `Selfie a mano alzada de una joven latina de unos 25 años, trenza oscura y tatuajes pequeños, gafas de sol en la cabeza, sonriendo a la cámara en una avenida costera de noche con edificios art déco iluminados en neón rosa y turquesa. ${FIN}`],
      ["Conduciendo un convertible", `Joven latina de unos 25 años, trenza oscura, tatuajes pequeños, conduciendo un convertible clásico rojo por una avenida frente al mar al atardecer, pelo al viento, mirando hacia la cámara, palmeras pasando. ${FIN}`],
      ["En la lancha", `Joven latina de unos 25 años, trenza oscura, tatuajes pequeños y chaleco salvavidas abierto, al timón de una lancha rápida en un canal de manglares al amanecer, salpicaduras de agua, mirada concentrada. ${FIN}`],
    ],
  }),
  imagen({
    id: "gta6-jason-muelle", title: "Jason en el muelle",
    hook: "El otro protagonista: un tipo curtido de barba corta y camisa abierta que vive de trabajos en los Cayos.",
    prompt: `Retrato de cuerpo medio de un hombre blanco de unos 30 años, pelo corto oscuro, barba de dos días, piel bronceada, camiseta sin mangas gris y gorra, sentado en el borde de un muelle de madera de un astillero al atardecer, lanchas amarradas detrás, cielo naranja y turquesa, expresión relajada con una media sonrisa. ${FIN}`,
    v: [
      ["En la moto acuática", `Hombre blanco de unos 30 años, pelo corto oscuro y barba corta, sin camisa y con gafas de sol, sobre una moto acuática lanzando una gran ola en un canal soleado, sonriendo a la cámara. ${FIN}`],
      ["Camisa hawaiana", `Hombre blanco de unos 30 años, pelo corto oscuro y barba corta, con camisa hawaiana abierta, apoyado en la barra de un bar de playa con luces neón de noche, tomando un cóctel y mirando de reojo. ${FIN}`],
      ["Lancha de noche", `Hombre blanco de unos 30 años, pelo corto oscuro y barba corta, al volante de una lancha en un canal de noche, luces de la ciudad reflejadas en el agua, expresión seria y concentrada. ${FIN}`],
      ["Con uniforme", `Hombre blanco de unos 30 años con corte militar y barba corta, camiseta verde oliva y placas colgando, de pie frente a una pared de ladrillos pintada con grafiti de colores, mirando serio a cámara. ${FIN}`],
    ],
  }),
  imagen({
    id: "gta6-pareja-pantalla-carga", title: "Lucia y Jason: pantalla de carga",
    hook: "La pareja que divide TikTok, en un afiche tipo pantalla de carga que todos quieren compartir.",
    prompt: `Ilustración vertical tipo pantalla de carga de videojuego: una joven latina de trenza oscura y un hombre blanco de barba corta, espalda con espalda, mirando a cámara con confianza, sobre un fondo de atardecer tropical con palmeras, skyline de rascacielos y un convertible clásico, composición de afiche con mucho espacio libre arriba, colores neón rosa y turquesa. Sin texto, sin logos, sin armas.`,
    v: [
      ["De espaldas al skyline", `Ilustración tipo pantalla de carga: una pareja, ella con trenza oscura y él con barba corta, vistos de espaldas mirando el skyline iluminado de una ciudad tropical al anochecer, brillos neón. ${FIN}`],
      ["En el convertible", `Ilustración tipo afiche: una pareja joven, ella con trenza oscura y él con barba corta, en un convertible clásico con el mar al fondo, ella al volante riendo y él con el brazo fuera del auto, atardecer. ${FIN}`],
      ["En la azotea", `Ilustración tipo afiche: una pareja joven, ella con trenza oscura y él con barba corta, sentados en el borde de una azotea con luces de neón de la ciudad abajo, hombro con hombro, de noche. ${FIN}`],
      ["Lluvia de billetes", `Ilustración tipo afiche: una pareja joven, ella con trenza oscura y él con barba corta, riendo bajo una lluvia de billetes sobre una avenida costera iluminada, palmeras, estilo cómic cinematográfico. ${FIN}`],
    ],
  }),
  imagen({
    id: "gta6-tu-en-gta6", title: "Tú como personaje de GTA 6",
    hook: "El formato que todos copian: tu propio personaje en una pantalla de carga de Vice City.",
    prompt: `Ilustración vertical tipo pantalla de carga de videojuego de crimen en una ciudad tropical, protagonizada por [persona: una mujer joven de pelo largo / un hombre joven con barba / una pareja sonriente], con ropa de verano y gafas de sol, posando con confianza frente a un convertible clásico, palmeras, mar y rascacielos al atardecer, composición de afiche con espacio libre arriba. ${FIN}`,
    v: [
      ["Jefe de barrio", `Ilustración tipo pantalla de carga: [persona: un hombre de unos 30 años / una mujer de unos 30 años], con chaqueta de cuero blanca y cadena dorada, de pie frente a un club con luces neón, aire de jefe de barrio, atardecer tropical. ${FIN}`],
      ["Taxista de Leonida", `Ilustración tipo pantalla de carga: [persona: un hombre de unos 40 años / una mujer de unos 40 años], con camisa floreada apoyado en un taxi amarillo clásico en una avenida de palmeras, sonriendo. ${FIN}`],
      ["Influencer de la ciudad", `Ilustración tipo pantalla de carga: [persona: una chica joven / un chico joven] de influencer, con celular en mano grabándose frente a una playa neón, gafas rosa y ropa de moda, ambiente de verano. ${FIN}`],
      ["Policía costero", `Ilustración tipo pantalla de carga: [persona: un hombre de unos 35 años / una mujer de unos 35 años] con uniforme de patrulla costera y gafas de sol, de pie junto a una lancha de patrulla en un muelle al amanecer. ${FIN}`],
    ],
  }),
  imagen({
    id: "gta6-hombre-florida", title: "Hombre de Florida (NPC)",
    hook: "Los NPC más absurdos del juego: el 'Florida Man' con su caimán es contenido garantizado.",
    prompt: `Foto realista estilizada de un hombre de mediana edad, bronceado, panza, camisa floreada abierta, bermudas y chancletas, sonriendo orgulloso al volante de un convertible rosa viejo con un caimán pequeño sentado en el asiento del copiloto, avenida costera con palmeras al atardecer, escena absurda y divertida. Sin texto, sin logos, sin armas.`,
    v: [
      ["En moto acuática con tormenta", `Hombre de mediana edad, bronceado, con camisa floreada, sobre una moto acuática en un canal con una tormenta tropical detrás y un pelícano posado en el manubrio, expresión de total tranquilidad. Estilo realista, sin texto ni logos.`],
      ["Disfrazado de pirata", `Hombre de mediana edad con disfraz de pirata y loro en el hombro, empujando un carrito de supermercado lleno de botellas de agua en un estacionamiento bajo un sol fuerte, expresión seria. Estilo realista, sin texto ni logos.`],
      ["Pescando en la calle", `Hombre de mediana edad con sombrero de paja pescando con caña en un charco de una calle inundada de ciudad tropical, con un flamenco rosa mirando a su lado y autos pasando. Estilo realista, sin texto ni logos.`],
      ["Barbacoa en el techo", `Hombre de mediana edad con delantal haciendo una parrillada en el techo de una casa rodante junto a la playa, con luces de neón y palmeras, sonriendo a la cámara. Estilo realista, sin texto ni logos.`],
    ],
  }),
  imagen({
    id: "gta6-banda-cayos", title: "La banda de los Cayos",
    hook: "Un equipo de cuatro con carácter, estilo afiche de película de crimen en el sol de Florida.",
    prompt: `Afiche vertical de cuatro personajes de una banda de crimen tropical posando juntos frente a un astillero: un traficante veterano de pelo canoso y camisa hawaiana, un joven delgado con audífonos y radios, una mujer latina de trenza oscura con overol naranja anudado a la cintura y un hombre de barba corta con camiseta gris, luz dorada de atardecer, lanchas atrás. ${FIN}`,
    v: [
      ["En el bar de playa", `Afiche vertical de cuatro personajes riendo en torno a una mesa de un bar de playa de noche, uno canoso con camisa hawaiana, uno joven con audífonos, una mujer con trenza oscura y un hombre de barba corta, cervezas y luces neón. ${FIN}`],
      ["En el astillero al amanecer", `Afiche vertical de cuatro personajes de pie sobre un muelle al amanecer, uno canoso con camisa hawaiana, uno joven con audífonos y radios, una mujer con trenza oscura y un hombre con barba corta, niebla sobre el agua. ${FIN}`],
      ["En la camioneta", `Afiche vertical de cuatro personajes apretados dentro de una camioneta pickup abierta, uno canoso con camisa hawaiana, uno joven con audífonos, una mujer con trenza oscura y un hombre con barba corta, carretera de palmeras y atardecer. ${FIN}`],
      ["Foto de grupo borrosa", `Foto de grupo con efecto de cámara desechable de cuatro amigos de una banda tropical, uno canoso con camisa hawaiana, uno joven con audífonos, una mujer con trenza oscura y un hombre de barba corta, flash directo, sonrisas, fondo de playa de noche. Sin texto, sin logos, sin armas.`],
    ],
  }),
  imagen({
    id: "gta6-magnate-lujo", title: "El magnate de Vice City",
    hook: "El empresario que pasó de la calle al lujo: mansión, estudio de grabación y mucho brillo.",
    prompt: `Retrato de un hombre afroamericano de unos 50 años, elegante, con traje blanco, cadenas de oro y gafas de sol, sentado en un sillón de cuero en una mansión con piscina y vista a la ciudad neón de noche, sonriendo con seguridad, un auto deportivo detrás. ${FIN}`,
    v: [
      ["En el estudio de grabación", `Hombre afroamericano de unos 50 años, con traje blanco y cadenas de oro, de pie detrás de una consola de estudio de grabación con luces rosas y azules, discos de oro en la pared, mirando a cámara. ${FIN}`],
      ["Sobre el yate", `Hombre afroamericano de unos 50 años, con traje blanco y gafas de sol, brindando con una copa en la cubierta de un yate al atardecer frente a una ciudad tropical. ${FIN}`],
      ["En su club", `Hombre afroamericano de unos 50 años, con traje blanco y cadenas de oro, saludando a la gente en la entrada de un club nocturno con luces de neón rosa y turquesa. ${FIN}`],
      ["Dúo de música urbana", `Dos jóvenes artistas de música urbana, mujeres con ropa llamativa y joyas, posando de pie sobre un convertible rosa frente a un estudio de grabación iluminado de neón, estilo portada de álbum. ${FIN}`],
    ],
  }),
  imagen({
    id: "gta6-atraco-crew", title: "Crew de atraco en cámara lenta",
    hook: "El momento más reconocible del juego, en un encuadre cinematográfico sin una sola arma.",
    prompt: `Escena cinematográfica de cuatro personas con ropa deportiva oscura y pasamontañas bajados al cuello, corriendo hacia una furgoneta fuera de un banco con mochilas llenas de billetes cayendo al aire, luces rojas y azules reflejadas en el pavimento mojado, atmósfera de noche tropical, movimiento congelado. Sin armas. Sin texto, sin logos.`,
    v: [
      ["Billetes por el aire", `Escena cinematográfica de una mochila abierta que lanza billetes al aire en una calle de noche con neón, personas corriendo borrosas al fondo hacia una furgoneta, pavimento mojado. Sin armas. Sin texto, sin logos.`],
      ["Huida en lancha", `Escena cinematográfica de una lancha rápida saltando una ola en un canal de noche con cuatro personas con mochilas, luces de una ciudad tropical atrás, salpicaduras congeladas. Sin armas. Sin texto, sin logos.`],
      ["Reunión del plan", `Escena cinematográfica de cuatro personas inclinadas sobre un plano extendido en un garaje poco iluminado, luz verde y rosa, tensión de equipo antes del golpe. Sin armas. Sin texto, sin logos.`],
      ["El auto de escape", `Escena cinematográfica de una furgoneta negra derrapando en una curva frente a palmeras, humo de neumáticos iluminado por luces rojas y azules, atardecer. Sin armas. Sin texto, sin logos.`],
    ],
  }),
];

// Videos (11-11-2026): las 3 portadas animadas con LTX-2.5 (5 s, 720p, voz). Dante dio el OK tras verlos.
function video(b: Pick<Idea, "id" | "title" | "hook" | "prompt"> & { v: [string, string][]; portada: string }, motion: string): Idea {
  const { v, portada, ...resto } = b;
  return {
    ...resto, category: CATEGORIA, kind: "video", model: "ltx-25", aspect: "9:16", duration: 5, resolution: "720p", motion,
    image: `/showcase/idea-${portada}.jpg`, video: `/showcase/idea-${resto.id}.mp4`,
    variaciones: variaciones(v), fuente: FUENTE, tendencia: true,
  };
}

export const VIDEOS_GTA6: Idea[] = [
  video({
    id: "gta6-video-lucia-playa", portada: "gta6-lucia-playa", title: "Lucia camina por la playa (video)",
    hook: "El clip que abre cualquier fan edit: la protagonista hacia la cámara al atardecer, con música synthwave.",
    prompt: "Ilustración animada de una joven latina de unos 25 años, trenza oscura larga, tatuajes pequeños, top blanco y shorts turquesa, caminando despacio hacia la cámara por la orilla de una playa tropical al atardecer, el viento mueve su trenza, olas suaves, palmeras y un convertible rosa al fondo, neón rosa y turquesa. Cámara lenta con un leve acercamiento. Sonido ambiente de olas y música synthwave suave. Sin texto, sin logos, sin armas.",
    v: [
      ["De noche con neón", "Ilustración animada de una joven latina de unos 25 años, trenza oscura y tatuajes pequeños, caminando hacia la cámara por una avenida costera de noche con edificios art déco en neón rosa y turquesa, brillos en el pavimento. Cámara lenta, música synthwave. Sin texto, sin logos, sin armas."],
      ["Gira y sonríe", "Ilustración animada de una joven latina de unos 25 años, trenza oscura y tatuajes pequeños, de espaldas en la playa al atardecer que gira la cabeza, sonríe a la cámara y dice en español: «Bienvenidos a Vice City». Música synthwave suave. Sin texto, sin logos, sin armas."],
      ["Bajo la lluvia", "Ilustración animada de una joven latina de unos 25 años, trenza oscura y tatuajes pequeños, caminando hacia la cámara bajo una lluvia fina en una avenida de neón rosa y turquesa de noche, charcos que reflejan las luces. Cámara lenta, música synthwave. Sin texto, sin logos, sin armas."],
    ],
  }, "acercamiento"),
  video({
    id: "gta6-video-pareja-pantalla-carga", portada: "gta6-pareja-pantalla-carga", title: "Lucia y Jason giran a cámara (video)",
    hook: "La pareja que divide TikTok, con el atardecer y las luces de neón moviéndose detrás.",
    prompt: "Ilustración animada de una joven latina de trenza oscura y un hombre blanco de barba corta, espalda con espalda, que giran la cabeza hacia la cámara con confianza mientras el sol se pone y las luces de neón de la ciudad parpadean detrás, palmeras y un convertible clásico, leve movimiento de cámara hacia adelante. Una voz de mujer joven latina dice en español: «Vamos, que esto recién empieza». Música synthwave suave. Sin texto, sin logos, sin armas.",
    v: [
      ["Se miran entre sí", "Ilustración animada de una joven latina de trenza oscura y un hombre blanco de barba corta, espalda con espalda, que se miran de reojo y sonríen mientras las luces de neón de la ciudad brillan al atardecer. Música synthwave suave. Sin texto, sin logos, sin armas."],
      ["Frase de él", "Ilustración animada de una joven latina de trenza oscura y un hombre blanco de barba corta, espalda con espalda, él gira hacia la cámara y dice en español con voz grave: «Todo va a salir bien». Atardecer neón, palmeras. Sin texto, sin logos, sin armas."],
      ["En la azotea", "Ilustración animada de una joven latina de trenza oscura y un hombre blanco de barba corta, sentados en el borde de una azotea con las luces de neón de la ciudad abajo, que giran hacia la cámara y ella dice en español: «Qué vista, ¿no?». De noche, música synthwave. Sin texto, sin logos, sin armas."],
    ],
  }, "acercamiento"),
  video({
    id: "gta6-video-hombre-florida", portada: "gta6-hombre-florida", title: "Hombre de Florida y su copiloto (video)",
    hook: "Un hombre con camisa floreada, un convertible rosa y un caimán de copiloto: humor listo para viralizar.",
    prompt: "Video realista estilizado de un hombre de mediana edad, bronceado, con camisa floreada abierta, que mira a cámara sonriendo con orgullo y acaricia a un pequeño caimán que mueve la cola en el asiento del copiloto de un convertible rosa viejo que avanza despacio por una avenida de palmeras al atardecer. Una voz masculina dice en español con tono muy tranquilo: «Tranquilo, es mi copiloto». Sonido ambiente de playa y motor suave. Sin texto, sin logos, sin armas.",
    v: [
      ["Con un flamenco", "Video realista estilizado de un hombre de mediana edad con camisa floreada al volante de un convertible rosa viejo, con un flamenco rosa de pasajero que gira el cuello hacia la cámara, avenida de palmeras al atardecer. Una voz masculina dice en español: «No pregunten». Sin texto, sin logos, sin armas."],
      ["Semáforo en rojo", "Video realista estilizado de un hombre de mediana edad con camisa floreada en un convertible rosa detenido en un semáforo, con un caimán pequeño en el asiento del copiloto que abre la boca como si bostezara, él lo mira y dice en español: «Yo también tengo sueño». Sin texto, sin logos, sin armas."],
      ["Con un pelícano", "Video realista estilizado de un hombre de mediana edad con camisa floreada al volante de un convertible rosa viejo, con un pelícano posado en el parabrisas que lo mira fijo, avenida costera al atardecer, él lo mira y dice en español: «Es mi sindicato». Sin texto, sin logos, sin armas."],
    ],
  }, "fija"),
];
