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

/**
 * Estados que se pueden programar: las dos salidas y la vuelta.
 *
 * La vuelta hace falta porque alguien puede avisar en agosto de que se
 * reincorpora el 1 de octubre. Ponerlo activo ya lo metería en Cobros y le
 * generaría cuota de dos meses que no va a pagar; la pausa tampoco vale,
 * porque la pausa cobra.
 */
export const ESTADOS_PROGRAMABLES = ['baja', 'puede_volver', 'activo'] as const

/**
 * Cuántos días se marca a alguien como "reciente" tras cambiar de estado.
 *
 * Quien acaba de volver necesita que le mires la ficha: ¿tiene bono?, ¿tiene
 * citas?, ¿le cuadra el horario? Pasadas un par de semanas ya es uno más y la
 * marca solo sería ruido.
 */
export const DIAS_RECIENTE = 10

/** true si acaba de cambiar de estado. `estado_desde` en null es "no se sabe". */
export function esReciente(p: { estado_desde?: string | null }): boolean {
  if (!p?.estado_desde) return false
  const d = new Date(p.estado_desde + 'T12:00:00')
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000)
  return dias >= 0 && dias <= DIAS_RECIENTE
}

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

/**
 * QUIEN DEJA DE SER CLIENTE NO ARRASTRA CUOTAS FUTURAS.
 *
 * Al dar de baja se le borraban las citas y se le cambiaba el estado, pero el bono seguía
 * `activo`. La renovación mensual sí lo esquivaba —no le generaba cuota nueva— pero la que
 * ya tuviera seguía viva: salía con bono en la lista y contaba como pendiente de cobro en
 * Finanzas, mezclando a quien debe dinero con quien ya no viene.
 *
 * LA DEL MES EN CURSO SE RESPETA. Si el mes ha empezado y no avisó, ese mes se cobra
 * entero; si luego no paga, queda como impago, que es información y no un error. Se
 * desactivan solo las de meses POSTERIORES, que son cuotas de un servicio que no va a
 * recibir.
 *
 * Los bonos de SESIONES no se tocan: están pagados por adelantado y qué hacer con las
 * sesiones que le sobran es una decisión comercial, no algo que deba resolver un cambio
 * de estado.
 */
export async function cerrarCuotasFuturas(pacienteId: string) {
  const hoy = new Date()
  const mes = hoy.getMonth() + 1, anio = hoy.getFullYear()

  const { data, error } = await supabase.from('bonos')
    .select('id,mes,anio,sesiones_totales')
    .eq('paciente_id', pacienteId).eq('activo', true)
  if (error) return { ok: false as const, error: error.message, cerradas: 0 }

  const futuras = (data || []).filter((b: any) =>
    b.sesiones_totales == null && (b.anio > anio || (b.anio === anio && b.mes > mes)))
  if (futuras.length === 0) return { ok: true as const, cerradas: 0 }

  const { error: errUpd } = await supabase.from('bonos')
    .update({ activo: false }).in('id', futuras.map((b: any) => b.id))
  if (errUpd) return { ok: false as const, error: errUpd.message, cerradas: 0 }
  return { ok: true as const, cerradas: futuras.length }
}

/**
 * Aplica los cambios de estado que ya han llegado a su fecha.
 *
 * `programarEstado` guardaba la intención —"se va de baja el 1 de septiembre"— y NADIE la
 * ejecutaba. La renovación de cuotas lo esquivaba calculando el estado al vuelo, que es
 * por lo que no se notaba, pero la ficha del paciente seguía diciendo "activo" para
 * siempre y todo lo demás también: las citas, el taller, los avisos.
 *
 * Se ejecuta al entrar en la app, junto a la renovación de cuotas. No hace falta un cron:
 * lo importante no es que ocurra a las 00:00, es que ocurra antes de que nadie mire.
 */
export async function aplicarEstadosProgramados() {
  const hoy = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase.from('pacientes')
    .select('id,nombre,apellidos,estado,estado_programado,estado_programado_desde,estado_programado_motivo')
    .not('estado_programado', 'is', null)
    .lte('estado_programado_desde', hoy)
  if (error) return { aplicados: 0, fallidos: [error.message] }

  const fallidos: string[] = []
  let aplicados = 0

  for (const p of (data || [])) {
    const nuevo = p.estado_programado as string
    const { error: errUpd } = await supabase.from('pacientes').update({
      estado: nuevo,
      estado_desde: p.estado_programado_desde,
      // La programación se consume: si se quedara puesta, volvería a aplicarse cada vez.
      estado_programado: null, estado_programado_desde: null, estado_programado_motivo: null,
      // Una baja no es una pausa con otro nombre: sin esto queda una fecha de vuelta
      // apuntando a alguien que ya no está.
      ...(nuevo === 'baja' ? { pausa_desde: null, pausa_hasta: null } : {}),
    }).eq('id', p.id)
    if (errUpd) { fallidos.push(`${p.nombre}: ${errUpd.message}`); continue }

    // Deja de ser cliente: se le cierran las cuotas de meses posteriores.
    if (nuevo === 'baja' || nuevo === 'puede_volver') await cerrarCuotasFuturas(p.id)

    await supabase.from('eventos_paciente').insert({
      paciente_id: p.id, tipo: nuevo === 'baja' ? 'baja' : 'estado',
      titulo: nuevo === 'baja' ? 'Baja del servicio' : `Estado: ${estadoDe(nuevo).nombre}`,
      descripcion: `Estaba programado para el ${p.estado_programado_desde}.${p.estado_programado_motivo ? ' ' + p.estado_programado_motivo : ''}`,
      fecha: hoy,
    })
    aplicados++
  }
  return { aplicados, fallidos }
}
