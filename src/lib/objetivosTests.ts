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

export async function testsDeObjetivo(objetivoId: string): Promise<string[]> {
  if (!objetivoId) return []
  const { data } = await supabase.from('objetivos_tests')
    .select('test_id').eq('objetivo_id', objetivoId)
  return (data || []).map((r: any) => r.test_id)
}

/** Se reescribe entera: son listas cortas y asi no hay que diffear nada. */
export async function fijarTestsDeObjetivo(objetivoId: string, ids: string[]) {
  await supabase.from('objetivos_tests').delete().eq('objetivo_id', objetivoId)
  if (ids.length === 0) return { ok: true as const }
  const { error } = await supabase.from('objetivos_tests')
    .insert(ids.map(test_id => ({ objetivo_id: objetivoId, test_id })))
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

export type Conteo = { tests: number, cuestionarios: number }

/** Cuantos tests y cuantos cuestionarios evaluan cada objetivo. Para las tarjetas. */
export async function conteoPorObjetivo(): Promise<Record<string, Conteo>> {
  const { data } = await supabase.from('objetivos_tests')
    .select('objetivo_id, tests:test_id(tipo)')
  const m: Record<string, Conteo> = {}
  ;(data || []).forEach((r: any) => {
    const t = Array.isArray(r.tests) ? r.tests[0] : r.tests
    if (m[r.objetivo_id] == null) m[r.objetivo_id] = { tests: 0, cuestionarios: 0 }
    if (t?.tipo === 'cuestionario') m[r.objetivo_id].cuestionarios++
    else m[r.objetivo_id].tests++
  })
  return m
}

/** Todos los tests y cuestionarios de la biblioteca, para elegir. */
export async function cargarEvaluadores() {
  const { data } = await supabase.from('tests').select('id,nombre,descripcion,tipo,items,imagen_url,etiquetas_relacionadas').order('nombre')
  return data || []
}
