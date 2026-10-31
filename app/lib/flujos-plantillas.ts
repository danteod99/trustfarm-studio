// Recetas de flujo listas para crear con un clic en /flujos (el usuario puede editarlas antes de guardar).
import type { FlowStep } from "@/app/lib/flujos-validar";

export interface FlowTemplate {
  id: string;
  emoji: string;
  name: string;
  pitch: string;
  steps: FlowStep[];
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "brainrot",
    emoji: "🦙",
    name: "Brainrot con voz",
    pitch: "Imagen del personaje absurdo → video con su nombre cantado.",
    steps: [
      {
        title: "Personaje",
        model: "z-image",
        aspect: "9:16",
        input: "none",
        prompt:
          "Render 3D hiperrealista y absurdo estilo meme brainrot: un cuy con cuerpo de cafetera dorada echando vapor en una calle de Barranco de noche, luces de neón, texturas brillantes, composición vertical.",
      },
      {
        title: "Video con voz",
        model: "ltx-25",
        aspect: "9:16",
        duration: 5,
        resolution: "720p",
        input: "previous",
        prompt:
          "El personaje cobra vida con energía exagerada: echa vapor, baila y mira a la cámara. Una voz masculina dramática canta: «¡Cuycafetero Vaporino!». Sonido de vapor y música absurda. Sin subtítulos.",
      },
    ],
  },
  {
    id: "producto",
    emoji: "🛍️",
    name: "Producto que se vende",
    pitch: "Foto de estudio del producto → video con voz que lo presenta.",
    steps: [
      {
        title: "Foto de producto",
        model: "z-image",
        aspect: "9:16",
        input: "none",
        prompt:
          "Foto publicitaria de alta gama de una botella de perfume de vidrio negro sobre roca volcánica mojada, gotas de agua, luz lateral dramática, fondo azul desenfocado, sin logos.",
      },
      {
        title: "Video del producto",
        model: "ltx-25",
        aspect: "9:16",
        duration: 5,
        resolution: "720p",
        motion: "orbita",
        input: "previous",
        prompt:
          "La cámara gira suave alrededor del producto, las gotas brillan con la luz. Una voz femenina elegante dice: «El regalo que no olvidarán». Música suave de fondo.",
      },
    ],
  },
  {
    id: "maquina",
    emoji: "🤖",
    name: "Máquina que genera dinero",
    pitch: "La máquina en un lugar real → video funcionando con voz.",
    steps: [
      {
        title: "Máquina en el mall",
        model: "qwen-image",
        aspect: "9:16",
        input: "none",
        prompt:
          "Foto realista vertical de una máquina de autoservicio lava cascos futurista en un centro comercial de Lima, cuerpo negro brillante con paneles azul eléctrico y luces LED cian, cámara de vidrio con un casco dentro iluminado con luz UV azul, gente caminando desenfocada, sin logos.",
      },
      {
        title: "Máquina funcionando",
        model: "ltx-25",
        aspect: "9:16",
        duration: 5,
        resolution: "720p",
        motion: "acercamiento",
        input: "previous",
        prompt:
          "Dentro de la cámara de vidrio el casco gira mientras lo limpian con luz UV azul y vapor. Voz masculina peruana entusiasta dice: «Este negocio cobra mientras tú duermes». Sonido ambiente de centro comercial.",
      },
    ],
  },
  {
    id: "frutinovela",
    emoji: "🍓",
    name: "Frutinovela en 3 pasos",
    pitch: "Personaje → escena dramática con el mismo personaje → animarla con diálogo.",
    steps: [
      {
        title: "Personaje",
        model: "qwen-image",
        aspect: "9:16",
        input: "none",
        prompt:
          "Retrato de cuerpo entero de una fresa con rasgos humanos, ojos grandes expresivos, vestido rojo y aretes dorados, fondo neutro de estudio, animación 3D cinematográfica. Sin texto.",
      },
      {
        title: "Escena",
        model: "qwen-image",
        aspect: "9:16",
        input: "previous",
        prompt:
          "La misma fresa de la imagen de referencia, con el mismo rostro, vestido y aretes, llorando mientras lee un mensaje en el celular en la cocina de su casa, iluminación dramática de telenovela, animación 3D.",
      },
      {
        title: "Animar con diálogo",
        model: "ltx-25",
        aspect: "9:16",
        duration: 5,
        resolution: "720p",
        motion: "acercamiento",
        input: "previous",
        prompt:
          "La fresa levanta la mirada del celular, con lágrimas, y dice con voz dramática de telenovela: «¿Cómo pudiste hacerme esto?». Música de suspenso. Sin subtítulos.",
      },
    ],
  },
];
