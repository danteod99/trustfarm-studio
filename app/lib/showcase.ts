// Ejemplos reales generados con los modelos de la plataforma (public/showcase).
// Las imágenes son 9:16; los videos son bucles mudos de 5-8 s con su primer cuadro como portada.

export interface Showcase {
  src: string;
  alt: string;
  video?: string;
  model: string;
}

const S = (name: string, alt: string, model: string, video = false): Showcase => ({
  src: `/showcase/${name}.jpg`,
  alt,
  model,
  ...(video ? { video: `/showcase/${name}.mp4` } : {}),
});

export const SHOW = {
  ltxCafe: S("ltx-cafe", "Creadora hablando a cámara en una cafetería de Lima", "LTX-2.5 · con voz", true),
  ltxGranja: S("ltx-granja", "Caja con decenas de iPhones encendidos", "LTX-2.5", true),
  fresa: S("fresa", "Personaje fresa en 3D", "Z-Image Turbo"),
  fresaLlorando: S("fresa-llorando", "La misma fresa llorando con el celular", "Qwen-Image 2.1"),
  frutilandia: S("frutilandia", "Afiche de heladería con texto FRUTILANDIA", "Qwen-Image 2.1"),
  retrato: S("retrato-cusco", "Retrato realista con cartel de madera TRUSTFARM STUDIO", "Qwen-Image 2.1 Pro"),
  granja: S("granja-iphones", "Granja de iPhones con luces azules", "Qwen-Image 2.1"),
  creadora: S("creadora-cafe", "Foto realista de una joven con su celular en un café", "Z-Image Turbo"),
  taxi: S("miniserie-taxi", "Taxista de noche con un sobre misterioso", "Z-Image Turbo"),
  zorro: S("fabula-zorro", "Zorro con traje leyendo en un sillón", "Z-Image Turbo"),
  serum: S("producto-serum", "Foto de producto de un sérum sobre roca volcánica", "Z-Image Turbo"),
  modelo: S("modelo-ia", "Creadora virtual mostrando un producto", "Z-Image Turbo"),
  machu: S("machu-picchu", "Machu Picchu al amanecer", "Z-Image Turbo"),
} satisfies Record<string, Showcase>;

/** Personajes brainrot originales (video con voz; el audio se activa al tocarlos). */
export const BRAINROT: (Showcase & { title: string })[] = [
  { ...S("brainrot-llama", "Llama con cuerpo de licuadora y chicha morada en el Cusco", "", true), title: "Llamalicuadora Chichamorada" },
  { ...S("brainrot-cuy", "Cuy astronauta en mototaxi volador", "", true), title: "Cuyastronauto Mototaxino" },
  { ...S("brainrot-pollo", "Pollo a la brasa bailando marinera", "", true), title: "Pollerina Marinerina" },
  { ...S("brainrot-papa", "Papa con lentes manejando una mototaxi", "", true), title: "Papasito Mototaxito" },
  { ...S("brainrot-pez", "Pez con cuerpo de taxi en el tráfico de Lima", "", true), title: "Pescadito Taxidito" },
];

/** Cinta que se desplaza en la portada. */
export const MARQUEE: Showcase[] = [
  SHOW.retrato, BRAINROT[0], SHOW.fresa, SHOW.taxi, BRAINROT[2], SHOW.serum, SHOW.granja, BRAINROT[1], SHOW.zorro,
  SHOW.frutilandia, BRAINROT[3], SHOW.modelo, SHOW.machu, BRAINROT[4], SHOW.creadora, SHOW.fresaLlorando,
];
