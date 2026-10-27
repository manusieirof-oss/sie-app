// FRECUENCIA CARDÍACA EN CLASE (bandas Polar por Bluetooth). Las cuentas, sin pantalla.

/**
 * FC MÁXIMA. Si está medida en la ficha (pacientes.fc_max), esa. Si no, Tanaka:
 * 208 − 0,7 × edad, que se ajusta mejor que 220 − edad sobre todo en mayores.
 * OJO: la app de Polar usa 220 − edad, así que sus % y zonas NO coinciden con los
 * de SIE. Se dice en pantalla para que nadie piense que una de las dos está mal.
 */
export function fcMaxDe(p: { fc_max?: number | null, fecha_nacimiento?: string | null } | null | undefined): { fc: number | null, medida: boolean } {
  if (p?.fc_max && p.fc_max > 80) return { fc: p.fc_max, medida: true }
  const edad = edadDe(p?.fecha_nacimiento)
  return { fc: edad != null ? Math.round(208 - 0.7 * edad) : null, medida: false }
}
export function edadDe(f?: string | null): number | null {
  if (!f) return null
  const n = new Date(f + 'T12:00:00'), h = new Date()
  let e = h.getFullYear() - n.getFullYear()
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e--
  return e > 0 && e < 110 ? e : null
}
export const TEXTO_FORMULA = 'FC máx. por Tanaka (208 − 0,7 × edad), o la medida si está en su ficha. Polar usa 220 − edad: por eso sus % y zonas no coinciden con estos.'

/** Zonas por % de la FC máx., las cinco clásicas (las mismas franjas que Polar). 0 = por debajo del 50%. */
export const ZONAS = [
  { z: 1, desde: 50, color: '#BFC7C5', nombre: 'Muy suave' },
  { z: 2, desde: 60, color: '#5FAEB9', nombre: 'Suave' },
  { z: 3, desde: 70, color: '#9DB86B', nombre: 'Moderada' },
  { z: 4, desde: 80, color: '#D4A24E', nombre: 'Intensa' },
  { z: 5, desde: 90, color: '#B5476A', nombre: 'Máxima' },
]
export function zonaDe(bpm: number | null, fcMax: number | null): number {
  if (!bpm || !fcMax) return 0
  const pct = bpm / fcMax * 100
  let z = 0
  for (const Z of ZONAS) if (pct >= Z.desde) z = Z.z
  return z
}
export const colorZona = (z: number) => ZONAS.find(Z => Z.z === z)?.color || '#E4E0D6'

/** Lo que se va acumulando de un paciente durante la clase (un "tic" por segundo con dato). */
export interface Acumulado {
  id: string                       // fila de fc_sesiones (se crea en el navegador para poder ir guardando)
  inicio: string, fin: string
  segundos: number, suma: number, max: number, min: number
  zonas: number[]                  // segundos en zona 0..5
  muestras: [number, number][]     // [segundo desde el inicio, ppm] cada 5 s, para la gráfica
  banda: string
}
export function nuevoAcumulado(banda: string): Acumulado {
  const ahora = new Date().toISOString()
  return { id: crypto.randomUUID(), inicio: ahora, fin: ahora, segundos: 0, suma: 0, max: 0, min: 0, zonas: [0, 0, 0, 0, 0, 0], muestras: [], banda }
}
export function sumarSegundo(a: Acumulado, bpm: number, fcMax: number | null): Acumulado {
  const t = Math.round((Date.now() - +new Date(a.inicio)) / 1000)
  const zonas = a.zonas.slice(); zonas[zonaDe(bpm, fcMax)]++
  const muestras = a.segundos % 5 === 0 ? [...a.muestras, [t, bpm] as [number, number]] : a.muestras
  return { ...a, fin: new Date().toISOString(), segundos: a.segundos + 1, suma: a.suma + bpm,
    max: Math.max(a.max, bpm), min: a.min ? Math.min(a.min, bpm) : bpm, zonas, muestras }
}
/**
 * CARGA (TRIMP de Edwards): minutos en cada zona × número de la zona. Es la que se
 * puede sacar sin lactato ni VFC, y la que usa casi todo el mundo con bandas.
 */
export const trimpDe = (zonas: number[]) => Math.round(zonas.reduce((s, seg, z) => s + seg / 60 * z, 0))
export const mediaDe = (a: Acumulado) => a.segundos ? Math.round(a.suma / a.segundos) : null
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
