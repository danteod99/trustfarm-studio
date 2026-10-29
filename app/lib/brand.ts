// Cambiar el nombre de la marca aquí la cambia en toda la web.
export const BRAND = {
  name: "TrustFarm Studio",
  short: "TrustFarm",
  domain: "trustfarm.online",
  tagline: "Imágenes y videos con IA, listos para publicar.",
  supportEmail: "soporte@trustfarm.online",
  legalEntity: "Scaling Tech Farm LLC",
};

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || `https://${BRAND.domain}`;
