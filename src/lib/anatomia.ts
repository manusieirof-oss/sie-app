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

/**
 * Nombres de etiqueta que no coinciden con ninguna clave de ZONAS pero sí caen en una.
 *
 * No es un mapa anatómico: es lo justo para poder ORDENAR de la cabeza a los pies. Que el
 * trapecio se coloque a la altura de la escápula no dice dónde empieza y dónde acaba,
 * dice dónde ponerlo en una lista. Para pintar sobre la silueta se usa ZONAS, que sí es
 * el mapa.
 */
const SINONIMOS_ALTURA: Record<string, string> = {
  'maxilar': 'mandibula',
  'trapecio': 'escapula',
  'escapular': 'escapula',
  'deltoides': 'hombro',
  'manguito rotador': 'hombro',
  'columna': 'dorsal',
  'espalda': 'dorsal',
  'diafragma': 'torax',
  'intercostales': 'costillas',
  'triceps': 'brazo',
  'braquioradial': 'antebrazo',
  'extensor de munecas': 'antebrazo',
  'extensor de muneca': 'antebrazo',
  'flexor de muneca': 'antebrazo',
  'extensor de dedos': 'antebrazo',
  'flexor de dedos': 'antebrazo',
  'dedos': 'mano',
  'metacarpiano': 'mano',
  'psoas': 'cadera',
  'abductor tfl': 'cadera',
  'gluteo piramidal': 'gluteo',
  'sartorio': 'muslo',
  'isquiotibial': 'isquiotibiales',
  'peroneos': 'pierna',
  'triceps sural': 'gemelo',
  'tibial anterior': 'tibia',
  'metatarso': 'pie',
}

/**
 * A qué altura del cuerpo cae un nombre: 0 la coronilla, 100 los pies. null si no se sabe.
 *
 * Sirve para ordenar listas en sentido anatómico en vez de alfabético. Buscar "gemelo"
 * entre la eme y la ge no tiene nada que ver con cómo se piensa un cuerpo; recorrerlo de
 * arriba abajo, sí, y además enseña los huecos: si entre rodilla y tobillo no hay nada,
 * se ve.
 */
export function alturaDeZona(nombre: string): number | null {
  const n = norm(nombre)
  if (ZONAS[n]) return ZONAS[n].y
  const sin = SINONIMOS_ALTURA[n]
  if (sin && ZONAS[sin]) return ZONAS[sin].y
  // Por contención, igual que `puntoDeZona`: "Glúteo mayor" cae en "gluteo".
  const clave = Object.keys(ZONAS).find(k => n.includes(k) || k.includes(n))
  if (clave) return ZONAS[clave].y
  const claveSin = Object.keys(SINONIMOS_ALTURA).find(k => n.includes(k))
  if (claveSin) return ZONAS[SINONIMOS_ALTURA[claveSin]]?.y ?? null
  return null
}

/**
 * La posición de una zona en el recorrido del cuerpo, no su altura.
 *
 * Ordenar solo por altura tiene una pega real: el brazo cuelga a la altura del tronco y
 * la mano a la del muslo, así que el bíceps caía entre el pectoral y la espalda, y los
 * dedos entre el cuádriceps y el isquiotibial. Es anatómicamente cierto y en una lista se
 * lee fatal.
 *
 * Se usa el ORDEN EN QUE ESTÁN ESCRITAS en ZONAS, que ya va por segmentos: cabeza y
 * cuello, tronco, miembro superior, miembro inferior, y cada uno de arriba abajo. El
 * orden de declaración es el dato, así que basta con no desordenar ese objeto.
 */
const ORDEN = Object.keys(ZONAS)

function posicionDeZona(nombre: string): number | null {
  const n = norm(nombre)
  const clave = ZONAS[n] ? n
    : (SINONIMOS_ALTURA[n] && ZONAS[SINONIMOS_ALTURA[n]]) ? SINONIMOS_ALTURA[n]
    : ORDEN.find(k => n.includes(k) || k.includes(n))
    || (() => { const s = Object.keys(SINONIMOS_ALTURA).find(k => n.includes(k)); return s ? SINONIMOS_ALTURA[s] : undefined })()
  if (!clave) return null
  const i = ORDEN.indexOf(clave)
  return i < 0 ? null : i
}

/**
 * Comparador para recorrer el cuerpo. Lo que no se sabe dónde cae va al final y en
 * alfabético, que es mejor que colocarlo a ojo en medio y que nadie lo encuentre.
 */
export function ordenAnatomico(a: string, b: string): number {
  const pa = posicionDeZona(a), pb = posicionDeZona(b)
  if (pa == null && pb == null) return a.localeCompare(b)
  if (pa == null) return 1
  if (pb == null) return -1
  return pa - pb || a.localeCompare(b)
}
