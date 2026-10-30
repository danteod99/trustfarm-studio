// Textos del catálogo TRUST Assistant como datos. Módulo puro (sin JSX ni alias).
// Las afirmaciones están ajustadas a la tabla de brechas del diseño:
// lo que hoy no se cumple va en las constantes TEXTO_* para cambiarlo en un solo sitio.

export const TEXTO_ACTUALIZACIONES = 'Nosotros te instalamos las mejoras.'
export const TEXTO_BORRADO_CLIPS = 'Los clips se borran solos a los 7 días.'

export interface Item {
  titulo: string
  texto: string
}

export const PROMESA = 'Un vendedor con IA que atiende tu WhatsApp las 24 horas + un estudio de video con IA'
export const DESCRIPCION =
  'Una mini PC con un vendedor con IA adentro: atiende tu WhatsApp, toma pedidos, agenda citas y edita tus videos. Elige tu plan y compra en línea.'

export const QUE_HACE: Item[] = [
  { titulo: 'Vende por WhatsApp', texto: 'Responde en segundos, a cualquier hora, con tus precios reales.' },
  { titulo: 'Pedidos y citas', texto: 'Registra pedidos con el total calculado, agenda citas o cotiza.' },
  { titulo: 'Tu propio CRM', texto: 'Cada cliente, conversación y pedido queda guardado.' },
  { titulo: 'Seguimiento solo', texto: 'Le vuelve a escribir a quien preguntó y no respondió.' },
  { titulo: 'Resumen diario', texto: 'Cada noche, ventas, pedidos y chats en tu WhatsApp.' },
  { titulo: 'Te pasa lo importante', texto: 'Si un cliente necesita a una persona, te avisa y te deja el chat.' },
]

export const PASOS: Item[] = [
  { titulo: 'Te llega lista', texto: 'La mini PC llega configurada. La conectas a tu pantalla e internet.' },
  { titulo: 'Eliges tu rubro', texto: 'Le dices cómo debe hablar, qué debe saber y qué no debe decir nunca.' },
  { titulo: 'Subes tu catálogo', texto: 'En foto, PDF, Excel o texto. La IA lo lee y carga tus productos y precios.' },
  { titulo: 'Pruebas y activas', texto: 'Lo pruebas en el simulador y, cuando te guste, lo enciendes.' },
]

export const APP_VISTAS: Item[] = [
  { titulo: 'Desde el celular', texto: 'Lees cada conversación y respondes tú cuando quieras. En ese chat la IA se pausa sola.' },
  { titulo: 'Avisos al instante', texto: 'Los clientes que necesitan a una persona aparecen marcados para que los atiendas tú.' },
  { titulo: 'Ventas del día', texto: 'Gráfico de ventas, pedidos y porcentaje de chats que compraron.' },
]

export const ESTUDIO_VIDEO = {
  intro:
    'Además de vender, TRUST Assistant edita tus videos ahí mismo, en la caja. Subes una grabación y eliges qué hacer: limpiarla, cortarla en clips o crear variaciones. Puedes usar cada herramienta sola o una después de otra.',
  disponibilidad: 'El estudio de video viene en los planes Pro y Negocio.',
  herramientas: [
    {
      titulo: 'Limpieza automática',
      texto:
        'Quita los silencios y las tomas repetidas, cuando te trabas y lo vuelves a decir. Tu original se conserva.',
    },
    {
      titulo: 'Multiclipping con IA',
      texto: 'De un video largo saca hasta 15 clips para TikTok, Reels y Shorts. La IA elige los mejores momentos.',
    },
    {
      titulo: 'Variaciones',
      texto:
        'Hasta 20 versiones del mismo clip con cambios suaves de color y volumen, para publicar en varias cuentas.',
    },
  ] as Item[],
  clipsListos: [
    'Formato vertical que sigue la cara de quien habla.',
    'Subtítulos palabra por palabra y archivo .srt aparte.',
    'Corto (15 a 60 s) o estándar (30 a 90 s).',
    // El catálogo dice "hasta 3 GB": no se afirma (brecha de subidas grandes por túnel).
    'Acepta videos MP4, MOV, MKV y WEBM.',
  ],
  idealPara: [
    'Lives, charlas y podcasts que quieres convertir en reels.',
    'Negocios que publican todos los días en TikTok e Instagram.',
    'Agencias y creadores con varias cuentas.',
    'Quien graba sus videos de venta y no tiene editor.',
  ],
}

export const CAJAS_WEB: Item[] = [
  {
    titulo: 'Mis cajas',
    texto: 'Vinculas la caja con un código y la abres desde trustfarm.online, estés donde estés.',
  },
  {
    titulo: 'Acceso seguro',
    texto: 'Cada ingreso usa un pase firmado que vence en segundos. Nadie más entra a tu caja.',
  },
  {
    titulo: 'Siempre al día',
    // El catálogo dice "recibe las mejoras sin que hagas nada": hoy se instalan a mano.
    texto: `La caja avisa que está encendida. ${TEXTO_ACTUALIZACIONES}`,
  },
]

export const USOS: { titulo: string; foto: string; alt: string }[] = [
  {
    titulo: 'Bodegas y minimarkets',
    foto: '/minipc/uso-bodega.jpg',
    alt: 'Caja de una bodega con la mini PC TRUST junto a la pantalla',
  },
  {
    titulo: 'Restaurantes y delivery',
    foto: '/minipc/uso-restaurante.jpg',
    alt: 'Mostrador de un restaurante con la mini PC TRUST atendiendo pedidos',
  },
  {
    titulo: 'Belleza y citas',
    foto: '/minipc/uso-belleza.jpg',
    alt: 'Recepción de un salón de belleza con la mini PC TRUST agendando citas',
  },
  {
    titulo: 'Creadores y estudio de video',
    foto: '/minipc/uso-creadores.jpg',
    alt: 'Escritorio de un creador de contenido con la mini PC TRUST y su editor de video',
  },
]

export const NEGOCIOS: string[] = [
  'Bodega / minimarket',
  'Restaurante y delivery',
  'Ropa y calzado',
  'Tecnología y celulares',
  'Belleza y estética',
  'Salud / consultorio',
  'Inmobiliaria',
  'Cursos y servicios',
  'Importaciones / mayorista',
  'Y más',
]

export const CONTROL: string[] = [
  'Nunca inventa precios. Usa solo tu catálogo y el total lo calcula el sistema.',
  'Sigue tus reglas. Tú decides cómo habla y qué no debe decir.',
  'Te pasa el chat en reclamos, precios por mayor o casos especiales.',
  'Revisas todo lo que respondió, desde la caja o el celular.',
]

export const FAQ: { q: string; a: string }[] = [
  { q: '¿Necesito saber de tecnología?', a: 'No. Llega lista y configuras tu vendedor con pasos guiados.' },
  {
    q: '¿Mis videos salen a internet?',
    a: `No. Se editan dentro de la caja (a la IA solo va el texto de lo que dices). ${TEXTO_BORRADO_CLIPS}`,
  },
  {
    q: '¿Por qué hay mensualidad?',
    a: 'Cubre la inteligencia artificial, las actualizaciones y el soporte.',
  },
  {
    q: '¿Con qué WhatsApp funciona?',
    a: 'Con el número de tu negocio por la API oficial. Te ayudamos a conectarlo.',
  },
]

export const FRASE_MENSUALIDAD =
  'La mensualidad incluye la inteligencia artificial, las actualizaciones, el acceso desde trustfarm.online y el soporte. Precios en dólares americanos.'

export const EQUIPO = {
  intro:
    'Una mini PC de aluminio del tamaño de tu mano, con el logo TRUST. La pones junto a la pantalla de tu caja y queda encendida todo el día, en silencio.',
  medidas: 'Aluminio · 13 × 13 cm',
  fotos: [
    { src: '/minipc/equipo-frente.jpg', alt: 'Frente de la mini PC TRUST con USB-C, USB y audio', pie: 'Frente · USB-C · USB · audio' },
    { src: '/minipc/equipo-atras.jpg', alt: 'Parte trasera de la mini PC TRUST con 2 HDMI, 4 USB y red', pie: 'Atrás · 2 HDMI · 4 USB · red' },
    { src: '/minipc/equipo-arriba.jpg', alt: 'Vista superior de la mini PC TRUST de aluminio con el logo', pie: 'Vista superior' },
  ],
  versiones: [
    {
      titulo: 'Plan Básico',
      chip: 'Intel N150',
      datos: ['12 GB RAM · 128 GB SSD', 'Consumo bajo, todo el día', '2 HDMI: pantalla de caja y una extra', 'Ethernet: conexión estable por cable'],
    },
    {
      titulo: 'Planes Pro y Negocio',
      chip: 'AMD Ryzen 7 7735HS',
      datos: ['24 GB RAM · 512 GB o 1 TB SSD', '8 núcleos de potencia', '2 HDMI: pantalla de caja y una extra', 'Llega instalada y configurada'],
    },
  ],
}
