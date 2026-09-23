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

/* ─── LO QUE DE VERDAD HAY QUE MIRAR ─────────────────────────────────────────
 *
 * La lista de tests no contestaba la pregunta. La fase no se cierra pasando
 * tests: se cierra cuando sus OBJETIVOS estan logrados, y un objetivo puede
 * quedarse abierto por tres motivos distintos que la lista de tests no
 * distinguia —falta pasar su test, el paciente no lo lleva, o no tiene con que
 * medirse—. Los tres se arreglan en sitios distintos, asi que hay que decir
 * cual es.
 */

export type TestEnEvaluacion = {
  test: any
  hecho: boolean
  fecha?: string | null
  /** Los items concretos con los que se comprueba. Vacio = el test entero. */
  items: string[]
}

export type ObjetivoEnEvaluacion = {
  id: string
  nombre: string
  imagen_url?: string | null
  /** El paciente lo tiene en su ficha. Si no, no hay nada que pasarle. */
  lleva: boolean
  logrado: boolean
  tests: TestEnEvaluacion[]
  /** Por que sigue abierto, en una linea. Vacio si esta logrado. */
  motivo: string
}

export async function resumenDeEvaluacion(
  evaluacionId: string, pacienteId: string, objetivosDeLaFase: string[],
): Promise<ObjetivoEnEvaluacion[]> {
  if (objetivosDeLaFase.length === 0) return []

  const [{ data: dObj }, { data: dPac }, { data: dEnl }] = await Promise.all([
    supabase.from('objetivos').select('id,nombre,imagen_url').in('id', objetivosDeLaFase),
    supabase.from('pacientes_objetivos').select('objetivo_id,logrado,nombre')
      .eq('paciente_id', pacienteId).in('objetivo_id', objetivosDeLaFase),
    supabase.from('objetivos_tests')
      .select('objetivo_id, item, tests:test_id(id,nombre,descripcion,tipo,imagen_url,items,archivado_el)')
      .in('objetivo_id', objetivosDeLaFase),
  ])

  // Lo ya registrado DENTRO de esta evaluacion. Un test pasado por otro motivo
  // no cuenta: por eso los resultados llevan `evaluacion_id`.
  const { data: dHechos } = await supabase.from('resultados_tests')
    .select('test_id,fecha').eq('evaluacion_id', evaluacionId)
  const hecho: Record<string, string> = {}
  ;(dHechos || []).forEach((r: any) => { hecho[r.test_id] = r.fecha })

  const delPaciente: Record<string, any> = {}
  ;(dPac || []).forEach((r: any) => { delPaciente[r.objetivo_id] = r })

  // Un mismo test puede estar colgado dos veces del mismo objetivo con items
  // distintos: es UN test que se pasa una vez, con dos items que mirar.
  const porObjetivo: Record<string, TestEnEvaluacion[]> = {}
  ;(dEnl || []).forEach((e: any) => {
    const t = Array.isArray(e.tests) ? e.tests[0] : e.tests
    // Archivado: no se le puede pasar a nadie, asi que no se puede pedir.
    if (t == null || t.archivado_el != null) return
    if (porObjetivo[e.objetivo_id] == null) porObjetivo[e.objetivo_id] = []
    let fila = porObjetivo[e.objetivo_id].find(p => p.test.id === t.id)
    if (fila == null) {
      fila = { test: t, hecho: hecho[t.id] != null, fecha: hecho[t.id] || null, items: [] }
      porObjetivo[e.objetivo_id].push(fila)
    }
    if (e.item && fila.items.includes(e.item) === false) fila.items.push(e.item)
  })

  const filas = objetivosDeLaFase.map(id => {
    const suyo = delPaciente[id]
    const tests = porObjetivo[id] || []
    const lleva = suyo != null
    const logrado = !!suyo?.logrado
    // El nombre sale de SU copia cuando la tiene: es el que el paciente ve.
    const dela = (dObj || []).find((o: any) => o.id === id)
    const nombre = suyo?.nombre || dela?.nombre || 'Objetivo'

    let motivo = ''
    if (logrado === false) {
      if (lleva === false) motivo = 'El paciente no lleva este objetivo: añádeselo desde su ficha.'
      else if (tests.length === 0) motivo = 'Este objetivo no tiene con qué medirse: engánchale un test en Biblioteca → Objetivos.'
      else {
        const faltan = tests.filter(t => t.hecho === false).map(t => t.test.nombre)
        motivo = faltan.length === 0
          ? 'Pasado todo, pero sigue abierto: alguna parte se cierra a mano desde su ficha.'
          : 'Falta pasar: ' + faltan.join(', ') + '.'
      }
    }
    return { id, nombre, imagen_url: dela?.imagen_url || null, lleva, logrado, tests, motivo }
  })

  // Primero lo que falta: es a lo que se viene.
  return filas.sort((a, b) => Number(a.logrado) - Number(b.logrado))
}
