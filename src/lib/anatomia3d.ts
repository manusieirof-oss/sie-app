// Mapa de zona anatómica -> punto sobre el cuerpo 3D (public/cuerpo3d.glb).
//
// Es el hermano de `anatomia.ts`: las MISMAS claves de zona, pero con profundidad.
// En la silueta plana lo de detrás se fingía con el tamaño del punto; aquí el punto
// está de verdad delante o detrás, y al girar el cuerpo se ve a través de él.
//
// Las coordenadas se apuntan en PÍXELES de silueta.webp (314x600), porque el cuerpo
// 3D se modeló calcando esa silueta y así se pueden comprobar a ojo sobre la imagen:
//   dx: distancia al eje central hacia el lado IZQUIERDO del paciente (0 = centro)
//   y:  de la coronilla (arriba) a los pies (568 = planta)
//   z:  hacia delante positivo, hacia la espalda negativo
// `toMundo()` las pasa a las unidades de la escena (6 px = 1 unidad, pies en 0).

import { claveDeZona } from '@/lib/anatomia'

export type Cara3D = 'ant' | 'post' | 'lat' | 'sup'
type Def3D = { dx: number, y: number, z: number, cara: Cara3D }

export type Punto3D = {
  /** Posición en unidades de escena. */
  p: [number, number, number]
  /** Hacia dónde mira la zona. Sirve para saber si queda de cara o de espaldas al girar. */
  n: [number, number, number]
}

const Z: Record<string, Def3D> = {
  // Cabeza y cuello
  'cabeza':        { dx: 0,  y: 36,  z: 4,   cara: 'sup' },
  'cara':          { dx: 0,  y: 62,  z: 31,  cara: 'ant' },
  'mandibula':     { dx: 0,  y: 86,  z: 22,  cara: 'ant' },
  'cervical':      { dx: 0,  y: 108, z: -20, cara: 'post' },
  'cuello':        { dx: 0,  y: 108, z: 14,  cara: 'ant' },

  // Tronco
  'hombro':        { dx: 72, y: 156, z: 0,   cara: 'lat' },
  'clavicula':     { dx: 28, y: 130, z: 22,  cara: 'ant' },
  'escapula':      { dx: 32, y: 178, z: -27, cara: 'post' },
  'pectoral':      { dx: 26, y: 182, z: 30,  cara: 'ant' },
  'torax':         { dx: 0,  y: 190, z: 35,  cara: 'ant' },
  'costillas':     { dx: 45, y: 215, z: 4,   cara: 'lat' },
  'dorsal':        { dx: 0,  y: 205, z: -26, cara: 'post' },
  'abdomen':       { dx: 0,  y: 245, z: 28,  cara: 'ant' },
  'lumbar':        { dx: 0,  y: 258, z: -27, cara: 'post' },
  'sacro':         { dx: 0,  y: 290, z: -31, cara: 'post' },
  'pelvis':        { dx: 0,  y: 288, z: 26,  cara: 'ant' },
  'cadera':        { dx: 50, y: 282, z: 0,   cara: 'lat' },
  'gluteo':        { dx: 24, y: 290, z: -35, cara: 'post' },
  'ingle':         { dx: 20, y: 302, z: 20,  cara: 'ant' },

  // Miembro superior
  'brazo':         { dx: 74, y: 198, z: -3,  cara: 'lat' },
  'biceps':        { dx: 62, y: 198, z: 12,  cara: 'ant' },
  'codo':          { dx: 68, y: 238, z: -14, cara: 'post' },
  'antebrazo':     { dx: 84, y: 262, z: 2,   cara: 'lat' },
  'muneca':        { dx: 90, y: 302, z: 2,   cara: 'lat' },
  'mano':          { dx: 90, y: 326, z: 9,   cara: 'ant' },
  'dedos mano':    { dx: 92, y: 344, z: 7,   cara: 'ant' },

  // Miembro inferior
  'muslo':         { dx: 46, y: 352, z: 0,   cara: 'lat' },
  'cuadriceps':    { dx: 26, y: 350, z: 21,  cara: 'ant' },
  'isquiotibiales':{ dx: 26, y: 362, z: -21, cara: 'post' },
  'aductores':     { dx: 9,  y: 330, z: 6,   cara: 'ant' },
  'rodilla':       { dx: 25, y: 432, z: 15,  cara: 'ant' },
  'pierna':        { dx: 37, y: 480, z: -2,  cara: 'lat' },
  'gemelo':        { dx: 25, y: 464, z: -22, cara: 'post' },
  'tibia':         { dx: 21, y: 482, z: 11,  cara: 'ant' },
  'tobillo':       { dx: 28, y: 538, z: -3,  cara: 'lat' },
  'pie':           { dx: 20, y: 552, z: 20,  cara: 'ant' },
  'talon':         { dx: 18, y: 562, z: -14, cara: 'post' },
  'dedos pie':     { dx: 20, y: 560, z: 34,  cara: 'ant' },
}

const toMundo = (x: number, y: number, z: number): [number, number, number] =>
  [x / 6, (568 - y) / 6, z / 6]

function normal(cara: Cara3D, signo: number): [number, number, number] {
  if (cara === 'ant') return [0, 0, 1]
  if (cara === 'post') return [0, 0, -1]
  if (cara === 'sup') return [0, 1, 0]
  return [signo, 0, 0]
}

/**
 * Puntos 3D de una zona. Mismo criterio de lados que `puntoDeZona()`:
 * bilateral en una zona lateral da dos puntos. El lado izquierdo del paciente es +x
 * (con el cuerpo de frente a la cámara queda a la derecha de la pantalla, como en la
 * silueta plana).
 */
export function puntos3DDeZona(zona: string, lado?: string | null): Punto3D[] {
  const clave = claveDeZona(zona)
  const d = clave ? Z[clave] : undefined
  if (!d) return []
  if (d.dx === 0) return [{ p: toMundo(0, d.y, d.z), n: normal(d.cara, 0) }]
  const l = (lado || '').toLowerCase()
  const lados = l.startsWith('der') ? [-1] : l.startsWith('izq') ? [1] : [-1, 1]
  return lados.map(s => ({ p: toMundo(s * d.dx, d.y, d.z), n: normal(d.cara, s) }))
}
