/**
 * El prompt guardado lleva antepuestos el estilo, el personaje y (en historias) el recordatorio
 * de continuidad, y al final la cámara. Para reusarlo o para recordárselo a la escena siguiente
 * solo interesa lo que escribió el usuario.
 */
export function sceneText(prompt: string): string {
  const i = prompt.lastIndexOf("Escena: ");
  let t = (i >= 0 ? prompt.slice(i + 8) : prompt).split("\nCámara:")[0];
  const j = t.lastIndexOf("Ahora: ");
  if (t.startsWith("Continuación directa") && j >= 0) t = t.slice(j + 7);
  return t.trim();
}
