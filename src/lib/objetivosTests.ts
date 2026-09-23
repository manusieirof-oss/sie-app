import { supabase } from './supabase'

/**
 * QUE EVALUA UN OBJETIVO.
 *
 * Ojo, que son dos relaciones distintas y conviene no confundirlas:
 *
 *   - que test lo ABRE  → vive en el item o la banda del test. Es diagnostico.
 *   - que tests lo EVALUAN → esto. Es con lo que se mira si ya esta conseguido.
 *
 * Una sola tabla, `objetivos_tests`, editable desde el objetivo y visible desde
 * el test. Los cuestionarios entran aqui igual que los tests: comparten tabla.
 */

/**
 * Con que se evalua un objetivo, con su detalle.
 *
 * `item` en null = el test entero; con nombre = SOLO ese item, y es el unico
 * que sale en la evaluacion. Se guarda por NOMBRE y no por posicion: reordenar
 * los items del test cambiaria en silencio contra que se mide el objetivo.
 * `movimiento` en null = el objetivo entero; con valor = solo ese especifico.
 * Es TEXTO y no un id: un especifico puede ser una etiqueta del arbol o una
 * frase escrita a mano, y la mitad de los que hay son lo segundo.
 */
export type Evaluador = {
  test_id: string
  item?: string | null
  movimiento?: string | null
}

export async function testsDeObjetivo(objetivoId: string): Promise<Evaluador[]> {
  if (!objetivoId) return []
  const { data } = await supabase.from('objetivos_tests')
    .select('test_id,item,movimiento').eq('objetivo_id', objetivoId)
  return (data || []) as Evaluador[]
}

/** Se reescribe entera: son listas cortas y asi no hay que diffear nada. */
export async function fijarTestsDeObjetivo(objetivoId: string, evs: Evaluador[]) {
  await supabase.from('objetivos_tests').delete().eq('objetivo_id', objetivoId)
  if (evs.length === 0) return { ok: true as const }
  const { error } = await supabase.from('objetivos_tests')
    .insert(evs.map(e => ({
      objetivo_id: objetivoId, test_id: e.test_id,
      item: e.item || null, movimiento: e.movimiento || null,
    })))
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

export type Conteo = { tests: number, cuestionarios: number }

/** Cuantos tests y cuantos cuestionarios evaluan cada objetivo. Para las tarjetas. */
export async function conteoPorObjetivo(): Promise<Record<string, Conteo>> {
  const { data } = await supabase.from('objetivos_tests')
    .select('objetivo_id, test_id, tests:test_id(tipo,archivado_el)')
  const m: Record<string, Conteo> = {}
  // POR TEST, NO POR FILA. Un mismo test puede estar colgado de varios especificos
  // —o del objetivo entero y ademas de una parte—, y son varias filas de lo mismo:
  // la tarjeta decia "4 tests" habiendo dos. Lo que se cuenta es con cuantas cosas
  // distintas se comprueba.
  const vistos = new Set<string>()
  ;(data || []).forEach((r: any) => {
    const t = Array.isArray(r.tests) ? r.tests[0] : r.tests
    // Un test archivado ya no se le puede pasar a nadie: el objetivo se queda sin
    // forma de comprobarse de aqui en adelante, asi que vuelve a "por completar".
    // La ficha del test sigue viendose dentro del objetivo, marcada.
    if (t?.archivado_el != null) return
    const clave = r.objetivo_id + '|' + r.test_id
    if (vistos.has(clave)) return
    vistos.add(clave)
    if (m[r.objetivo_id] == null) m[r.objetivo_id] = { tests: 0, cuestionarios: 0 }
    if (t?.tipo === 'cuestionario') m[r.objetivo_id].cuestionarios++
    else m[r.objetivo_id].tests++
  })
  return m
}

/** Todos los tests y cuestionarios de la biblioteca, para elegir. */
export async function cargarEvaluadores() {
  const { data } = await supabase.from('tests').select('id,nombre,descripcion,tipo,items,imagen_url,etiquetas_relacionadas,archivado_el').order('nombre')
  return data || []
}
