// Plantilla "Foto realista LATAM": frases medidas en imágenes de prueba con Z-Image y Qwen 2.1.
// «Foto de celular» metía un teléfono en la escena, así que aquí se evita.
// Cada rango de edad usa el modelo que mejor la respetó: Z-Image hasta 30 años, Qwen desde 35.
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
      id: "persona-joven",
      title: "1. Persona joven",
      kind: "image",
      model: "z-image",
      aspect: "9:16",
      prompt: `[mujer morena / hombre moreno] de [edad: 18 a 30] años, persona común, [encuadre y lugar: retrato de medio cuerpo en la puerta de su casa]. ${FOTO_CASUAL}`,
      tip: "Entre 18 y 30 años, Trust Foto Flash respeta bien la edad. Si necesitas 35 o más, usa el paso 2.",
    },
    {
      id: "persona-adulta",
      title: "2. Persona adulta",
      kind: "image",
      model: "qwen-image",
      aspect: "9:16",
      prompt: `[mujer latina / hombre latino] de [edad: 35 a 50] años, piel morena, rostro redondo, ropa casual, [encuadre y lugar: retrato de medio cuerpo en la puerta de su casa]. ${FOTO_CASUAL}`,
      tip: "Trust Foto respeta mejor la edad desde los 35, aunque a los 45 o más puede verse algo mayor. Suele acercar el encuadre.",
    },
    {
      id: "calle",
      title: "3. Calle o barrio",
      kind: "image",
      model: "z-image",
      aspect: "9:16",
      prompt: `[lugar: calle de barrio popular / esquina con motos y cables / puesto de comida], en Latinoamérica, sin personas en primer plano. ${FOTO_CASUAL}`,
      tip: "Describe lo que se ve: fachadas, cables, veredas. Los carteles pueden salir con letras falsas.",
    },
    {
      id: "negocio",
      title: "4. Negocio",
      kind: "image",
      model: "z-image",
      aspect: "9:16",
      prompt: `[negocio: tienda de barrio con mostrador / puesto de frutas en mercado techado], en Latinoamérica, sin personas en primer plano. ${FOTO_CASUAL}`,
      tip: "Revisa etiquetas y productos: pueden salir letras falsas, frutas raras o envases repetidos.",
    },
    {
      id: "interior",
      title: "5. Interior de casa",
      kind: "image",
      model: "z-image",
      aspect: "9:16",
      prompt: `[ambiente: cocina / sala / dormitorio] de una casa de clase media en Latinoamérica: [objetos concretos: estufa de gas blanca, piso de cerámica, ollas de aluminio], muebles usados de distintos juegos, paredes con marcas, objetos de uso diario, algo desordenado, casa habitada, no es una foto de catálogo, sin personas. ${FOTO_CASUAL}`,
      tip: "Cambia los objetos según el ambiente. Si el desgaste se ve exagerado, quita «paredes con marcas».",
    },
  ],
};
