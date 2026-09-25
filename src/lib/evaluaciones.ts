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
  // Sin filtrar por `estado`: nadie lo escribe al crearla, asi que exigir
  // 'abierta' dejaba siempre cero evaluaciones y ningun resultado se atribuia.
  const { data: evs } = await supabase.from('evaluaciones')
    .select('id,fase_id,fecha').eq('paciente_id', pacienteId)
  if (evs == null || evs.length === 0) return null

  const { data: objs } = await supabase.from('objetivos_tests')
    .select('objetivo_id').eq('test_id', testId)
  const ids = (objs || []).map((r: any) => r.objetivo_id)
  if (ids.length === 0) return null

  // Los objetivos de una fase salen de las SESIONES que lleva dentro; la tabla
  // `sistema_fase_objetivos` quedo sin escribirse al hacer ese cambio, y mirarla
  // aqui era mirar un sitio siempre vacio.
  const fases = evs.map((e: any) => e.fase_id).filter(Boolean)
  if (fases.length === 0) return null
  const { data: rel } = await supabase.from('sistema_fase_sesiones')
    .select('fase_id, sesiones(sesiones_objetivos(objetivo_id))').in('fase_id', fases)

  const conEsteTest = new Set<string>()
  ;(rel || []).forEach((r: any) => {
    const ses = Array.isArray(r.sesiones) ? r.sesiones[0] : r.sesiones
    const tiene = (ses?.sesiones_objetivos || []).some((o: any) => ids.includes(o.objetivo_id))
    if (tiene) conEsteTest.add(r.fase_id)
  })

  // La mas reciente de las que encajan: si hay dos fases con el mismo test, el
  // resultado de hoy es de la que se esta evaluando ahora.
  const candidatas = evs.filter((e: any) => conEsteTest.has(e.fase_id))
  if (candidatas.length === 0) return null
  candidatas.sort((a: any, b: any) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
  return candidatas[0].id
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

/* ─── PARA CUANDO, TEST A TEST ───────────────────────────────────────────────
 *
 * La evaluacion tenia UN dia, y una evaluacion de verdad se reparte: tres el
 * jueves y el resto el lunes. Esto guarda el dia de cada test —solo el dia; QUE
 * tests toca se sigue calculando de los objetivos cada vez, que es lo que
 * permite cambiar los objetivos de la fase sin que la evaluacion envejezca.
 *
 * Sin fila = sin dia asignado: entra en el dia general de la evaluacion.
 */

export type DiaDeTest = { test_id: string, fecha: string | null, cita_id: string | null }

export async function diasDeEvaluacion(evaluacionId: string): Promise<Record<string, DiaDeTest>> {
  const { data } = await supabase.from('evaluaciones_tests')
    .select('test_id,fecha,cita_id').eq('evaluacion_id', evaluacionId)
  const m: Record<string, DiaDeTest> = {}
  ;(data || []).forEach((r: any) => { m[r.test_id] = r })
  return m
}

/** Pone o quita el dia de un test. `fecha` en null lo devuelve al dia general. */
export async function fijarDiaDeTest(evaluacionId: string, testId: string, fecha: string | null) {
  if (fecha == null) {
    const { error } = await supabase.from('evaluaciones_tests')
      .delete().eq('evaluacion_id', evaluacionId).eq('test_id', testId)
    return error ? { ok: false as const, error: error.message } : { ok: true as const }
  }
  const { error } = await supabase.from('evaluaciones_tests')
    .upsert({ evaluacion_id: evaluacionId, test_id: testId, fecha }, { onConflict: 'evaluacion_id,test_id' })
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

/**
 * Que hay que pasar cada dia, para la planificacion.
 *
 * Devuelve, por fecha, los tests que tocan: los que tienen dia propio en el suyo
 * y los demas en el dia general de su evaluacion.
 */
export type TestDelDia = {
  evaluacionId: string, faseId: string, asignacionId: string, test: any,
  /** Los items concretos que se miran. Vacio = el test entero. */
  items: string[],
}

export async function testsPorDia(pacienteId: string): Promise<Record<string, TestDelDia[]>> {
  const { data: evs } = await supabase.from('evaluaciones')
    .select('id,fecha,fase_id,asignacion_id').eq('paciente_id', pacienteId)
  if (evs == null || evs.length === 0) return {}

  const ids = evs.map((e: any) => e.id)

  // 1. Los que tienen DIA PROPIO. Sin fila no es que no toque: es que va en el dia
  //    general de su evaluacion, que es el caso normal mientras no repartas nada.
  const { data: dias } = await supabase.from('evaluaciones_tests')
    .select('evaluacion_id,test_id,fecha').in('evaluacion_id', ids)
  const propio: Record<string, string> = {}
  ;(dias || []).forEach((r: any) => { if (r.fecha) propio[r.evaluacion_id + '|' + r.test_id] = r.fecha })

  // 2. Que tests pide cada fase. Sus objetivos salen de las sesiones que lleva dentro.
  const fases = Array.from(new Set(evs.map((e: any) => e.fase_id).filter(Boolean)))
  const { data: rel } = fases.length > 0
    ? await supabase.from('sistema_fase_sesiones')
        .select('fase_id, sesiones(sesiones_objetivos(objetivo_id))').in('fase_id', fases)
    : { data: [] as any[] }
  const objsDeFase: Record<string, string[]> = {}
  ;(rel || []).forEach((r: any) => {
    const ses = Array.isArray(r.sesiones) ? r.sesiones[0] : r.sesiones
    ;(ses?.sesiones_objetivos || []).forEach((o: any) => {
      if (objsDeFase[r.fase_id] == null) objsDeFase[r.fase_id] = []
      if (objsDeFase[r.fase_id].includes(o.objetivo_id) === false) objsDeFase[r.fase_id].push(o.objetivo_id)
    })
  })

  const todosObj = Array.from(new Set(Object.values(objsDeFase).flat()))
  if (todosObj.length === 0) return {}

  // 3. Fuera solo lo YA LOGRADO. Que el paciente no lleve el objetivo en su ficha
  //    no quita el test de la sala: lo has programado para ese dia, asi que toca —y
  //    pasarlo es justo lo que puede abrirlo o cerrarlo—.
  const { data: suyos } = await supabase.from('pacientes_objetivos')
    .select('objetivo_id,logrado').eq('paciente_id', pacienteId).in('objetivo_id', todosObj)
  const cerrados = new Set((suyos || []).filter((r: any) => r.logrado === true).map((r: any) => r.objetivo_id))

  const { data: enl } = await supabase.from('objetivos_tests')
    .select('objetivo_id,test_id,item, tests:test_id(*)').in('objetivo_id', todosObj)

  const porDia: Record<string, TestDelDia[]> = {}
  evs.forEach((ev: any) => {
    const mios = (objsDeFase[ev.fase_id] || []).filter(id => cerrados.has(id) === false)
    if (mios.length === 0) return
    // Un mismo test puede venir de dos objetivos y con items distintos: es UN test
    // que se pasa una vez. Si en algun sitio cuelga entero, manda eso.
    const por: Record<string, { test: any, items: string[], entero: boolean }> = {}
    ;(enl || []).forEach((r: any) => {
      if (mios.includes(r.objetivo_id) === false) return
      const t = Array.isArray(r.tests) ? r.tests[0] : r.tests
      if (t == null || t.archivado_el != null) return
      if (por[t.id] == null) por[t.id] = { test: t, items: [], entero: false }
      if (r.item == null) por[t.id].entero = true
      else if (por[t.id].items.includes(r.item) === false) por[t.id].items.push(r.item)
    })
    Object.values(por).forEach(x => {
      const f = propio[ev.id + '|' + x.test.id] || ev.fecha
      if (f == null) return
      if (porDia[f] == null) porDia[f] = []
      porDia[f].push({
        evaluacionId: ev.id, faseId: ev.fase_id, asignacionId: ev.asignacion_id,
        test: x.test, items: x.entero ? [] : x.items,
      })
    })
  })
  return porDia
}
