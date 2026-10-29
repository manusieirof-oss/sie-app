import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// QUIEN SE HACE CARGO DE CADA CLASE
//
// El horario es un patron semanal -"Ana, lunes y miercoles de 9 a 13, sala A"-
// porque es lo que menos hay que rellenar: se pone una vez y vale para todo el
// curso. Un dia suelto se resuelve con una fila con FECHA, que gana sobre el
// fijo sin tocarlo: cubrir una baja no puede obligarte a reescribir el horario
// de siempre y acordarte de deshacerlo.
//
// Una fila con fecha y sin perfil es "ese dia, en esa franja, nadie": tambien
// hace falta poder decir eso.
// ---------------------------------------------------------------------------

export type Turno = {
  id: string
  perfil_id: string | null
  /** 1 lunes … 6 sabado. Null en los cambios de un dia. */
  dia_semana: number | null
  /** Solo en los cambios de un dia. */
  fecha: string | null
  hora_inicio: string
  hora_fin: string
  /** Vacio = todas las salas. */
  sala: string | null
  desde: string | null
  hasta: string | null
  perfil?: { id: string, nombre: string | null } | null
}

export const DIAS = [
  { valor: 1, corto: 'Lun', nombre: 'Lunes' },
  { valor: 2, corto: 'Mar', nombre: 'Martes' },
  { valor: 3, corto: 'Mié', nombre: 'Miércoles' },
  { valor: 4, corto: 'Jue', nombre: 'Jueves' },
  { valor: 5, corto: 'Vie', nombre: 'Viernes' },
  { valor: 6, corto: 'Sáb', nombre: 'Sábado' },
]

/** 1 lunes … 7 domingo, como los dias de la semana de toda la vida. */
export function diaSemanaDe(fecha: string): number {
  const d = new Date(fecha + 'T12:00:00').getDay()
  return d === 0 ? 7 : d
}

const min = (h?: string | null) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(h || ''))
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1
}

export async function cargarTurnos(): Promise<Turno[]> {
  const { data } = await supabase.from('turnos')
    .select('*, perfil:perfil_id(id,nombre)')
    .order('dia_semana').order('hora_inicio')
  return (data || []) as any
}

/**
 * Los turnos que valen un dia concreto: los cambios de ese dia y los fijos vigentes.
 *
 * QUIÉN GANA SE DECIDE POR HORA, no aquí. Antes un cambio de hoy en una franja (10:00,
 * sala B) tapaba TODO el horario fijo de esa sala el día entero: cambiabas una clase y
 * las demás de la sala se quedaban sin entrenador. Ver `responsableDe`.
 */
export function turnosDelDia(turnos: Turno[], fecha: string): Turno[] {
  const dia = diaSemanaDe(fecha)
  const puntuales = turnos.filter(t => t.fecha === fecha)
  const vigente = (t: Turno) =>
    (t.desde == null || t.desde <= fecha) && (t.hasta == null || t.hasta >= fecha)
  const fijos = turnos.filter(t => t.fecha == null && t.dia_semana === dia && vigente(t))
  return [...puntuales, ...fijos]
}

/**
 * De los turnos que cubren una hora en una sala, los que mandan:
 *   1. un cambio de ese día (incluido «nadie») tapa a los fijos de esa sala A ESA HORA;
 *   2. entre fijos, el más reciente (`desde` más tarde): «desde hoy, siempre Mario»
 *      gana al horario de antes sin tener que partirlo.
 */
function mandan(cubren: Turno[]): Turno[] {
  const puntuales = cubren.filter(t => t.fecha != null)
  if (puntuales.length) return puntuales
  const desde = (t: Turno) => t.desde || ''
  const ultimo = cubren.reduce((m, t) => desde(t) > m ? desde(t) : m, '')
  return cubren.filter(t => desde(t) === ultimo)
}

/**
 * Quien lleva una franja, en tres escalones.
 *
 * 1. El turno de ESA sala. 2. El turno sin sala, que vale para todas. 3. Si no
 * hay ninguno, quien este trabajando a esa hora, sea donde sea.
 *
 * El tercero es una deduccion y va marcado como tal: con gente citada y nadie
 * asignado, decir quien esta a esa hora es mas util que dejarlo en blanco, pero
 * no es lo mismo que haberlo decidido.
 */
export function responsableDe(turnos: Turno[], fecha: string, hora: string, sala?: string | null) {
  const h = min(hora)
  if (h < 0) return { lista: [] as Turno[], deducido: false }
  const cubren = turnosDelDia(turnos, fecha).filter(t => min(t.hora_inicio) <= h && h < min(t.hora_fin))
  // Por sala: lo de esa sala, si no lo de todas las salas. Un «nadie» de hoy (sin perfil)
  // también cuenta para tapar: es decir que esa clase hoy no la lleva nadie.
  const deSala = mandan(cubren.filter(t => sala && String(t.sala || '') === String(sala)))
  if (deSala.length > 0) { const l = deSala.filter(t => t.perfil_id != null); return { lista: l, deducido: false } }
  const deTodas = mandan(cubren.filter(t => (t.sala || '') === ''))
  if (deTodas.length > 0) { const l = deTodas.filter(t => t.perfil_id != null); return { lista: l, deducido: false } }
  // Nadie asignado a esa sala ni a todas: quien esté trabajando a esa hora, en cualquier sala.
  const suyos = cubren.filter(t => t.perfil_id != null)
  return { lista: suyos, deducido: suyos.length > 0 }
}

export function quienLleva(turnos: Turno[], fecha: string, hora: string, sala?: string | null) {
  return responsableDe(turnos, fecha, hora, sala).lista
}

/** Los nombres, para pintarlos. "Ana · Marta", o vacio si nadie. */
export function nombresDe(turnos: Turno[], fecha: string, hora: string, sala?: string | null) {
  return quienLleva(turnos, fecha, hora, sala)
    .map(t => (t.perfil?.nombre || '').trim()).filter(Boolean)
}

export async function guardarTurno(t: Partial<Turno>) {
  const fila: any = {
    perfil_id: t.perfil_id || null,
    dia_semana: t.fecha ? null : (t.dia_semana ?? null),
    fecha: t.fecha || null,
    hora_inicio: t.hora_inicio, hora_fin: t.hora_fin,
    sala: (t.sala || '') || null,
    desde: t.desde || null, hasta: t.hasta || null,
  }
  const { error } = t.id
    ? await supabase.from('turnos').update(fila).eq('id', t.id)
    : await supabase.from('turnos').insert(fila)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

export async function borrarTurno(id: string) {
  const { error } = await supabase.from('turnos').delete().eq('id', id)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}
