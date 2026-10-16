import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// CÓMO SE MIDE UN EJERCICIO: CARGA × VOLUMEN (+ ESFUERZO OPCIONAL)
//
// Antes eran tres tipos cerrados (peso y reps, tiempo, peso y tiempo) y el taller
// pedía kg a todo: a una flexión, a un ejercicio con banda… Ahora son dos piezas:
//   - CARGA: con peso (kg), peso corporal (nada que apuntar) o banda (cuál).
//   - VOLUMEN: repeticiones, segundos o metros.
// El ESFUERZO (RPE, RIR, dolor) no es del ejercicio: se apunta en la sala si en
// Ajustes está encendido, en cualquier ejercicio y siempre opcional.
//
// En la base sigue siendo un texto en `ejercicios.tipo_medida`. Los tres de siempre
// conservan su nombre ('peso_reps', 'tiempo', 'peso_tiempo') para no migrar nada.
// En las series se guarda cada campo por su nombre: peso, banda, reps, segundos,
// metros, rpe, rir, dolor.
// ---------------------------------------------------------------------------

export type Carga = 'kg' | 'corporal' | 'banda'
export type Volumen = 'reps' | 'segundos' | 'metros'

const IDS: Record<string, [Carga, Volumen]> = {
  peso_reps: ['kg', 'reps'], peso_tiempo: ['kg', 'segundos'], peso_metros: ['kg', 'metros'],
  reps: ['corporal', 'reps'], tiempo: ['corporal', 'segundos'], metros: ['corporal', 'metros'],
  banda_reps: ['banda', 'reps'], banda_tiempo: ['banda', 'segundos'], banda_metros: ['banda', 'metros'],
}

export const CARGAS: { id: Carga, nombre: string, ayuda: string }[] = [
  { id: 'kg', nombre: 'Con peso', ayuda: 'Se apuntan los kg' },
  { id: 'corporal', nombre: 'Peso corporal', ayuda: 'Sin carga: no se apunta nada' },
  { id: 'banda', nombre: 'Banda', ayuda: 'Se apunta qué banda' },
]
export const VOLUMENES: { id: Volumen, nombre: string, ayuda: string }[] = [
  { id: 'reps', nombre: 'Repeticiones', ayuda: 'Cuántas' },
  { id: 'segundos', nombre: 'Tiempo', ayuda: 'Segundos' },
  { id: 'metros', nombre: 'Distancia', ayuda: 'Metros' },
]

export function partesMedida(id?: string | null): { carga: Carga, volumen: Volumen } {
  const p = IDS[id || ''] || IDS.peso_reps
  return { carga: p[0], volumen: p[1] }
}
export function idMedida(carga: Carga, volumen: Volumen): string {
  return Object.keys(IDS).find(k => IDS[k][0] === carga && IDS[k][1] === volumen) || 'peso_reps'
}
export const esMedida = (id?: string | null) => !!id && id in IDS

/** "Con peso · Repeticiones" → corto, para chapas: "Kg × reps". */
export function nombreMedida(id?: string | null): string {
  const { carga, volumen } = partesMedida(id)
  const c = carga === 'kg' ? 'Peso' : carga === 'banda' ? 'Banda' : ''
  const v = volumen === 'reps' ? 'reps' : volumen === 'segundos' ? 'tiempo' : 'metros'
  return c ? `${c} y ${v}` : (volumen === 'reps' ? 'Reps' : volumen === 'segundos' ? 'Tiempo' : 'Metros')
}
export const TODAS_MEDIDAS = Object.keys(IDS)

/**
 * Los campos de cada serie en la sala. El ISOMÉTRICO va por segundos aunque el
 * ejercicio se mida por repeticiones (y con kg si lleva carga), como antes.
 */
export function camposSerie(id?: string | null, opts: { isometrico?: boolean } = {}): string[] {
  let { carga, volumen } = partesMedida(id)
  if (opts.isometrico && volumen === 'reps') volumen = 'segundos'
  const c = carga === 'kg' ? ['peso'] : carga === 'banda' ? ['banda'] : []
  return [...c, volumen]
}
export const UNIDAD: Record<string, string> = { peso: 'kg', reps: 'reps', segundos: 'seg', metros: 'm', banda: 'banda' }

// ---- Ajustes: bandas y esfuerzo -------------------------------------------------

export const ESCALAS_BANDA: Record<string, string[]> = {
  theraband: ['Amarilla', 'Roja', 'Verde', 'Azul', 'Negra', 'Plata', 'Oro'],
  resistencia: ['Extra suave', 'Suave', 'Media', 'Fuerte', 'Extra fuerte'],
  kg: ['5 kg', '10 kg', '15 kg', '25 kg', '35 kg', '50 kg'],
}
/** Color para pintar la chapa de cada banda Thera-Band (las demás, gris). */
export const COLOR_BANDA: Record<string, string> = {
  Amarilla: '#E8C93A', Roja: '#C9483C', Verde: '#4E9A55', Azul: '#3B6FB0', Negra: '#2E2E2C', Plata: '#A9ABAE', Oro: '#C2A14A',
}

export const ESFUERZOS = [
  { id: 'rpe', nombre: 'RPE', ayuda: 'Lo duro que fue, de 1 a 10', min: 1, max: 10 },
  { id: 'rir', nombre: 'RIR', ayuda: 'Repeticiones que le quedaban (0 a 5)', min: 0, max: 5 },
  { id: 'dolor', nombre: 'Dolor', ayuda: 'Dolor durante el ejercicio, de 0 a 10', min: 0, max: 10 },
] as const

export type AjustesMedida = { bandas: string[], esfuerzo: string[] }
const PREDETERMINADO: AjustesMedida = { bandas: ESCALAS_BANDA.theraband, esfuerzo: [] }

/** Lee de los ajustes `medida_bandas` (lista JSON) y `medida_esfuerzo` (lista JSON). */
export function leerAjustesMedida(m: Record<string, string>): AjustesMedida {
  const lista = (v: string | undefined, def: string[]) => { try { const x = JSON.parse(v || ''); return Array.isArray(x) ? x.map(String) : def } catch { return def } }
  const bandas = lista(m.medida_bandas, PREDETERMINADO.bandas).filter(Boolean)
  return { bandas: bandas.length ? bandas : PREDETERMINADO.bandas, esfuerzo: lista(m.medida_esfuerzo, []) }
}

// Una vez por página: el taller los pide desde cada casilla.
let pedido: Promise<AjustesMedida> | null = null
export function ajustesMedida(): Promise<AjustesMedida> {
  if (!pedido) pedido = (async () => {
    const { data } = await supabase.from('ajustes').select('clave,valor').in('clave', ['medida_bandas', 'medida_esfuerzo'])
    const m: Record<string, string> = {}; (data || []).forEach((a: any) => { m[a.clave] = a.valor || '' })
    return leerAjustesMedida(m)
  })().catch(() => PREDETERMINADO)
  return pedido
}

/** Posición de una banda en la escala (1 = la más suave), para comparar progresos. */
export const nivelBanda = (banda: any, bandas: string[]) => {
  const i = bandas.findIndex(b => b.toLowerCase() === String(banda ?? '').toLowerCase())
  return i < 0 ? null : i + 1
}
