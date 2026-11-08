/** Fila de rombos (separador del look afro house). Toma el color del texto: pásale text-ocre, text-terracota… */
export default function Rombos({ n = 8, className = "", size = 9 }: { n?: number; className?: string; size?: number }) {
  return (
    <div aria-hidden className={`flex gap-[7px] ${className}`}>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} className="block rotate-45 bg-current" style={{ width: size, height: size }} />
      ))}
    </div>
  );
}
