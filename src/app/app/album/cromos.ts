// EL COLOR DE CADA CROMO sube con las veces que lo ha hecho BIEN en clase (todos sus
// ítems de ejecución marcados). Hecho pero nunca bien: oscuro. BRILLA cuando ha mejorado
// desde la primera vez (carga, repeticiones, tiempo o distancia). Cada cromo ganado lleva
// el SELLO del centro que comprobó que lo hace bien.
// Las primeras veces sale sin color (blanco); el metal se gana a fuerza de repetir.
export const NIVELES = [
  { desde: 1, nombre: 'Sin color', clase: 'nuevo' },
  { desde: 5, nombre: 'Bronce', clase: 'bronce' },
  { desde: 20, nombre: 'Plata', clase: 'plata' },
  { desde: 50, nombre: 'Oro', clase: 'oro' },
  { desde: 100, nombre: 'Diamante', clase: 'diamante' },
]
export const nivelDe = (veces: number) => [...NIVELES].reverse().find(n => veces >= n.desde) || null
export const siguienteDe = (veces: number) => NIVELES.find(n => veces < n.desde) || null

export interface Cromo {
  id: string, nombre: string, imagen: string | null, zona: string, veces: number, vistas: number
  primera: string | null, ultima: string | null
  peso_max: number | null, reps_max: number | null, seg_max: number | null, metros_max: number | null
  brilla: boolean, favorito: boolean, verificado?: boolean, numero?: number
  inicio?: { peso: number | null, reps: number | null, seg: number | null, metros: number | null }
}
export interface Sello { nombre: string | null, logo: string | null }

/** Lo que ha mejorado desde la primera vez, en frases cortas («Carga: 40 → 45 kg»). */
export function mejoras(c: Cromo): string[] {
  const i = c.inicio, r: string[] = []
  if (!i) return r
  if (i.peso != null && c.peso_max != null && c.peso_max > i.peso) r.push(`Carga: ${i.peso} → ${c.peso_max} kg`)
  if (i.reps != null && c.reps_max != null && c.reps_max > i.reps) r.push(`Repeticiones: ${i.reps} → ${c.reps_max}`)
  if (i.seg != null && c.seg_max != null && c.seg_max > i.seg) r.push(`Tiempo: ${tiempo(i.seg)} → ${tiempo(c.seg_max)}`)
  if (i.metros != null && c.metros_max != null && c.metros_max > i.metros) r.push(`Distancia: ${i.metros} → ${c.metros_max} m`)
  return r
}
export const tiempo = (s: number) => s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')} min` : `${Math.round(s)} s`
export const fecha = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
