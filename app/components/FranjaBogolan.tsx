/**
 * Franja con motivos del bogolan (tela de barro de Malí): zigzags, rombos y puntos en blanco sobre negro.
 * Se desliza lento de forma continua; con "reducir movimiento" queda quieta.
 */
const TILE = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="24" viewBox="0 0 64 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round">
    <path d="M0 1.2H64M0 22.8H64"/>
    <path d="M0 17 8 7 16 17 24 7 32 17"/>
    <path d="M48 5 55 12 48 19 41 12Z"/>
    <circle cx="48" cy="12" r="1.6" fill="#fff" stroke="none"/>
    <g fill="#fff" stroke="none"><circle cx="36" cy="5" r="1"/><circle cx="60" cy="5" r="1"/><circle cx="36" cy="19" r="1"/><circle cx="60" cy="19" r="1"/></g>
  </svg>`,
);

export default function FranjaBogolan({ className = "", alto = 14 }: { className?: string; alto?: number }) {
  return (
    <div
      aria-hidden
      className={`animate-bogolan pointer-events-none w-full opacity-70 ${className}`}
      style={{
        ["--tile" as string]: `${(64 * alto) / 24}px`,
        height: alto,
        backgroundImage: `url("data:image/svg+xml,${TILE}")`,
        backgroundSize: `${(64 * alto) / 24}px ${alto}px`,
        backgroundRepeat: "repeat-x",
      }}
    />
  );
}
