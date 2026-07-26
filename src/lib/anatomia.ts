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

export type Punto = { x: number, y: number }

// x se define SIEMPRE en el eje central o hacia el lado izquierdo de la imagen.
// Para zonas laterales se indica `lateral: true` y el desplazamiento en `dx`.
type ZonaDef = { x: number, y: number, lateral?: boolean, dx?: number }

const ZONAS: Record<string, ZonaDef> = {
  // Cabeza y cuello
  'cabeza':        { x: 50, y: 6 },
  'cara':          { x: 50, y: 8 },
  'mandibula':     { x: 50, y: 11 },
  'cervical':      { x: 50, y: 14 },
  'cuello':        { x: 50, y: 14 },

  // Tronco
  'hombro':        { x: 50, y: 19, lateral: true, dx: 13 },
  'clavicula':     { x: 50, y: 17, lateral: true, dx: 8 },
  'escapula':      { x: 50, y: 22, lateral: true, dx: 10 },
  'pectoral':      { x: 50, y: 23, lateral: true, dx: 7 },
  'torax':         { x: 50, y: 24 },
  'costillas':     { x: 50, y: 26, lateral: true, dx: 9 },
  'dorsal':        { x: 50, y: 27 },
  'abdomen':       { x: 50, y: 32 },
  'lumbar':        { x: 50, y: 34 },
  'sacro':         { x: 50, y: 38 },
  'pelvis':        { x: 50, y: 39 },
  'cadera':        { x: 50, y: 39, lateral: true, dx: 9 },
  'gluteo':        { x: 50, y: 41, lateral: true, dx: 6 },
  'ingle':         { x: 50, y: 41, lateral: true, dx: 4 },

  // Miembro superior
  'brazo':         { x: 50, y: 26, lateral: true, dx: 17 },
  'biceps':        { x: 50, y: 26, lateral: true, dx: 16 },
  'codo':          { x: 50, y: 33, lateral: true, dx: 19 },
  'antebrazo':     { x: 50, y: 39, lateral: true, dx: 20 },
  'muneca':        { x: 50, y: 46, lateral: true, dx: 21 },
  'mano':          { x: 50, y: 51, lateral: true, dx: 22 },
  'dedos mano':    { x: 50, y: 55, lateral: true, dx: 22 },

  // Miembro inferior
  'muslo':         { x: 50, y: 51, lateral: true, dx: 7 },
  'cuadriceps':    { x: 50, y: 50, lateral: true, dx: 7 },
  'isquiotibiales':{ x: 50, y: 53, lateral: true, dx: 7 },
  'aductores':     { x: 50, y: 48, lateral: true, dx: 3 },
  'rodilla':       { x: 50, y: 62, lateral: true, dx: 7 },
  'pierna':        { x: 50, y: 70, lateral: true, dx: 7 },
  'gemelo':        { x: 50, y: 70, lateral: true, dx: 7 },
  'tibia':         { x: 50, y: 72, lateral: true, dx: 6 },
  'tobillo':       { x: 50, y: 88, lateral: true, dx: 6 },
  'pie':           { x: 50, y: 94, lateral: true, dx: 6 },
  'talon':         { x: 50, y: 93, lateral: true, dx: 6 },
  'dedos pie':     { x: 50, y: 97, lateral: true, dx: 7 },
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

  if (!def.lateral) return [{ x: def.x, y: def.y }]

  const dx = def.dx || 8
  const l = norm(lado || '')
  // Silueta de frente: el lado derecho del paciente cae a la izquierda de la imagen.
  if (l === 'derecho') return [{ x: def.x - dx, y: def.y }]
  if (l === 'izquierdo') return [{ x: def.x + dx, y: def.y }]
  return [{ x: def.x - dx, y: def.y }, { x: def.x + dx, y: def.y }]
}

export function zonaEstaMapeada(zona: string): boolean {
  return puntoDeZona(zona, 'bilateral').length > 0
}

export const ZONAS_DISPONIBLES = Object.keys(ZONAS)
