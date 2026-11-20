// EL COLOR DE CADA CROMO sube con las veces que lo ha hecho en clase. Brillar es otra
// cosa: que el centro ha comprobado su técnica (todos los ítems de ejecución bien).
export const NIVELES = [
  { desde: 1, nombre: 'Bronce', clase: 'bronce' },
  { desde: 5, nombre: 'Plata', clase: 'plata' },
  { desde: 15, nombre: 'Oro', clase: 'oro' },
  { desde: 30, nombre: 'Diamante', clase: 'diamante' },
]
export const nivelDe = (veces: number) => [...NIVELES].reverse().find(n => veces >= n.desde) || null
export const siguienteDe = (veces: number) => NIVELES.find(n => veces < n.desde) || null

export interface Cromo {
  id: string, nombre: string, imagen: string | null, zona: string, veces: number
  primera: string | null, ultima: string | null
  peso_max: number | null, reps_max: number | null, seg_max: number | null, metros_max: number | null
  brilla: boolean, favorito: boolean, numero?: number
}
export const tiempo = (s: number) => s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')} min` : `${Math.round(s)} s`
export const fecha = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
