import { supabase } from './supabase'
import { conDescendientes } from './etiquetas'

/**
 * Editar el árbol de etiquetas: renombrar, mover, fusionar y borrar.
 *
 * Hasta ahora esto solo se podía hacer escribiendo `semillaEtiquetas.ts` y desplegando.
 * Arreglar un duplicado —"Vasto interno" contra "Vasto Medial"— era tocar código, y eso
 * significa que el dato de la clínica dependía de un despliegue.
 *
 * DOS SITIOS GUARDAN IDS DE ETIQUETA: `ejercicios.etiquetas` y
 * `tests.etiquetas_relacionadas`, los dos como array JSON. Cualquier operación que haga
 * desaparecer un id tiene que pasar por los dos, o quedan referencias a etiquetas que ya
 * no existen: no dan error, simplemente el ejercicio pierde una etiqueta sin avisar.
 *
 * Ninguna operación es transaccional. Se hacen en el orden que deja el destrozo menor si
 * algo falla a mitad: primero se reasignan las referencias y solo al final se borra la
 * etiqueta. Al revés, un fallo dejaría ejercicios apuntando a la nada.
 */

/** Dónde vive un id de etiqueta. Si mañana hay un tercer sitio, se añade aquí. */
const REFERENCIAS = [
  { tabla: 'ejercicios', columna: 'etiquetas' },
  { tabla: 'tests', columna: 'etiquetas_relacionadas' },
] as const

export type Usos = { ejercicios: number, tests: number, total: number }

/**
 * Cuántos ejercicios y tests usan cada etiqueta.
 *
 * Devuelve el mapa entero de una vez en vez de una función por etiqueta: la pestaña
 * necesita el número de las trescientas a la vez y preguntarlo una a una serían
 * trescientas consultas.
 *
 * Cuenta el uso DIRECTO, no el de los descendientes. Que "Cuádriceps" salga con 0 y
 * "Recto Femoral" con 8 es información: dice que nadie etiqueta por la raíz.
 */
export function contarUsos(ejercicios: any[], tests: any[]): Record<string, Usos> {
  const mapa: Record<string, Usos> = {}
  const suma = (id: string, campo: 'ejercicios' | 'tests') => {
    if (!id) return
    const u = mapa[id] || (mapa[id] = { ejercicios: 0, tests: 0, total: 0 })
    u[campo]++; u.total++
  }
  ;(ejercicios || []).forEach((e: any) => (e.etiquetas || []).forEach((id: string) => suma(id, 'ejercicios')))
  ;(tests || []).forEach((t: any) => (t.etiquetas_relacionadas || []).forEach((id: string) => suma(id, 'tests')))
  return mapa
}

export async function renombrar(id: string, nombre: string) {
  if (!nombre.trim()) return { ok: false as const, error: 'El nombre no puede quedar vacío' }
  const { error } = await supabase.from('etiquetas').update({ nombre: nombre.trim() }).eq('id', id)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

/**
 * Cambia de padre una etiqueta, o la deja como raíz con `padreId` vacío.
 *
 * Se rechaza colgarla de sí misma o de una de sus descendientes: el árbol quedaría con un
 * ciclo y las funciones que lo recorren —`conDescendientes`, `raizDe`— se colgarían al
 * primer render de la pestaña.
 */
export async function moverEtiqueta(etiquetas: any[], id: string, padreId: string | null) {
  if (padreId === id) return { ok: false as const, error: 'Una etiqueta no puede colgar de sí misma' }
  if (padreId && conDescendientes(etiquetas, id).includes(padreId)) {
    return { ok: false as const, error: 'No puede colgar de una de sus propias subetiquetas' }
  }
  const { error } = await supabase.from('etiquetas').update({ padre_id: padreId || null }).eq('id', id)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

/**
 * Lo que se va a llevar por delante un borrado, para decirlo ANTES.
 *
 * El aviso va donde se toma la decisión, no en el recibo de después: es la misma regla
 * que aplicamos en los sembradores.
 */
export function impactoDeBorrar(etiquetas: any[], id: string, usos: Record<string, Usos>) {
  const rama = conDescendientes(etiquetas, id)
  const hijas = rama.filter(x => x !== id)
  const afectados = rama.reduce((a, x) => a + (usos[x]?.total || 0), 0)
  return { hijas: hijas.length, afectados, rama }
}

/**
 * Borra una etiqueta y toda su rama, quitándola de ejercicios y tests.
 *
 * Se borra la rama entera y no solo la etiqueta porque dejar hijas huérfanas es peor: sin
 * padre pasan a ser raíces de su categoría y aparecen mezcladas con las de verdad, sin que
 * nadie recuerde de dónde salieron.
 */
export async function eliminarEtiqueta(etiquetas: any[], id: string) {
  const rama = conDescendientes(etiquetas, id)

  // Primero las referencias: si esto falla, la etiqueta sigue existiendo y no se ha roto
  // nada. Borrando antes, los ejercicios quedarían apuntando a un id inexistente.
  const r = await quitarIds(rama)
  if (!r.ok) return r

  const { error } = await supabase.from('etiquetas').delete().in('id', rama)
  return error ? { ok: false as const, error: error.message } : { ok: true as const, borradas: rama.length }
}

/**
 * Fusiona `sobra` en `queda`: los ejercicios y tests que tenían la sobrante pasan a la
 * buena, sus subetiquetas se cuelgan de la buena, y la sobrante se borra.
 *
 * Las subetiquetas se reasignan en vez de borrarse: si "Vasto interno" tenía hijas, esas
 * hijas describen algo real y su problema era el padre, no ellas.
 */
export async function fusionar(etiquetas: any[], sobraId: string, quedaId: string) {
  if (sobraId === quedaId) return { ok: false as const, error: 'Son la misma etiqueta' }
  if (conDescendientes(etiquetas, sobraId).includes(quedaId)) {
    return { ok: false as const, error: 'No se puede fusionar una etiqueta con una de sus subetiquetas' }
  }

  let movidos = 0
  for (const { tabla, columna } of REFERENCIAS) {
    const { data, error } = await supabase.from(tabla).select(`id,${columna}`)
    if (error) return { ok: false as const, error: error.message }
    for (const fila of (data || []) as any[]) {
      const ids: string[] = fila[columna] || []
      if (!ids.includes(sobraId)) continue
      // Set para no dejar la buena duplicada en los que ya tenían las dos.
      const nuevos = Array.from(new Set(ids.map(x => x === sobraId ? quedaId : x)))
      const { error: e2 } = await supabase.from(tabla).update({ [columna]: nuevos }).eq('id', fila.id)
      if (e2) return { ok: false as const, error: e2.message }
      movidos++
    }
  }

  const hijas = etiquetas.filter(e => e.padre_id === sobraId)
  for (const h of hijas) {
    const { error } = await supabase.from('etiquetas').update({ padre_id: quedaId }).eq('id', h.id)
    if (error) return { ok: false as const, error: error.message }
  }

  const { error } = await supabase.from('etiquetas').delete().eq('id', sobraId)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, movidos, hijas: hijas.length }
}

/** Quita una lista de ids de todos los sitios que los guardan. */
async function quitarIds(ids: string[]) {
  for (const { tabla, columna } of REFERENCIAS) {
    const { data, error } = await supabase.from(tabla).select(`id,${columna}`)
    if (error) return { ok: false as const, error: error.message }
    for (const fila of (data || []) as any[]) {
      const actuales: string[] = fila[columna] || []
      const limpios = actuales.filter(x => !ids.includes(x))
      if (limpios.length === actuales.length) continue
      const { error: e2 } = await supabase.from(tabla).update({ [columna]: limpios }).eq('id', fila.id)
      if (e2) return { ok: false as const, error: e2.message }
    }
  }
  return { ok: true as const }
}

export async function crearEtiqueta(categoria: string, nombre: string, padreId?: string | null) {
  if (!nombre.trim()) return { ok: false as const, error: 'Escribe el nombre' }
  const { error } = await supabase.from('etiquetas')
    .insert({ categoria, nombre: nombre.trim(), padre_id: padreId || null })
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

/**
 * Etiquetas con el mismo nombre, para avisar antes de crear otra.
 *
 * Es literalmente como nacieron las tres "Mayor" y las dos "Menor" del árbol: nombres
 * correctos en su rama que, vistos sueltos, no se distinguen. No se impide crearlas
 * —"Mayor" bajo Glúteo y bajo Pectoral son legítimas— pero hay que verlo antes.
 */
export function mismasConNombre(etiquetas: any[], nombre: string) {
  const n = nombre.trim().toLowerCase()
  if (!n) return []
  return etiquetas.filter(e => (e.nombre || '').trim().toLowerCase() === n)
}
