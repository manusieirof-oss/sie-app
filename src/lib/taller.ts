import { supabase } from './supabase'
import { soloVigentes } from './linaje'

/**
 * Quién viene hoy al taller, y con qué sesión. UN SOLO SITIO.
 *
 * EL ESLABÓN QUE FALTABA. El taller no leía `citas` en ningún sitio —ni `taller/page.tsx`
 * ni `ModoClase.tsx`—, así que la cadena se cortaba justo al final:
 *
 *     agenda (quién viene)  →  planificación (qué sesión le toca)  →  ✗  →  taller
 *
 * Se tecleaban los pacientes a mano cada mañana teniendo la agenda al lado, y la sesión
 * que se había asignado en Planificación no llegaba: había que volver a elegirla en un
 * desplegable. Dos oportunidades diarias de entrenar a alguien con la sesión de otro día.
 *
 * QUÉ SESIÓN LE TOCA. Por orden:
 *
 *   1. La de la cita (`citas.sesion_id`). Es la que se repartió con la rotación y la que
 *      manda: dice qué se planificó para HOY, no qué se planificó en general.
 *   2. Si la cita no tiene, la única vigente que tenga el paciente. Con una sola no hay
 *      duda posible y preguntar sería un clic de más cada día.
 *   3. Si tiene varias vigentes, ninguna. Se ofrecen todas y se elige, porque acertar por
 *      sorteo entre "Empujes" y "Tirones" es peor que preguntar.
 *
 * Nunca se escoge una sesión de una tanda vieja: `soloVigentes` las deja fuera. Si la cita
 * apunta a una vieja se respeta igual —es lo que se decidió para ese día— y se avisa.
 */

export type PacienteDelDia = {
  citaId: string
  pacienteId: string
  nombre: string
  hora: string
  sala: string
  tipo: string
  /** 'programada' | 'realizada' | 'falta' | 'cancelada' */
  estado: string
  notas: string
  /** La sesión que toca, ya resuelta. null si hay que elegirla. */
  sesion: any | null
  /** De dónde ha salido, para poder decirlo en pantalla sin volver a calcularlo. */
  origen: 'cita' | 'unica' | 'ninguna'
  /** Las vigentes del paciente, para el desplegable de cambiar sobre la marcha. */
  disponibles: any[]
  /** true si la sesión de la cita pertenece a una tanda ya superada. */
  sesionVieja: boolean
}

const nombreDe = (p: any) =>
  (p?.nombre_clinica || `${p?.nombre || ''} ${p?.apellidos || ''}`).trim() || 'Sin nombre'

/**
 * Qué sesión toca. Es la decisión del módulo, así que va aparte y se puede probar sola.
 *
 * Sin esto separado, la regla habría quedado enterrada dentro de la consulta y solo se
 * podría comprobar con la clínica abierta y pacientes de verdad delante.
 */
export function sesionQueToca(deLaCita: any | null, vigentes: any[]): { sesion: any | null, origen: PacienteDelDia['origen'] } {
  if (deLaCita) return { sesion: deLaCita, origen: 'cita' }
  if (vigentes.length === 1) return { sesion: vigentes[0], origen: 'unica' }
  return { sesion: null, origen: 'ninguna' }
}

/**
 * Los pacientes con cita ese día, en orden de hora.
 *
 * `sala` vacío = todas. Las canceladas no salen: no vienen, y dejarlas obligaría a
 * distinguirlas de un vistazo cada mañana. Las faltas SÍ salen, porque marcar una falta
 * es reversible y el que llega tarde tiene que poder volver a la lista.
 */
export async function pacientesDelDia(fecha: string, sala?: string): Promise<PacienteDelDia[]> {
  if (!fecha) return []

  let q = supabase.from('citas')
    .select('id,fecha,hora,sala,tipo,estado,notas,paciente_id, pacientes(id,nombre,apellidos,nombre_clinica), sesiones:sesion_id(*)')
    .eq('fecha', fecha)
    .neq('estado', 'cancelada')
    .not('paciente_id', 'is', null)
    .order('hora')
  if (sala) q = q.eq('sala', sala)

  const { data: citas } = await q
  if (!citas || citas.length === 0) return []

  // Las sesiones de todos los pacientes del día en UNA consulta. Una por paciente serían
  // veinte consultas en una mañana de clase, y la pantalla se abre veinte veces al día.
  const ids = Array.from(new Set(citas.map((c: any) => c.paciente_id).filter(Boolean)))
  const { data: todas } = await supabase.from('sesiones')
    .select('*').in('paciente_id', ids).order('created_at', { ascending: false })

  const porPaciente: Record<string, any[]> = {}
  ;(todas || []).forEach((s: any) => { (porPaciente[s.paciente_id] ||= []).push(s) })

  return citas.map((c: any) => {
    const suyas = porPaciente[c.paciente_id] || []
    const vigentes = soloVigentes(suyas)
    const deLaCita = Array.isArray(c.sesiones) ? c.sesiones[0] : c.sesiones

    const { sesion, origen } = sesionQueToca(deLaCita, vigentes)
    const p = Array.isArray(c.pacientes) ? c.pacientes[0] : c.pacientes

    return {
      citaId: c.id,
      pacienteId: c.paciente_id,
      nombre: nombreDe(p),
      hora: (c.hora || '').slice(0, 5),
      sala: c.sala || '',
      tipo: c.tipo || '',
      estado: c.estado || 'programada',
      notas: c.notas || '',
      sesion,
      origen,
      // Las de la cita se añaden a la lista aunque sean viejas: si hoy se entrena esa, en
      // el desplegable tiene que poder volver a elegirse tras haber mirado otra.
      disponibles: sesion && !vigentes.some(v => v.id === sesion.id) ? [sesion, ...vigentes] : vigentes,
      sesionVieja: !!(deLaCita && !vigentes.some(v => v.id === deLaCita.id)),
    }
  })
}

/**
 * Cambiar la sesión de una cita sobre la marcha.
 *
 * Se guarda en la CITA y no en ningún sitio del taller. Así el cambio queda donde ya se
 * mira —la agenda y la ficha— y mañana se sigue viendo qué se entrenó de verdad ese día.
 */
export async function asignarSesionACita(citaId: string, sesionId: string | null) {
  const { error } = await supabase.from('citas').update({ sesion_id: sesionId }).eq('id', citaId)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

/**
 * EL ESTADO DE LA CITA NO SE TOCA DESDE AQUÍ.
 *
 * Vino, no vino, canceló: eso se pone en la AGENDA y solo en la agenda. El taller lo lee
 * para pintarlo y nada más.
 *
 * Hubo una versión de esto con botones de "Vino / No vino" en el taller. Estaba mal por la
 * razón de siempre: dos sitios escribiendo el mismo dato acaban discrepando, y entonces no
 * hay forma de saber cuál manda. Que el taller traiga a alguien y no se le llegue a anotar
 * nada no es un problema —no se cubre nada— y el estado se pone después desde la agenda.
 */

/** Cuántos vienen y a cuántos les falta sesión. Para el encabezado, sin recorrer la lista fuera. */
export function resumenDelDia(lista: PacienteDelDia[]) {
  return {
    total: lista.length,
    sinSesion: lista.filter(p => !p.sesion).length,
  }
}
