import { supabase } from './supabase'
import { duplicarSesion, registrarSesion } from './sesiones'

/**
 * Linaje de sesiones: qué versión sustituyó a cuál.
 *
 * Una sesión guarda en `evolucion_de` la sesión de la que es la siguiente versión.
 * Con eso, "Empujes" deja de ser ocho sesiones sueltas con el mismo nombre y pasa a
 * ser una cadena con una punta.
 *
 * LA VERSIÓN NO SE GUARDA, SE CUENTA. Guardar un `version: 3` es tener dos verdades:
 * borra una versión intermedia y el número miente mientras la cadena sigue diciendo
 * la verdad. Es la misma decisión que `modoDeSesion()`, que calcula el modo de las
 * partes en vez de guardarlo.
 *
 * LA UNIDAD QUE EVOLUCIONA ES EL PROGRAMA, NO LA SESIÓN. Si se evolucionara sesión a
 * sesión habría que reconstruir el orden: qué toca el lunes y qué el miércoles. Al
 * hacerlo con todas a la vez, cada cita futura solo cambia a qué versión apunta y
 * conserva su hueco, así que el orden se mantiene porque nadie lo ha tocado.
 */

/** Tope de saltos al recorrer una cadena. Con datos sanos no se alcanza nunca: está
 *  para que un `evolucion_de` circular cuelgue la ficha en vez del navegador. */
const MAX_SALTOS = 200

type Ses = { id: string, evolucion_de?: string | null, created_at?: string, [k: string]: any }

const porId = (sesiones: Ses[]) => {
  const m: Record<string, Ses> = {}
  sesiones.forEach(s => { if (s?.id) m[s.id] = s })
  return m
}

/**
 * La cadena completa hacia atrás, de la más nueva a la más vieja, incluida la propia.
 *
 * Solo se sigue el enlace mientras el padre esté EN LA LISTA. Si apunta a una sesión
 * borrada o de otro paciente, la cadena acaba ahí: es preferible decir "v2" a mentir
 * con un "v5" que no se puede enseñar.
 */
export function cadenaDe(sesiones: Ses[], sesion: Ses): Ses[] {
  const mapa = porId(sesiones)
  const vistos = new Set<string>()
  const cadena: Ses[] = []
  let actual: Ses | undefined = sesion
  let n = 0
  while (actual && !vistos.has(actual.id) && n++ < MAX_SALTOS) {
    vistos.add(actual.id)
    cadena.push(actual)
    actual = actual.evolucion_de ? mapa[actual.evolucion_de] : undefined
  }
  return cadena
}

/** En qué número de versión va esta sesión. La primera de su cadena es la 1. */
export function versionDe(sesiones: Ses[], sesion: Ses): number {
  return cadenaDe(sesiones, sesion).length
}

/** La sesión con la que arranca la cadena. Sirve de clave para agrupar. */
export function origenDe(sesiones: Ses[], sesion: Ses): Ses {
  const c = cadenaDe(sesiones, sesion)
  return c[c.length - 1] || sesion
}

/** true si nadie ha evolucionado de esta: es la punta de su cadena. */
export function esUltima(sesiones: Ses[], sesion: Ses): boolean {
  return !sesiones.some(s => s.evolucion_de === sesion.id)
}

export type Linaje = {
  /** La versión vigente: la que se muestra. */
  ultima: Ses
  /** Las anteriores, de más reciente a más antigua. Vacío si nunca se evolucionó. */
  anteriores: Ses[]
  /** Número de la versión vigente. 1 = nunca se ha evolucionado. */
  version: number
}

/**
 * Agrupa las sesiones de un paciente por cadena y deja delante la versión vigente.
 *
 * Una cadena puede bifurcarse si alguien evoluciona dos veces la misma sesión. No se
 * impide: se ordena por versión y luego por fecha, y la punta es la última. Fingir que
 * no puede pasar sería peor que enseñarlo.
 */
export function agrupaPorLinaje(sesiones: Ses[]): Linaje[] {
  const grupos = new Map<string, Ses[]>()
  sesiones.forEach(s => {
    const raiz = origenDe(sesiones, s).id
    if (!grupos.has(raiz)) grupos.set(raiz, [])
    grupos.get(raiz)!.push(s)
  })

  const salida: Linaje[] = []
  grupos.forEach(lista => {
    const ordenada = [...lista].sort((a, b) =>
      versionDe(sesiones, b) - versionDe(sesiones, a) ||
      String(b.created_at || '').localeCompare(String(a.created_at || '')))
    const [ultima, ...anteriores] = ordenada
    salida.push({ ultima, anteriores, version: versionDe(sesiones, ultima) })
  })

  // El mismo orden que tenía la lista antes: lo último creado, arriba.
  return salida.sort((a, b) =>
    String(b.ultima.created_at || '').localeCompare(String(a.ultima.created_at || '')))
}

/**
 * Solo las versiones vigentes: para los desplegables donde se ELIGE una sesión.
 *
 * En una lista de consulta las versiones viejas se pliegan; en un selector estorban de
 * verdad, porque "Empujes, Empujes, Empujes" no dice cuál manda y elegir la de hace
 * tres meses es prescribir el programa antiguo sin enterarse.
 *
 * `conservar` es la que ya está elegida: si es una versión vieja —una cita antigua que
 * se está anotando ahora— tiene que seguir en la lista, o el desplegable se quedaría en
 * blanco y guardar borraría la asignación.
 */
export function soloVigentes<T extends Ses>(sesiones: T[], conservar?: string | null): T[] {
  return sesiones.filter(s => esUltima(sesiones, s) || (!!conservar && s.id === conservar))
}

export type ResultadoEvolucion = {
  ok: true
  /** Las versiones nuevas, una por sesión que estuviera en la agenda futura. */
  nuevas: any[]
  /** Citas que han pasado a apuntar a las versiones nuevas. */
  nCitas: number
} | {
  ok: false
  error: string
}

/**
 * Crea la siguiente tanda del programa: copia las sesiones que están en la agenda
 * futura y repunta esas citas a las copias.
 *
 * Qué se considera "el programa": las sesiones asignadas a citas futuras no
 * canceladas. No todas las sesiones del paciente, porque ahí hay sesiones viejas que
 * ya no se hacen y evolucionarlas crearía versiones nuevas de algo que nadie va a
 * entrenar.
 *
 * LAS CITAS PASADAS NO SE TOCAN. Siguen apuntando a la versión que se hizo ese día, y
 * por eso el resumen de volumen sigue siendo cierto meses después. Es toda la razón de
 * que esto copie en vez de editar.
 *
 * Si algo falla a mitad, se devuelve el error con lo que ya se había creado en vez de
 * intentar deshacerlo: sin transacción de verdad, un "deshacer" a mano puede borrar
 * más de lo que creó. Las copias huérfanas se ven en la lista y se borran; una sesión
 * borrada por error no se recupera.
 */
export async function evolucionarPrograma(pacienteId: string): Promise<ResultadoEvolucion> {
  if (!pacienteId) return { ok: false, error: 'Falta el paciente' }
  const hoy = new Date().toISOString().split('T')[0]

  const { data: citas, error: errCitas } = await supabase.from('citas')
    .select('id,fecha,sesion_id')
    .eq('paciente_id', pacienteId).gte('fecha', hoy)
    .neq('estado', 'cancelada').not('sesion_id', 'is', null)
    .order('fecha').order('hora')
  if (errCitas) return { ok: false, error: errCitas.message }

  const ids = Array.from(new Set((citas || []).map((c: any) => c.sesion_id).filter(Boolean)))
  if (ids.length === 0) {
    return { ok: false, error: 'No hay citas futuras con sesión asignada: no hay programa que evolucionar.' }
  }

  const { data: sesiones, error: errSes } = await supabase.from('sesiones')
    .select('id,nombre,descripcion,partes').in('id', ids)
  if (errSes) return { ok: false, error: errSes.message }
  if (!sesiones || sesiones.length === 0) return { ok: false, error: 'No se han podido leer las sesiones asignadas' }

  const nuevas: any[] = []
  const nuevaDe: Record<string, string> = {}

  for (const s of sesiones) {
    // Sin sufijo: la sesión se sigue llamando igual y la versión la pone el linaje.
    // "Empujes (copia) (copia)" es lo que pasa cuando el nombre carga con el historial.
    const r = await duplicarSesion(s, pacienteId, {
      sufijo: '', motivo: 'Nueva tanda del programa', evolucionDe: s.id, sinEvento: true,
    })
    if (!r.ok) return { ok: false, error: `No se pudo copiar "${s.nombre}": ${r.error}` }
    nuevas.push(r.sesion)
    nuevaDe[s.id] = r.sesion.id
  }

  // El repunte es lo que conserva el orden: cada cita mantiene su día y su hora, y solo
  // cambia a qué versión apunta. No hay que decidir qué va el lunes porque ya estaba.
  let nCitas = 0
  for (const c of (citas || [])) {
    const destino = nuevaDe[(c as any).sesion_id]
    if (!destino) continue
    const { error } = await supabase.from('citas').update({ sesion_id: destino }).eq('id', (c as any).id)
    if (error) return { ok: false, error: `Las copias se crearon pero una cita no se pudo reasignar: ${error.message}` }
    nCitas++
  }

  // Un solo evento con el total: una tanda nueva es un hito, no ocho.
  await registrarSesion(pacienteId,
    `Nueva tanda del programa: ${nuevas.length} sesión${nuevas.length > 1 ? 'es' : ''}`,
    `${nCitas} cita${nCitas === 1 ? '' : 's'} futura${nCitas === 1 ? '' : 's'} reasignada${nCitas === 1 ? '' : 's'} · ${sesiones.map((s: any) => s.nombre).join(', ')}`)

  return { ok: true, nuevas, nCitas }
}
