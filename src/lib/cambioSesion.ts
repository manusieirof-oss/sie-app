import { supabase } from './supabase'
import { hoyISO } from './fechas'

/**
 * POR QUÉ SE CAMBIÓ LA SESIÓN EN LA SALA.
 *
 * Lo normal es que cada cita llegue con su sesión ya puesta —de la rotación, de
 * Planificación o del plan de grupo—. Cuando a la hora de clase se cambia por otra, ese
 * cambio es el dato clínico, no la sesión nueva: alguien decidió que hoy no tocaba eso.
 *
 * Antes ese "por qué" se perdía entero. La cita quedaba apuntando a la sesión nueva, y
 * dentro de un mes no había forma de distinguir "esto se planificó así" de "esto se
 * cambió sobre la marcha porque el paciente venía cargado de correr". Son dos historias
 * clínicas distintas contadas con el mismo dato.
 *
 * SE GUARDA APARTE Y NO EN LA CITA. Un cambio es un hecho con su hora y su autor, y puede
 * pasar dos veces el mismo día. Metido en columnas de `citas`, el segundo cambio borra el
 * primero y la cita —que es el plan— acaba cargando con el registro de lo que le pasó.
 *
 * SE GUARDAN LOS NOMBRES, NO SOLO LOS ENLACES. Va contra la regla general de esta casa
 * —derivar y no almacenar—, y aquí es a propósito: una sesión se puede renombrar o
 * borrar, y entonces el apunte diría "cambió X por (nada)". Un registro histórico tiene
 * que poder leerse dentro de dos años sin depender de que nada se haya movido.
 */

export type MotivoCambio = {
  id: string
  nombre: string
  /** Qué caso cubre. Sale como `title` en el botón. */
  ayuda: string
}

/**
 * Los motivos. Lista corta a propósito: con quince nadie lee, se pulsa el primero y el
 * dato deja de valer. Si falta alguno se añade aquí y aparece en el panel; lo escrito
 * antes no se toca, porque se guarda el texto además del id.
 */
export const MOTIVOS_CAMBIO: MotivoCambio[] = [
  { id: 'cargado',   nombre: 'Viene cargado',        ayuda: 'Ha entrenado o corrido por su cuenta y esa zona no está fina' },
  { id: 'dolor',     nombre: 'Dolor o molestia',     ayuda: 'Algo le duele hoy y esa sesión no conviene' },
  { id: 'lo_pide',   nombre: 'Lo pide el paciente',  ayuda: 'Prefiere trabajar otra cosa hoy' },
  { id: 'estado',    nombre: 'No está para eso',     ayuda: 'Mal descanso, mal día, viene sin fuerza' },
  { id: 'material',  nombre: 'Material o espacio',   ayuda: 'No hay sitio o falta el material que pedía la sesión' },
  { id: 'nivel',     nombre: 'No le encaja',         ayuda: 'Le viene grande o se le queda corta' },
  { id: 'error',     nombre: 'Estaba mal puesta',    ayuda: 'La sesión programada no era la que le tocaba' },
  { id: 'otro',      nombre: 'Otro',                 ayuda: 'Cualquier otra cosa. Explícalo en la nota' },
]

export const nombreMotivo = (id: string) =>
  MOTIVOS_CAMBIO.find(m => m.id === id)?.nombre || id

export type CambioSesion = {
  id: string
  cita_id: string
  paciente_id: string
  fecha: string
  sesion_antes: string | null
  sesion_antes_nombre: string | null
  sesion_despues: string | null
  sesion_despues_nombre: string | null
  motivo: string
  nota: string | null
  created_at: string
}

/**
 * Deja constancia de un cambio: en su tabla y en el historial del paciente.
 *
 * El evento en la ficha no es un duplicado del registro. Son dos lecturas distintas: la
 * tabla sirve para contar —cuántas sesiones se cambian por dolor, qué bloque se cambia
 * siempre—, y el historial es donde se lee la vida del paciente en orden, junto a sus
 * valoraciones y sus bajas. Sin el evento, el cambio existe pero no se encuentra.
 *
 * Si falla la tabla no se escribe el evento: un apunte en el historial que remite a un
 * registro que no existe es peor que no tener ninguno de los dos.
 */
export async function registrarCambio(c: {
  citaId: string
  pacienteId: string
  fecha?: string
  antesId?: string | null
  antesNombre?: string | null
  despuesId?: string | null
  despuesNombre?: string | null
  motivo: string
  nota?: string | null
}) {
  if (!c.citaId || !c.pacienteId) return { ok: false as const, error: 'Falta la cita o el paciente' }
  if (!c.motivo) return { ok: false as const, error: 'Falta el motivo' }

  const fecha = c.fecha || hoyISO()
  const { error } = await supabase.from('cambios_sesion').insert({
    cita_id: c.citaId,
    paciente_id: c.pacienteId,
    fecha,
    sesion_antes: c.antesId || null,
    sesion_antes_nombre: c.antesNombre || null,
    sesion_despues: c.despuesId || null,
    sesion_despues_nombre: c.despuesNombre || null,
    motivo: c.motivo,
    nota: (c.nota || '').trim() || null,
  })
  if (error) return { ok: false as const, error: error.message }

  const antes = c.antesNombre || 'la que tenía'
  const despues = c.despuesNombre || 'ninguna'
  await supabase.from('eventos_paciente').insert({
    paciente_id: c.pacienteId,
    tipo: 'sesion',
    titulo: `Sesión cambiada en clase · ${nombreMotivo(c.motivo)}`,
    descripcion: `«${antes}» → «${despues}».` + ((c.nota || '').trim() ? ` ${c.nota!.trim()}` : ''),
    fecha,
  })

  return { ok: true as const }
}

/**
 * Los cambios de estas citas, el último de cada una.
 *
 * Para el taller: marcar en la tarjeta que lo que hay puesto no es lo que estaba
 * planificado. Una cita puede cambiarse dos veces en la misma clase —se prueba una cosa,
 * no encaja, se pone otra— y lo que cuenta entonces es el último.
 */
export async function cambiosDeCitas(citaIds: string[]): Promise<Record<string, CambioSesion>> {
  const mapa: Record<string, CambioSesion> = {}
  if (citaIds.length === 0) return mapa
  const { data, error } = await supabase.from('cambios_sesion')
    .select('*').in('cita_id', citaIds).order('created_at')
  // Sin `alert`: esto solo apaga un distintivo, y reventar la clase por eso sería peor.
  if (error) { console.error('No se han podido leer los cambios de sesión:', error.message); return mapa }
  ;(data || []).forEach((c: any) => { mapa[c.cita_id] = c })
  return mapa
}
