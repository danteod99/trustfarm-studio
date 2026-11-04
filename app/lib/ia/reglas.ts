// Qué deja pasar la pasarela: solo lo que usa el asistente, para que una llave extraída de una mini PC sirva lo menos posible.
import { esModeloIA, type ModeloIA } from './precios.ts'

export const MAX_CUERPO_BYTES = 3_500_000
export const MAX_TOKENS = 16000

// Debe coincidir con server/src/ai/herramientas-permitidas.json de la caja. Agregar aquí y desplegar ANTES de publicar una
// versión de la caja que use una herramienta nueva, o la pasarela la rechazará.
export const HERRAMIENTAS: ReadonlySet<string> = new Set([
  'actualizar_contacto', 'agendar_cita', 'buscar_cliente', 'consultar_pedidos', 'entregar_productos', 'enviar_cotizacion',
  'estado_del_negocio', 'listar_citas', 'listar_pedidos', 'pasar_a_humano', 'proponer_agendar_cita', 'proponer_pausar_vendedor',
  'proponer_reanudar_vendedor', 'proponer_responder_cliente', 'registrar_pedido', 'responder_cliente', 'resumen_ventas',
  'ver_conversacion', 'ver_productos',
])

export interface ParamsIA {
  model: ModeloIA
  max_tokens: number
  messages: unknown[]
  system?: unknown
  tools?: unknown[]
  tool_choice?: unknown
}

type Resultado = { ok: true; params: ParamsIA; modelo: ModeloIA } | { ok: false; status: 400; error: string }
const mal = (error: string): Resultado => ({ ok: false, status: 400, error })

export function validarCuerpo(cuerpo: unknown): Resultado {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return mal('Solicitud inválida.')
  const b = cuerpo as Record<string, unknown>
  if (!esModeloIA(b.model)) return mal('Modelo no permitido.')
  if (b.stream) return mal('La pasarela no admite streaming.')
  if (typeof b.max_tokens !== 'number' || !Number.isInteger(b.max_tokens) || b.max_tokens < 1 || b.max_tokens > MAX_TOKENS) {
    return mal(`max_tokens debe estar entre 1 y ${MAX_TOKENS}.`)
  }
  if (!Array.isArray(b.messages) || b.messages.length === 0) return mal('Faltan los messages.')
  if (b.tools !== undefined) {
    if (!Array.isArray(b.tools)) return mal('Herramienta no permitida.')
    for (const t of b.tools) {
      const nombre = (t as { name?: unknown } | null)?.name
      if (typeof nombre !== 'string' || !HERRAMIENTAS.has(nombre)) return mal('Herramienta no permitida.')
    }
  }
  const params: ParamsIA = { model: b.model, max_tokens: b.max_tokens, messages: b.messages }
  if (b.system !== undefined) params.system = b.system
  if (b.tools !== undefined) params.tools = b.tools
  if (b.tool_choice !== undefined) params.tool_choice = b.tool_choice
  return { ok: true, params, modelo: b.model }
}
