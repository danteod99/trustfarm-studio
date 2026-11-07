// Plantilla "Foto realista LATAM": frases medidas en imágenes de prueba con Z-Image y Qwen 2.1.
// «Foto de celular» metía un teléfono en la escena, así que aquí se evita.
// Las personas van en Qwen: en Z-Image las mujeres salían mucho mayores desde los 30 años.
// El texto es fijo a propósito: no pasa por trustPrompt para conservar las frases medidas.
import type { TemplateGroup } from "@/app/lib/templates";

const FOTO_CASUAL = "Foto casual sin producción, luz natural. Sin texto.";

export const FOTO_LATAM: TemplateGroup = {
  id: "foto-latam",
  emoji: "📸",
  name: "Foto realista LATAM",
  pitch: "Fotos con aire latinoamericano: personas comunes, barrios, negocios y casas habitadas.",
  notice: "Para personas, usa solo edades adultas. Revisa cada resultado antes de publicarlo.",
  steps: [
    {
      id: "persona",
      title: "1. Persona (20 a 50 años)",
      kind: "image",
      model: "qwen-image",
      aspect: "9:16",
      prompt: `[mujer latina / hombre latino] de [edad adulta: 20 a 50] años, piel morena, rostro redondo, ropa casual, [encuadre y lugar: retrato de medio cuerpo en la puerta de su casa]. ${FOTO_CASUAL}`,
      tip: "Puede verse unos años mayor, sobre todo desde los 45. Este modelo suele acercar el encuadre, así que pide el plano y la ropa que necesitas.",
    },
    {
      id: "calle",
      title: "2. Calle o barrio",
      kind: "image",
      model: "z-image",
      aspect: "9:16",
      prompt: `[lugar: calle de barrio / esquina con motos / carrito de comida en la vereda], en Latinoamérica, sin personas en primer plano. ${FOTO_CASUAL}`,
      tip: "Describe lo que se ve: fachadas, cables, veredas. Los carteles pueden salir con letras falsas.",
    },
    {
      id: "negocio",
      title: "3. Negocio",
      kind: "image",
      model: "z-image",
      aspect: "9:16",
      prompt: `[negocio: tienda de barrio con mostrador / puesto de frutas en mercado techado], en Latinoamérica, sin personas en primer plano. ${FOTO_CASUAL}`,
      tip: "Revisa etiquetas y productos: pueden salir letras falsas, frutas raras o envases repetidos.",
    },
    {
      id: "interior",
      title: "4. Interior de casa",
      kind: "image",
      model: "z-image",
      aspect: "9:16",
      prompt: `[ambiente: cocina / sala / dormitorio] de una casa de clase media en Latinoamérica: [objetos del ambiente: estufa de gas blanca, piso de cerámica, ollas de aluminio], muebles usados de distintos juegos, paredes con marcas, objetos de uso diario, algo desordenado, casa habitada, no es una foto de catálogo, sin personas. ${FOTO_CASUAL}`,
      tip: "Usa objetos del ambiente que elegiste: en un dormitorio, cama y ropero. Si el desgaste se ve exagerado, quita «paredes con marcas».",
    },
  ],
};
