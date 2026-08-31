import { supabase } from './supabase'
import { duplicarSesion, registrarSesion } from './sesiones'
import { hoyISO } from '@/lib/fechas'

/**
 * Linaje de sesiones: qué tanda sustituyó a cuál.
 *
 * Una sesión guarda en `evolucion_de` la sesión de la que salió. Con eso, "Empujes"
 * deja de ser ocho sesiones sueltas con el mismo nombre y pasa a ser una familia con
 * una vigente.
 *
 * EL NÚMERO NO SE GUARDA, SE CUENTA, Y CUENTA CUÁNTAS VAN EN EL LINAJE, no saltos de
 * cadena. La diferencia importa porque se puede partir de cualquier versión: si vas por
 * la 6ª tanda y decides retomar el hilo desde la 1ª, lo que sale es la 7ª —es la séptima
 * que existe— y no la 2ª. Contar saltos diría 2ª y no significaría nada para nadie.
 *
 * Se llama TANDA y no versión a propósito. Un número junto al nombre se lee como un
 * nivel, y que suba no dice que el paciente haya progresado: dice que se le montó una
 * programación nueva. El progreso lo miden el resumen de volumen y los objetivos.
 *
 * LA UNIDAD QUE EVOLUCIONA ES EL PROGRAMA, NO LA SESIÓN. Si se hiciera de una en una
 * habría que reconstruir el orden —qué toca el lunes y qué el miércoles—; al hacerlo con
 * todas a la vez, cada cita solo cambia a qué versión apunta y conserva su hueco.
 */

/** Tope de saltos al recorrer una cadena. Con datos sanos no se alcanza nunca: está
 *  para que un `evolucion_de` circular cuelgue la ficha en vez del navegador. */
const MAX_SALTOS = 200

type Ses = {
  id: string
  evolucion_de?: string | null
  created_at?: string
  /** true = no entra en la tanda nueva. Ver sql/sesiones_linaje.sql. */
  fija?: boolean | null
  [k: string]: any
}

const porId = (sesiones: Ses[]) => {
  const m: Record<string, Ses> = {}
  sesiones.forEach(s => { if (s?.id) m[s.id] = s })
  return m
}

/**
 * La cadena hacia atrás desde una sesión, de la más nueva a la más vieja, incluida ella.
 *
 * Solo se sigue el enlace mientras el padre esté EN LA LISTA. Si apunta a una sesión
 * borrada o de otro paciente, la cadena acaba ahí: es preferible quedarse corto a
 * prometer un origen que no se puede enseñar.
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

/** La sesión con la que arranca el linaje. Es la clave por la que se agrupa. */
export function origenDe(sesiones: Ses[], sesion: Ses): Ses {
  const c = cadenaDe(sesiones, sesion)
  return c[c.length - 1] || sesion
}

/**
 * Orden de creación: la 1ª tanda primero. El desempate por id es para que dos sesiones
 * creadas en el mismo segundo —que pasa, la tanda las crea seguidas— no se ordenen
 * distinto en cada carga y la numeración baile delante del paciente.
 */
const ordena = (lista: Ses[]) => [...lista].sort((a, b) =>
  String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
  String(a.id).localeCompare(String(b.id)))

/** Todas las sesiones del mismo linaje, en orden de creación. */
export function linajeDe(sesiones: Ses[], sesion: Ses): Ses[] {
  const raiz = origenDe(sesiones, sesion).id
  return ordena(sesiones.filter(s => origenDe(sesiones, s).id === raiz))
}

/** Qué número de tanda es esta dentro de su linaje. La primera es la 1. */
export function versionDe(sesiones: Ses[], sesion: Ses): number {
  return linajeDe(sesiones, sesion).findIndex(s => s.id === sesion.id) + 1
}

/**
 * true si es la tanda que manda ahora: la última creada de su linaje.
 *
 * No se define como "de la que nadie ha evolucionado", que era lo anterior, porque al
 * poder partir de cualquier versión hay ramas: si de la 1ª salen la 2ª y la 7ª, tanto la
 * 6ª como la 7ª quedarían sin descendencia y habría dos vigentes a la vez.
 */
export function esVigente(sesiones: Ses[], sesion: Ses): boolean {
  const l = linajeDe(sesiones, sesion)
  return l.length === 0 || l[l.length - 1].id === sesion.id
}

export type Linaje = {
  /** La tanda que manda: la última creada del linaje. */
  vigente: Ses
  /** Las demás, de más reciente a más antigua. Vacío si nunca se hizo tanda nueva. */
  anteriores: Ses[]
  /** Número de la vigente. 1 = nunca se ha hecho tanda nueva. */
  version: number
}

/**
 * Agrupa las sesiones de un paciente por linaje y deja delante la vigente.
 * Sin esto, a los tres meses hay ocho tarjetas llamadas "Empujes" y ninguna dice cuál
 * manda.
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
    const orden = ordena(lista)
    salida.push({
      vigente: orden[orden.length - 1],
      anteriores: orden.slice(0, -1).reverse(),
      version: orden.length,
    })
  })

  // El mismo orden que tenía la lista antes: lo último creado, arriba.
  return salida.sort((a, b) =>
    String(b.vigente.created_at || '').localeCompare(String(a.vigente.created_at || '')))
}

/**
 * Solo las vigentes: para los desplegables donde se ELIGE una sesión.
 *
 * En una lista de consulta las tandas viejas se pliegan; en un selector estorban de
 * verdad, porque "Empujes, Empujes, Empujes" no dice cuál manda y elegir la de hace tres
 * meses es prescribir el programa antiguo sin enterarse.
 *
 * `conservar` es la que ya está elegida: si es una tanda vieja —una cita antigua que se
 * está anotando ahora— tiene que seguir en la lista, o el desplegable se quedaría en
 * blanco y guardar borraría la asignación.
 */
export function soloVigentes<T extends Ses>(sesiones: T[], conservar?: string | null): T[] {
  return sesiones.filter(s => esVigente(sesiones, s) || (!!conservar && s.id === conservar))
}

export type ResultadoEvolucion = {
  ok: true
  /** Las sesiones creadas. */
  nuevas: any[]
  /** Citas futuras que han pasado a apuntar a las nuevas. */
  nCitas: number
  /** Nombres de las sesiones fijas que se han dejado como estaban. */
  fijas: string[]
} | {
  ok: false
  error: string
}

/** Citas futuras del paciente que llevan sesión, en orden. */
async function citasFuturasConSesion(pacienteId: string) {
  const hoy = hoyISO()
  return supabase.from('citas')
    .select('id,fecha,sesion_id')
    .eq('paciente_id', pacienteId).gte('fecha', hoy)
    .neq('estado', 'cancelada').not('sesion_id', 'is', null)
    .order('fecha').order('hora')
}

/**
 * Crea la siguiente tanda del programa: copia las sesiones que están en la agenda futura
 * y repunta esas citas a las copias.
 *
 * Qué se considera "el programa": las sesiones asignadas a citas futuras no canceladas y
 * no marcadas como fijas. No todas las sesiones del paciente, porque ahí hay sesiones
 * viejas que ya no se hacen y versionarlas crearía tandas de algo que nadie va a entrenar.
 *
 * LAS CITAS PASADAS NO SE TOCAN. Siguen apuntando a la versión que se hizo ese día, y por
 * eso el resumen de volumen sigue siendo cierto meses después. Es toda la razón de que
 * esto copie en vez de editar.
 *
 * Si algo falla a mitad se devuelve el error sin intentar deshacerlo: sin transacción de
 * verdad, un "deshacer" a mano puede borrar más de lo que creó. Una copia huérfana se ve
 * en la lista y se borra; una sesión borrada por error no se recupera.
 */
export async function evolucionarPrograma(pacienteId: string): Promise<ResultadoEvolucion> {
  if (!pacienteId) return { ok: false, error: 'Falta el paciente' }

  const { data: citas, error: errCitas } = await citasFuturasConSesion(pacienteId)
  if (errCitas) return { ok: false, error: errCitas.message }

  const ids = Array.from(new Set((citas || []).map((c: any) => c.sesion_id).filter(Boolean)))
  if (ids.length === 0) {
    return { ok: false, error: 'No hay citas futuras con sesión asignada: no hay programa que evolucionar.' }
  }

  const { data: todas, error: errSes } = await supabase.from('sesiones')
    .select('id,nombre,descripcion,partes,fija').in('id', ids)
  if (errSes) return { ok: false, error: errSes.message }
  if (!todas || todas.length === 0) return { ok: false, error: 'No se han podido leer las sesiones asignadas' }

  // Las fijas se quedan como están y sus citas no se tocan: siguen apuntando a la misma
  // sesión, que es justo lo que significa fijarla.
  const fijas = todas.filter((s: any) => s.fija)
  const sesiones = todas.filter((s: any) => !s.fija)
  if (sesiones.length === 0) {
    return { ok: false, error: 'Todas las sesiones del programa están marcadas como fijas: no hay nada que versionar.' }
  }

  const nuevas: any[] = []
  const nuevaDe: Record<string, string> = {}

  for (const s of sesiones) {
    // Sin sufijo: la sesión se sigue llamando igual y el número lo pone el linaje.
    // "Empujes (copia) (copia)" es lo que pasa cuando el nombre carga con el historial.
    const r = await duplicarSesion(s, pacienteId, {
      sufijo: '', motivo: 'Nueva tanda del programa', evolucionDe: s.id, sinEvento: true,
    })
    if (!r.ok) return { ok: false, error: `No se pudo copiar "${s.nombre}": ${r.error}` }
    nuevas.push(r.sesion)
    nuevaDe[s.id] = r.sesion.id
  }

  const nCitas = await repuntar(citas || [], nuevaDe)
  if (typeof nCitas === 'string') return { ok: false, error: nCitas }

  // Un solo evento con el total: una tanda nueva es un hito, no ocho.
  await registrarSesion(pacienteId,
    `Nueva tanda del programa: ${nuevas.length} sesión${nuevas.length > 1 ? 'es' : ''}`,
    `${nCitas} cita${nCitas === 1 ? '' : 's'} futura${nCitas === 1 ? '' : 's'} reasignada${nCitas === 1 ? '' : 's'} · ${sesiones.map((s: any) => s.nombre).join(', ')}` +
    (fijas.length > 0 ? ` · fijas, sin tocar: ${fijas.map((s: any) => s.nombre).join(', ')}` : ''))

  return { ok: true, nuevas, nCitas, fijas: fijas.map((s: any) => s.nombre) }
}

/**
 * Siguiente tanda de UNA sesión, partiendo de la versión que se elija.
 *
 * El caso: vas por la 6ª tanda, los últimos cambios no han cuajado y quieres retomar el
 * hilo desde la 1ª. Se crea una sesión nueva con el contenido de aquella, y es la 7ª
 * porque es la séptima que existe en ese linaje, no la 2ª.
 *
 * NO se edita la vieja. Partir de ella la deja intacta, y eso es lo que permite volver a
 * hacerlo mañana desde otra y que las citas pasadas sigan diciendo lo que se hizo.
 *
 * Las citas futuras que llevaran CUALQUIER versión de este linaje pasan a la nueva: la
 * que estuviera puesta ya no es la que manda.
 */
export async function evolucionarDesde(sesion: any, pacienteId: string): Promise<ResultadoEvolucion> {
  if (!pacienteId || !sesion?.id) return { ok: false, error: 'Falta la sesión o el paciente' }

  const { data: todas } = await supabase.from('sesiones')
    .select('id,evolucion_de,created_at').eq('paciente_id', pacienteId)
  const delLinaje = new Set(linajeDe(todas || [], sesion).map(s => s.id))
  // Si la sesión aún no estuviera en la lista leída, al menos ella cuenta.
  delLinaje.add(sesion.id)

  const r = await duplicarSesion(sesion, pacienteId, {
    sufijo: '', motivo: 'Nueva tanda', evolucionDe: sesion.id, sinEvento: true,
  })
  if (!r.ok) return { ok: false, error: r.error }

  const { data: citas } = await citasFuturasConSesion(pacienteId)
  const mapa: Record<string, string> = {}
  delLinaje.forEach(id => { mapa[id] = r.sesion.id })
  const nCitas = await repuntar((citas || []).filter((c: any) => delLinaje.has(c.sesion_id)), mapa)
  if (typeof nCitas === 'string') return { ok: false, error: nCitas }

  const n = versionDe([...(todas || []), r.sesion], r.sesion)
  await registrarSesion(pacienteId, `Nueva tanda de ${sesion.nombre}: ${n}ª`,
    `Partiendo de la ${versionDe(todas || [], sesion)}ª · ${nCitas} cita${nCitas === 1 ? '' : 's'} futura${nCitas === 1 ? '' : 's'} reasignada${nCitas === 1 ? '' : 's'}`)

  return { ok: true, nuevas: [r.sesion], nCitas, fijas: [] }
}

/**
 * Reapunta cada cita a la sesión que le toca. Devuelve cuántas, o el mensaje de error.
 *
 * Es lo que conserva el orden: cada cita mantiene su día y su hora y solo cambia a qué
 * versión apunta. No hay que decidir qué va el lunes porque ya estaba decidido.
 */
async function repuntar(citas: any[], nuevaDe: Record<string, string>): Promise<number | string> {
  let n = 0
  for (const c of citas) {
    const destino = nuevaDe[c.sesion_id]
    if (!destino) continue
    const { error } = await supabase.from('citas').update({ sesion_id: destino }).eq('id', c.id)
    if (error) return `Las copias se crearon pero una cita no se pudo reasignar: ${error.message}`
    n++
  }
  return n
}

/** Marca o desmarca una sesión como fija: fuera de las tandas nuevas. */
export async function marcarFija(sesionId: string, fija: boolean) {
  const { error } = await supabase.from('sesiones').update({ fija }).eq('id', sesionId)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}
