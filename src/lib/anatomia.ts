// Mapa de zona anatómica -> punto sobre la silueta (public/silueta.webp).
//
// Las coordenadas van en PORCENTAJE del contenedor, no en píxeles: así la silueta
// se puede escalar libremente y los puntos la siguen.
//   x: 0 = borde izquierdo de la imagen, 100 = borde derecho
//   y: 0 = coronilla, 100 = pies
//
// Ojo con los lados: la silueta está de frente, así que el lado DERECHO del paciente
// se pinta a la IZQUIERDA de la imagen. Eso lo resuelve `puntoDeZona()`, no hay que
// invertir nada a mano al añadir zonas aquí.

export type Cara = 'ant' | 'post' | 'lat'
export type Punto = { x: number, y: number, cara: Cara }

// x se define SIEMPRE en el eje central o hacia el lado izquierdo de la imagen.
// Para zonas laterales se indica `lateral: true` y el desplazamiento en `dx`.
// cara: dónde cae la zona respecto al observador. Como solo hay una silueta de
// frente, se representa con el tamaño y la nitidez del punto en vez de con dos vistas.
type ZonaDef = { x: number, y: number, lateral?: boolean, dx?: number, cara?: Cara }

const ZONAS: Record<string, ZonaDef> = {
  // Cabeza y cuello
  'cabeza':        { x: 50, y: 6, cara: 'lat' },
  'cara':          { x: 50, y: 8, cara: 'ant' },
  'mandibula':     { x: 50, y: 11, cara: 'ant' },
  'cervical':      { x: 50, y: 14, cara: 'post' },
  'cuello':        { x: 50, y: 14, cara: 'ant' },

  // Tronco
  'hombro':        { x: 50, y: 19, lateral: true, dx: 13, cara: 'lat' },
  'clavicula':     { x: 50, y: 17, lateral: true, dx: 8, cara: 'ant' },
  'escapula':      { x: 50, y: 22, lateral: true, dx: 10, cara: 'post' },
  'pectoral':      { x: 50, y: 23, lateral: true, dx: 7, cara: 'ant' },
  'torax':         { x: 50, y: 24, cara: 'ant' },
  'costillas':     { x: 50, y: 26, lateral: true, dx: 9, cara: 'lat' },
  'dorsal':        { x: 50, y: 27, cara: 'post' },
  'abdomen':       { x: 50, y: 32, cara: 'ant' },
  'lumbar':        { x: 50, y: 34, cara: 'post' },
  'sacro':         { x: 50, y: 38, cara: 'post' },
  'pelvis':        { x: 50, y: 39, cara: 'ant' },
  'cadera':        { x: 50, y: 39, lateral: true, dx: 9, cara: 'lat' },
  'gluteo':        { x: 50, y: 41, lateral: true, dx: 6, cara: 'post' },
  'ingle':         { x: 50, y: 41, lateral: true, dx: 4, cara: 'ant' },

  // Miembro superior
  'brazo':         { x: 50, y: 26, lateral: true, dx: 17, cara: 'lat' },
  'biceps':        { x: 50, y: 26, lateral: true, dx: 16, cara: 'ant' },
  'codo':          { x: 50, y: 33, lateral: true, dx: 19, cara: 'lat' },
  'antebrazo':     { x: 50, y: 39, lateral: true, dx: 20, cara: 'lat' },
  'muneca':        { x: 50, y: 46, lateral: true, dx: 21, cara: 'lat' },
  'mano':          { x: 50, y: 51, lateral: true, dx: 22, cara: 'lat' },
  'dedos mano':    { x: 50, y: 55, lateral: true, dx: 22, cara: 'lat' },

  // Miembro inferior
  'muslo':         { x: 50, y: 51, lateral: true, dx: 7, cara: 'lat' },
  'cuadriceps':    { x: 50, y: 50, lateral: true, dx: 7, cara: 'ant' },
  'isquiotibiales':{ x: 50, y: 53, lateral: true, dx: 7, cara: 'post' },
  'aductores':     { x: 50, y: 48, lateral: true, dx: 3, cara: 'ant' },
  'rodilla':       { x: 50, y: 62, lateral: true, dx: 7, cara: 'ant' },
  'pierna':        { x: 50, y: 70, lateral: true, dx: 7, cara: 'lat' },
  'gemelo':        { x: 50, y: 70, lateral: true, dx: 7, cara: 'post' },
  'tibia':         { x: 50, y: 72, lateral: true, dx: 6, cara: 'ant' },
  'tobillo':       { x: 50, y: 88, lateral: true, dx: 6, cara: 'lat' },
  'pie':           { x: 50, y: 94, lateral: true, dx: 6, cara: 'ant' },
  'talon':         { x: 50, y: 93, lateral: true, dx: 6, cara: 'post' },
  'dedos pie':     { x: 50, y: 97, lateral: true, dx: 7, cara: 'ant' },
}

// Quita tildes, mayúsculas y plurales simples para que "Rodillas", "rodilla" y
// "Rodilla derecha" caigan todos en la misma entrada.
const norm = (s: string) => (s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

/**
 * Devuelve el punto donde pintar una zona, o null si no está mapeada.
 * `lado` puede ser 'izquierdo' | 'derecho' | 'bilateral' | null.
 * Devuelve DOS puntos cuando es bilateral y la zona es lateral.
 */
export function puntoDeZona(zona: string, lado?: string | null): Punto[] {
  const n = norm(zona)
  let def = ZONAS[n]

  // Búsqueda por contención: "dolor lumbar bajo" -> "lumbar".
  if (!def) {
    const clave = Object.keys(ZONAS)
      .filter(k => n.includes(k))
      .sort((a, b) => b.length - a.length)[0]
    if (clave) def = ZONAS[clave]
  }
  if (!def) return []

  const cara: Cara = def.cara || 'lat'
  if (!def.lateral) return [{ x: def.x, y: def.y, cara }]

  const dx = def.dx || 8
  const l = norm(lado || '')
  // Silueta de frente: el lado derecho del paciente cae a la izquierda de la imagen.
  if (l === 'derecho') return [{ x: def.x - dx, y: def.y, cara }]
  if (l === 'izquierdo') return [{ x: def.x + dx, y: def.y, cara }]
  return [{ x: def.x - dx, y: def.y, cara }, { x: def.x + dx, y: def.y, cara }]
}

export function zonaEstaMapeada(zona: string): boolean {
  return puntoDeZona(zona, 'bilateral').length > 0
}

export const ZONAS_DISPONIBLES = Object.keys(ZONAS)
