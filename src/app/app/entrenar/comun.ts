// ENTRENAR POR SU CUENTA: lo común a las pantallas.

export interface EjBib { id: string, nombre: string, medida: string, imagen: string | null, zona: string }

/** Qué se apunta en cada serie según cómo se mide (la misma idea que lib/medida). */
const CAMPOS: Record<string, [string | null, string]> = {
  peso_reps: ['peso', 'reps'], peso_tiempo: ['peso', 'segundos'], peso_metros: ['peso', 'metros'],
  reps: [null, 'reps'], tiempo: [null, 'segundos'], metros: [null, 'metros'],
  banda_reps: ['banda', 'reps'], banda_tiempo: ['banda', 'segundos'], banda_metros: ['banda', 'metros'],
}
export const camposDe = (medida: string) => CAMPOS[medida] || CAMPOS.peso_reps
export const ETIQUETA: Record<string, string> = { peso: 'kg', banda: 'Goma', reps: 'Reps', segundos: 'Segundos', metros: 'Metros' }

export const hoyLargo = () => new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
export const fechaCorta = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')
