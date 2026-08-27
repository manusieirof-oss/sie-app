import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// EN QUÉ SITUACIÓN ESTÁ UN PACIENTE
//
// Único sitio donde se decide qué significa cada estado y qué consecuencias
// tiene. Estaba escrito suelto en cada pantalla —un mapa de colores en la lista,
// un `.in('estado', [...])` distinto en cada consulta— y por eso "pausa" acabó
// significando dos cosas incompatibles a la vez.
//
// LA PREGUNTA QUE SEPARA LOS ESTADOS ES: ¿SE LE COBRA EL MES?
//
//   activo       → viene y paga.
//   pausa        → de vacaciones, CON fecha de vuelta. Se le cobra igual y se
//                  reactiva solo al pasar la fecha. Sigue teniendo su plaza.
//   puede_volver → se fue sin fecha, pero dijo que volvería. NO se le cobra y no
//                  cuenta como cliente, pero no se pierde de vista.
//   baja         → se fue. Punto.
//
// El cuarto existe porque sin él la gente que "igual vuelve" se quedaba en
// pausa para no olvidarla, y pausa cobra. O cobrabas de más, o los dabas de baja
// y desaparecían. Ninguna de las dos era lo que querías.
// ---------------------------------------------------------------------------

export const ESTADOS_PACIENTE = [
  { id: 'activo', nombre: 'Activo', badge: '● Activo',
    bg: 'var(--gl)', col: 'var(--gd)',
    ayuda: 'Viene a la clínica y se le cobra el mes.' },

  { id: 'pausa', nombre: 'Pausa', badge: 'Pausa',
    bg: 'var(--ambl)', col: '#8A6410',
    ayuda: 'De vacaciones, con fecha de vuelta. Se le cobra el mes igual y se reactiva solo al volver.' },

  { id: 'puede_volver', nombre: 'Puede volver', badge: 'Puede volver',
    bg: 'var(--bl)', col: 'var(--gr)',
    ayuda: 'Lo dejó sin fecha de vuelta pero dijo que volvería. No se le cobra y no cuenta como cliente.' },

  { id: 'baja', nombre: 'Baja', badge: '○ Baja',
    bg: 'var(--redl)', col: 'var(--red)',
    ayuda: 'Se fue. No se le cobra ni aparece en las listas de trabajo.' },
] as const

export type EstadoPaciente = typeof ESTADOS_PACIENTE[number]['id']

export function estadoDe(id?: string | null) {
  return ESTADOS_PACIENTE.find(e => e.id === id) || ESTADOS_PACIENTE[0]
}

/**
 * A quién se le cobra el mes. La lista que va en las consultas de Cobros y en
 * la renovación de cuotas.
 *
 * `puede_volver` NO está, y es la razón de que exista: esa gente no paga, así
 * que meterla aquí llenaría Cobros de cuotas fantasma.
 */
export const SE_LE_COBRA: string[] = ['activo', 'pausa']

/** A quién se le puede poner una cita. Los que pueden volver, también: citarlos es cómo vuelven. */
export const SE_LE_CITA: string[] = ['activo', 'pausa', 'puede_volver']

/**
 * A los cuántos meses en "puede volver" conviene replantearse la ficha.
 *
 * Se AVISA, no se mueve: un cambio de estado que nadie decidió es imposible de
 * rastrear seis meses después, cuando alguien pregunte por qué fulanita figura
 * de baja si nunca se lo dijo a nadie.
 */
export const MESES_HASTA_REVISAR = 12

// ---------------------------------------------------------------------------
// CUÁNTO HACE QUE NO VIENE
//
// Derivado de las citas, no un contador guardado. Un contador habría que
// mantenerlo desde tres sitios distintos y acabaría diciendo ocho meses de
// alguien que vino la semana pasada.
// ---------------------------------------------------------------------------

/** Meses enteros desde una fecha 'YYYY-MM-DD'. null si no hay fecha. */
export function mesesDesde(fecha?: string | null): number | null {
  if (!fecha) return null
  const d = new Date(fecha + 'T12:00:00')
  const hoy = new Date()
  return (hoy.getFullYear() - d.getFullYear()) * 12 + (hoy.getMonth() - d.getMonth())
}

export function textoDesde(fecha?: string | null): string {
  const m = mesesDesde(fecha)
  if (m == null) return 'nunca ha venido'
  if (m <= 0) return 'este mes'
  if (m === 1) return 'hace 1 mes'
  if (m < 12) return `hace ${m} meses`
  const a = Math.floor(m / 12), r = m % 12
  return r === 0 ? `hace ${a} año${a > 1 ? 's' : ''}` : `hace ${a} año${a > 1 ? 's' : ''} y ${r} ${r === 1 ? 'mes' : 'meses'}`
}

export type UltimaClase = { paciente_id: string, fecha: string | null }

/**
 * La última clase a la que fue de verdad cada paciente de la lista.
 *
 * Solo cuentan las `realizada`: una falta es un hueco perdido, no una visita, y
 * una cita programada para dentro de un mes no dice nada de cuánto hace que no
 * aparece. Se pide de una vez para toda la lista, no una consulta por persona.
 */
export async function ultimaClaseDe(pacienteIds: string[]) {
  if (!pacienteIds.length) return { ok: true as const, mapa: new Map<string, string>() }
  const { data, error } = await supabase.from('citas')
    .select('paciente_id, fecha')
    .in('paciente_id', pacienteIds)
    .eq('estado', 'realizada')
    .order('fecha', { ascending: false })
  if (error) return { ok: false as const, error: error.message, mapa: new Map<string, string>() }
  const mapa = new Map<string, string>()
  // Vienen de la más reciente a la más antigua: la primera de cada uno es la suya.
  for (const c of (data || []) as any[]) {
    if (c.paciente_id && !mapa.has(c.paciente_id)) mapa.set(c.paciente_id, c.fecha)
  }
  return { ok: true as const, mapa }
}

/**
 * Quién hizo la valoración y nunca llegó a empezar.
 *
 * No es un estado que haya que marcar a mano: es una situación que se deduce de
 * que no tenga ninguna clase dada. Marcarlo a mano significaría acordarse de
 * desmarcarlo el día que por fin empiece, y nadie se acuerda de eso.
 *
 * `pendiente_valoracion` se excluye porque esos ni siquiera han llegado a
 * valorarse todavía: están en otra fase y tienen su propio aviso.
 */
export function valoraronYNoEmpezaron(pacientes: any[], ultimaClase: Map<string, string>) {
  return pacientes.filter(p =>
    !p.pendiente_valoracion &&
    p.estado !== 'baja' &&
    !ultimaClase.has(p.id))
}

// ---------------------------------------------------------------------------
// CAMBIOS DE ESTADO PROGRAMADOS
//
// Alguien avisa el día 10 de que lo deja a final de mes. Hasta ahora había que
// elegir entre marcarlo de baja ya —y quedarse sin sus quince clases pendientes
// en la agenda— o acordarse el día 30. Ahora se apunta y se aplica solo.
//
// Lo aplica el cron diario, no la app: si dependiera de que alguien abriera una
// pantalla, una baja del día 30 se quedaría sin aplicar hasta que a alguien le
// diera por entrar. Ver sql/estados_programados.sql.
// ---------------------------------------------------------------------------

/** Estados que se pueden programar. Solo salidas: para volver está Reactivar. */
export const ESTADOS_PROGRAMABLES = ['baja', 'puede_volver'] as const

export type EstadoPrevisto = {
  paciente_id: string
  nombre: string
  apellidos: string
  estado_actual: string
  estado_programado: string
  estado_programado_desde: string
  estado_programado_motivo: string | null
  dias_para: number
  bono_tipo: string | null
}

/**
 * Deja programado el cambio. No toca el estado actual: el paciente sigue
 * viniendo y pagando hasta la fecha, que es justamente el motivo de esto.
 */
export async function programarEstado(
  pacienteId: string,
  estado: string,
  desde: string,
  motivo?: string | null,
) {
  if (!ESTADOS_PROGRAMABLES.includes(estado as any)) {
    return { ok: false as const, error: `No se puede programar el estado "${estado}"` }
  }
  if (!desde) return { ok: false as const, error: 'Falta la fecha' }

  const { error } = await supabase.from('pacientes').update({
    estado_programado: estado,
    estado_programado_desde: desde,
    estado_programado_motivo: motivo || null,
  }).eq('id', pacienteId)
  if (error) return { ok: false as const, error: error.message }

  await supabase.from('eventos_paciente').insert({
    paciente_id: pacienteId, tipo: 'baja',
    titulo: `${estado === 'baja' ? 'Baja' : 'Puede volver'} programado para el ${new Date(desde + 'T12:00:00').toLocaleDateString('es-ES')}`,
    descripcion: (motivo ? `${motivo}. ` : '') + 'Hasta esa fecha sigue viniendo y se le cobra normalmente.',
    fecha: new Date().toISOString().split('T')[0],
  })
  return { ok: true as const }
}

/** Anula lo programado. Se arrepintió, o se apuntó mal. */
export async function anularProgramacion(pacienteId: string) {
  const { error } = await supabase.from('pacientes').update({
    estado_programado: null, estado_programado_desde: null, estado_programado_motivo: null,
  }).eq('id', pacienteId)
  if (error) return { ok: false as const, error: error.message }
  await supabase.from('eventos_paciente').insert({
    paciente_id: pacienteId, tipo: 'baja',
    titulo: 'Cambio de estado anulado',
    descripcion: 'Se ha quitado la baja que estaba programada. Sigue como cliente.',
    fecha: new Date().toISOString().split('T')[0],
  })
  return { ok: true as const }
}

/** Lo que viene: quién se va, cuándo y con qué bono. Para verlo antes de que pase. */
export async function estadosPrevistos() {
  const { data, error } = await supabase.from('v_estados_previstos').select('*')
  if (error) return { ok: false as const, error: error.message, filas: [] as EstadoPrevisto[] }
  return { ok: true as const, error: null, filas: (data || []) as EstadoPrevisto[] }
}

/** "en 12 días", "hoy", "hace 3 días" (esto último es que el cron no ha pasado aún). */
export function textoCuando(dias: number): string {
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'mañana'
  if (dias > 1) return `en ${dias} días`
  return dias === -1 ? 'ayer, pendiente de aplicar' : `hace ${Math.abs(dias)} días, pendiente de aplicar`
}
