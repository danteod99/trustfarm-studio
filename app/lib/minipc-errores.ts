// Formateo seguro de errores de Supabase/PostgREST: solo el código (SQLSTATE), nunca message/details/hint,
// porque esos textos pueden traer datos personales. Sin imports con alias: lo ejecuta Node directo.

export function errorGenerico(mensaje: string, error: { code?: unknown } | null | undefined): string {
  const code = error && typeof error.code === 'string' && error.code ? error.code : '?'
  return `${mensaje} (código ${code})`
}
