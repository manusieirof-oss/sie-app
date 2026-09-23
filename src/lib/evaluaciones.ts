import { supabase } from './supabase'
import { hoyISO } from './fechas'

/**
 * LA EVALUACION NO MIDE NADA.
 *
 * Es solo un nombre para agrupar QUE hay que pasarle a alguien y PARA CUANDO:
 * los tests y cuestionarios de los objetivos de la fase en la que esta. El test
 * se pasa como siempre y cierra el objetivo como siempre; la fase avanza sola
 * porque `faseEn` mira los objetivos logrados. La evaluacion solo da la lista.
 *
 * Por eso su contenido NO SE GUARDA: se calcula cada vez. Guardarlo seria una
 * foto que envejece en cuanto cambies los objetivos de la fase.
 */

export type Pendiente = {
  test: any
  objetivos: string[]
  hecho: boolean
  fecha?: string | null
}

/** La evaluacion de esa fase, si existe. Una por fase. */
export async function evaluacionDe(asignacionId: string, faseId: string) {
  if (!asignacionId || !faseId) return null
  const { data } = await supabase.from('evaluaciones').select('*')
    .eq('asignacion_id', asignacionId).eq('fase_id', faseId).maybeSingle()
  return data || null
}

export async function abrirEvaluacion(d: {
  pacienteId: string, asignacionId: string, faseId: string,
  fecha?: string | null, citaId?: string | null,
}) {
  const { data, error } = await supabase.from('evaluaciones').insert({
    paciente_id: d.pacienteId, asignacion_id: d.asignacionId, fase_id: d.faseId,
    fecha: d.fecha || hoyISO(), cita_id: d.citaId || null,
  }).select().single()
  return error ? { ok: false as const, error: error.message } : { ok: true as const, evaluacion: data }
}

export async function moverEvaluacion(id: string, d: { fecha?: string | null, citaId?: string | null }) {
  const { error } = await supabase.from('evaluaciones')
    .update({ fecha: d.fecha || null, cita_id: d.citaId || null }).eq('id', id)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

export async function borrarEvaluacion(id: string) {
  const { error } = await supabase.from('evaluaciones').delete().eq('id', id)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

/**
 * Que le queda por pasar. Sale de los objetivos de la fase, de los tests que los
 * evaluan y de lo que ya se haya registrado DENTRO de esta evaluacion.
 *
 * Un test pasado por otro motivo no cuenta: por eso los resultados llevan
 * `evaluacion_id` y no se mira solo la fecha.
 */
export async function contenidoDe(evaluacionId: string, objetivosDeLaFase: string[]): Promise<Pendiente[]> {
  if (objetivosDeLaFase.length === 0) return []

  const { data: enlaces } = await supabase.from('objetivos_tests')
    .select('objetivo_id, test_id, tests:test_id(id,nombre,descripcion,tipo,imagen_url,items,archivado_el)')
    .in('objetivo_id', objetivosDeLaFase)

  const porTest: Record<string, Pendiente> = {}
  ;(enlaces || []).forEach((e: any) => {
    const t = Array.isArray(e.tests) ? e.tests[0] : e.tests
    if (t == null) return
    // Archivado: no se le puede pasar a nadie, asi que no se puede pedir en una
    // evaluacion. Lo ya registrado con el sigue donde estaba.
    if (t.archivado_el != null) return
    if (porTest[t.id] == null) porTest[t.id] = { test: t, objetivos: [], hecho: false }
    porTest[t.id].objetivos.push(e.objetivo_id)
  })

  const ids = Object.keys(porTest)
  if (ids.length === 0) return []

  const { data: hechos } = await supabase.from('resultados_tests')
    .select('test_id,fecha').eq('evaluacion_id', evaluacionId).in('test_id', ids)
  ;(hechos || []).forEach((r: any) => {
    if (porTest[r.test_id]) { porTest[r.test_id].hecho = true; porTest[r.test_id].fecha = r.fecha }
  })

  return Object.values(porTest)
}

/** Los objetivos de una fase que ESTE paciente lleva de verdad. */
export async function objetivosDeFaseDelPaciente(pacienteId: string, objetivosDeLaFase: string[]) {
  if (objetivosDeLaFase.length === 0) return []
  const { data } = await supabase.from('pacientes_objetivos')
    .select('objetivo_id').eq('paciente_id', pacienteId).in('objetivo_id', objetivosDeLaFase)
  return (data || []).map((r: any) => r.objetivo_id)
}

/**
 * La evaluacion abierta a la que pertenece este test, si alguna.
 *
 * Se resuelve AQUI y no en la pantalla que pasa el test: el proceso de pasar un
 * test no cambia —se hace como siempre—, y que ademas cuente para la evaluacion
 * que tenga abierta es consecuencia, no un paso mas que alguien deba acordarse
 * de dar. Si se pidiera a cada pantalla, la que se olvidara dejaria la
 * evaluacion eternamente a medias sin que nadie supiera por que.
 */
export async function evaluacionAbiertaPara(pacienteId: string, testId: string): Promise<string | null> {
  const { data: evs } = await supabase.from('evaluaciones')
    .select('id,fase_id').eq('paciente_id', pacienteId).eq('estado', 'abierta')
  if (evs == null || evs.length === 0) return null

  const { data: objs } = await supabase.from('objetivos_tests')
    .select('objetivo_id').eq('test_id', testId)
  const ids = (objs || []).map((r: any) => r.objetivo_id)
  if (ids.length === 0) return null

  const { data: enFase } = await supabase.from('sistema_fase_objetivos')
    .select('fase_id').in('objetivo_id', ids)
  const fases = new Set((enFase || []).map((r: any) => r.fase_id))

  return evs.find((e: any) => fases.has(e.fase_id))?.id || null
}
