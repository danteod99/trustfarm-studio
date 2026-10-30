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

/** Cinta que se desplaza en la portada. */
export const MARQUEE: Showcase[] = [
  SHOW.retrato, SHOW.fresa, SHOW.taxi, SHOW.serum, SHOW.granja, SHOW.zorro,
  SHOW.frutilandia, SHOW.modelo, SHOW.machu, SHOW.creadora, SHOW.fresaLlorando,
];
