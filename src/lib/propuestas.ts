import { supabase } from './supabase'
import { guardarVias, retratoObjetivo, type Via } from './objetivos'
import type { ViaOrigen } from './viasObjetivo'
import { hoyISO } from '@/lib/fechas'

// ---------------------------------------------------------------------------
// COSAS A MEJORAR (sql/propuestas.sql, maqueta «Objetivos: cosas a mejorar»).
//
// Un test positivo ya no le pone objetivos solo: deja aquí lo que encontró (cada ítem
// marcado, la banda o el test entero). En la ficha se juntan las que se quieran en un
// objetivo con el nombre que se quiera. Cada una recuerda su test, ítem y lado:
//   - al repetir el test y salir bien, la pendiente se resuelve sola;
//   - la que ya está en un objetivo es una VÍA de ese objetivo, y lo cierra o lo
//     reabre como siempre (guardarVias).
// Si el cliente ya tiene un objetivo con esa misma cosa dentro, no se repite aquí:
// se reabre en el objetivo, como antes.
// ---------------------------------------------------------------------------

export type Propuesta = {
  id: string, paciente_id: string, test_id: string | null, tipo: string, ref: string, lado: string | null,
  item: string | null, banda: string | null, texto: string, origen: string | null, sugerido: string | null,
  fecha: string, estado: 'pendiente' | 'en_objetivo' | 'descartada' | 'resuelta', objetivo_id: string | null,
}
export type Hallazgo = { tipo: 'test' | 'test_item', ref: string, item?: string | null, banda?: string | null, texto: string }

const mismoLado = (a: string | null | undefined, b: string | null | undefined) => (a || null) === (b || null)
const viaCoincide = (v: any, tipo: string, ref: string, lado: string | null) =>
  v?.tipo === tipo && v?.ref === ref && (v.lado == null || lado == null || v.lado === lado)

/**
 * Apunta lo que ha salido en un test (llamado desde registrarResultadoTest). `hallazgos`
 * vacío = el test ha salido bien en ese lado: lo pendiente de ese test se resuelve.
 */
export async function guardarHallazgos(pacienteId: string, test: { id: string, nombre?: string }, lado: string | null, hallazgos: Hallazgo[], contexto?: string) {
  lado = lado || null
  let nuevas = 0, logrados = 0
  let q = supabase.from('propuestas_mejora').select('*').eq('paciente_id', pacienteId).eq('test_id', test.id)
  q = lado ? q.eq('lado', lado) : q.is('lado', null)
  const [{ data: suyas, error }, { data: objs }] = await Promise.all([
    q, supabase.from('pacientes_objetivos').select('objetivo_id,vias,logrado').eq('paciente_id', pacienteId),
  ])
  // Sin la tabla (falta el SQL) no se rompe nada: simplemente no se apunta.
  if (error) { console.error('propuestas', error.message); return { nuevas, logrados } }
  const props = (suyas || []) as Propuesta[]
  const pos = (objs || []) as any[]
  const hoy = hoyISO()
  const enObjetivo = (h: Hallazgo) => pos.some(po => (po.vias || []).some((v: any) => viaCoincide(v, h.tipo, h.ref, lado)))

  for (const h of hallazgos) {
    const ex = props.find(p => p.tipo === h.tipo && p.ref === h.ref && mismoLado(p.lado, lado))
    if (enObjetivo(h)) continue
    if (!ex) {
      const { error: e } = await supabase.from('propuestas_mejora').insert({ paciente_id: pacienteId, test_id: test.id, tipo: h.tipo, ref: h.ref,
        lado, item: h.item || null, banda: h.banda || null, texto: h.texto, origen: test.nombre || 'Test', fecha: hoy })
      if (!e) nuevas++
      continue
    }
    const vuelve = ex.estado === 'resuelta' || (ex.estado === 'en_objetivo' && !pos.some(po => po.objetivo_id === ex.objetivo_id))
    await supabase.from('propuestas_mejora').update({ fecha: hoy, texto: h.texto,
      ...(vuelve ? { estado: 'pendiente', objetivo_id: null, resuelta_el: null } : {}) }).eq('id', ex.id)
    if (vuelve) nuevas++
  }

  // Lo pendiente que ya no ha salido: resuelto.
  const siguen = new Set(hallazgos.map(h => h.tipo + '|' + h.ref))
  const resueltas = props.filter(p => p.estado === 'pendiente' && !siguen.has(p.tipo + '|' + p.ref)).map(p => p.id)
  if (resueltas.length) await supabase.from('propuestas_mejora').update({ estado: 'resuelta', resuelta_el: hoy }).in('id', resueltas)

  // Lo que está dentro de un objetivo: su vía se resuelve o se reabre con lo de hoy. Si
  // el objetivo lo evalúa también por «Cómo se evalúa», ya lo ha hecho esa parte y aquí
  // no cambia nada.
  for (const p of props.filter(x => x.estado === 'en_objetivo' && x.objetivo_id)) {
    const po = pos.find(x => x.objetivo_id === p.objetivo_id); if (!po) continue
    const resuelto = !siguen.has(p.tipo + '|' + p.ref)
    let cambio = false
    const vias = (po.vias || []).map((v: any) => {
      if (!viaCoincide(v, p.tipo, p.ref, lado) || !!v.resuelto === resuelto) return v
      cambio = true
      return { ...v, resuelto, fecha_resuelto: resuelto ? hoy : null }
    })
    if (!cambio) continue
    const r: any = await guardarVias(pacienteId, po.objetivo_id, vias, { logradoAntes: !!po.logrado, contexto: contexto || 'un test', confirma: true })
    if (r?.logrado && !po.logrado) logrados++
    po.vias = vias; po.logrado = !!r?.logrado
  }
  return { nuevas, logrados }
}

export async function propuestasDe(pacienteId: string): Promise<Propuesta[]> {
  const { data, error } = await supabase.from('propuestas_mejora').select('*').eq('paciente_id', pacienteId)
    .in('estado', ['pendiente', 'descartada']).order('fecha', { ascending: false })
  if (error) return []
  return (data || []) as Propuesta[]
}

/** Los objetivos de la biblioteca que encajan con las marcadas (por «Cómo se evalúa», o
    el que proponía el taller). Los que ya tiene el cliente no se proponen. */
export async function sugerenciasPara(props: Propuesta[], yaTiene: string[]) {
  const pend = props.filter(p => p.estado === 'pendiente')
  const tests = Array.from(new Set(pend.map(p => p.test_id).filter(Boolean))) as string[]
  const { data: enl } = tests.length ? await supabase.from('objetivos_tests').select('objetivo_id,test_id,item,banda').in('test_id', tests) : { data: [] as any[] }
  const n = (x: any) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const por: Record<string, Set<string>> = {}
  ;(enl || []).forEach((e: any) => pend.forEach(p => {
    if (p.test_id !== e.test_id) return
    const ok = e.banda ? n(e.banda) === n(p.banda) : e.item == null ? true : n(e.item) === n(p.item)
    if (ok) (por[e.objetivo_id] ||= new Set()).add(p.id)
  }))
  pend.forEach(p => { if (p.sugerido) (por[p.sugerido] ||= new Set()).add(p.id) })
  const ids = Object.keys(por).filter(id => !yaTiene.includes(id))
  if (!ids.length) return []
  const { data: os } = await supabase.from('objetivos').select('id,nombre,archivado_el').in('id', ids)
  return (os || []).filter((o: any) => o.archivado_el == null)
    .map((o: any) => ({ objetivo: { id: o.id, nombre: o.nombre }, ids: Array.from(por[o.id]) }))
    .sort((a, b) => b.ids.length - a.ids.length)
}

/** La vía de un objetivo que sale de una cosa a mejorar. Las que venían de un objetivo
    puesto a mano ('objetivo') no tienen test detrás: no son vía (se cierra a mano). */
function viaDe(p: Propuesta, mov: string | null = null): Via | null {
  if (p.tipo === 'objetivo') return null
  if (p.tipo === 'ejecucion') return { tipo: 'ejecucion', ref: p.ref.split('|')[0], etiqueta: p.origen || 'Ejecución', resuelto: false, fecha_resuelto: null } as Via
  return { tipo: p.tipo, ref: p.ref, etiqueta: `Test: ${p.origen || 'test'}${p.item ? ' · ' + p.item : p.banda ? ' · ' + p.banda : ''}`,
    resuelto: false, fecha_resuelto: null, lado: p.lado || null, mov } as Via
}

/**
 * JUNTAR EN UN OBJETIVO. Con `base` (uno de la biblioteca que encaja) se usa ese, con el
 * nombre que se le ponga. Sin base se crea uno nuevo en la biblioteca con ese nombre y se
 * le dice con qué se evalúa (los tests de las marcadas): así la próxima vez se propone
 * solo, y al ser nuevo no cambia nada a ningún otro cliente.
 */
export async function crearObjetivoCon(pacienteId: string, props: Propuesta[], o: { nombre: string, via: ViaOrigen, base?: string | null }) {
  const nombre = o.nombre.trim()
  if (!nombre || !props.length) return { ok: false as const, error: 'Falta el nombre o lo que junta' }
  let objetivoId = o.base || null
  let movs: Record<string, string | null> = {}
  if (objetivoId) {
    const { data: ya } = await supabase.from('pacientes_objetivos').select('objetivo_id').eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId).maybeSingle()
    if (ya) return anadirAObjetivo(pacienteId, objetivoId, props)
    const { data: enl } = await supabase.from('objetivos_tests').select('test_id,item,banda,movimiento').eq('objetivo_id', objetivoId)
    props.forEach(p => { const e = (enl || []).find((x: any) => x.test_id === p.test_id && (x.item || null) === (p.item || null) && (x.banda || null) === (p.banda || null)); movs[p.id] = e?.movimiento || null })
  } else {
    const r = await supabase.from('objetivos').insert({ nombre, descripcion: null, articulacion_id: null, etiquetas: [], movimientos: [], activo: true }).select('id').single()
    if (r.error || !r.data) return { ok: false as const, error: r.error?.message || 'No se pudo crear el objetivo' }
    objetivoId = r.data.id as string
    const filas = props.filter(p => p.test_id && (p.tipo === 'test' || p.tipo === 'test_item')).map(p => ({ objetivo_id: objetivoId, test_id: p.test_id,
      ...(p.tipo === 'test_item' ? { item: p.item } : {}), ...(p.banda ? { banda: p.banda } : {}) }))
    const unicas = filas.filter((f, i) => filas.findIndex(g => JSON.stringify(g) === JSON.stringify(f)) === i)
    if (unicas.length) {
      const { error } = await supabase.from('objetivos_tests').insert(unicas)
      if (error) console.error('objetivos_tests', error.message)
    }
  }
  const retrato = o.base ? await retratoObjetivo(objetivoId!) : { descripcion: null, movimientos: [] }
  const vias = props.map(p => viaDe(p, movs[p.id] || null)).filter(Boolean) as Via[]
  const { error } = await supabase.from('pacientes_objetivos').insert({ paciente_id: pacienteId, objetivo_id: objetivoId, origen: 'propuestas',
    vias, vias_origen: [o.via], ...retrato, nombre })
  if (error) return { ok: false as const, error: error.message }
  await supabase.from('propuestas_mejora').update({ estado: 'en_objetivo', objetivo_id: objetivoId }).in('id', props.map(p => p.id))
  await supabase.from('eventos_paciente').insert({ paciente_id: pacienteId, tipo: 'objetivo', titulo: `Objetivo abierto: ${nombre}`,
    descripcion: 'Con: ' + props.map(p => p.texto).join(', '), fecha: hoyISO() })
  return { ok: true as const, objetivoId: objetivoId! }
}

/** Añadir las marcadas a un objetivo que ya tiene: pasan a ser vías suyas. */
export async function anadirAObjetivo(pacienteId: string, objetivoId: string, props: Propuesta[]) {
  const { data: po, error: e1 } = await supabase.from('pacientes_objetivos').select('vias,logrado').eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId).maybeSingle()
  if (e1 || !po) return { ok: false as const, error: e1?.message || 'No tiene ese objetivo' }
  const vias: any[] = Array.isArray(po.vias) ? [...po.vias] : []
  props.forEach(p => { const v = viaDe(p); if (v && !vias.some(x => x.tipo === v.tipo && x.ref === v.ref && (x.lado || null) === ((v as any).lado || null))) vias.push(v) })
  const r: any = await guardarVias(pacienteId, objetivoId, vias, { logradoAntes: !!po.logrado, contexto: 'la ficha' })
  if (r && r.ok === false) return { ok: false as const, error: r.error || 'No se pudo guardar' }
  await supabase.from('propuestas_mejora').update({ estado: 'en_objetivo', objetivo_id: objetivoId }).in('id', props.map(p => p.id))
  return { ok: true as const, objetivoId }
}

export async function cambiarEstado(ids: string[], estado: 'pendiente' | 'descartada') {
  if (!ids.length) return
  await supabase.from('propuestas_mejora').update({ estado }).in('id', ids)
}

/**
 * DESDE EL TALLER: un ítem de ejecución que no sale proponía activar un objetivo. Ahora lo
 * deja como cosa a mejorar (con ese objetivo sugerido). Otro toque la quita.
 */
export async function propuestaDeEjecucion(pacienteId: string, objetivoId: string, ejercicioId: string, texto: string, ejercicio?: string) {
  const ref = `${ejercicioId}|${objetivoId}`
  const { data: ex } = await supabase.from('propuestas_mejora').select('id,estado').eq('paciente_id', pacienteId).eq('tipo', 'ejecucion').eq('ref', ref).is('lado', null).maybeSingle()
  if (ex && ex.estado === 'pendiente') { await supabase.from('propuestas_mejora').delete().eq('id', ex.id); return { puesta: false } }
  if (ex) { await supabase.from('propuestas_mejora').update({ estado: 'pendiente', fecha: hoyISO(), objetivo_id: null }).eq('id', ex.id); return { puesta: true } }
  const { error } = await supabase.from('propuestas_mejora').insert({ paciente_id: pacienteId, test_id: null, tipo: 'ejecucion', ref, lado: null,
    texto, origen: 'Taller' + (ejercicio ? ' · ' + ejercicio : ''), sugerido: objetivoId, fecha: hoyISO() })
  if (error) { alert('No se ha podido apuntar: ' + error.message); return { puesta: false } }
  return { puesta: true }
}

/** Las pendientes del taller de un cliente, para pintar la ✓ en el rosco. */
export async function sugeridosTaller(pacienteId: string): Promise<string[]> {
  const { data } = await supabase.from('propuestas_mejora').select('sugerido').eq('paciente_id', pacienteId).eq('tipo', 'ejecucion').eq('estado', 'pendiente')
  return (data || []).map((x: any) => x.sugerido).filter(Boolean)
}
