import { supabase } from '@/lib/supabase'
import { registrarResultadoTest } from '@/lib/tests'
import { esRango, lado, esVald, posicionVald } from '@/lib/vald'
import { traerTodo } from '@/lib/paginar'

// DYNAMO → TESTS DE SIE.
//
// Cada "tipo" de test de DynaMo (zona + movimiento + posición + fuerza/rango) se enlaza
// UNA vez con un ítem de un test de SIE (`vald_mapeo`). A partir de ahí, cada test de
// DynaMo que llega de un paciente enlazado se apunta como resultado de SIE con
// `registrarResultadoTest`, el mismo camino que un test pasado a mano: evalúa la regla
// del ítem (asimetría, umbral...), abre o cierra objetivos y deja el evento en la
// cronología. Nada de lógica propia: si mañana cambia cómo se evalúa un test, esto lo
// hereda.

export interface Mapeo { clave: string, test_id: string, item: string, desde: string | null }

/** La clave de un tipo de test: la misma que agrupa las tarjetas de la vista DynaMo. */
export const claveDynamo = (region: string | null, mov: string | null, posicion: string | null, rango: boolean) =>
  [region, mov, posicion, rango ? 'r' : 'f'].join('|')

const kg = (n: number) => Math.round(n / 9.80665 * 10) / 10

/** De un test de VALD: por cada movimiento, el mejor valor de cada lado (kg o grados). */
export function valoresDe(t: any): { mov: string, clave: string, rango: boolean, I: number | null, D: number | null, U: number | null }[] {
  const rango = esRango(t.categoria)
  const m = new Map<string, { I: number | null, D: number | null, U: number | null }>()
  for (const s of (t.resumen || [])) {
    const v = rango ? s.maxRangeOfMotionDegrees : s.maxForceNewtons
    if (typeof v !== 'number') continue
    const mov = s.movement || t.movimiento
    const p = m.get(mov) || { I: null, D: null, U: null }
    const k = lado(s.laterality) || 'U'
    const val = rango ? Math.round(v) : kg(v)
    p[k] = Math.max(p[k] ?? -Infinity, val)
    m.set(mov, p)
  }
  return Array.from(m.entries()).map(([mov, p]) => ({ mov, clave: claveDynamo(t.region, mov, t.posicion, rango), rango, ...p }))
}

export interface ResumenAplicado { resultados: number, positivos: number, abiertos: number, logrados: number, errores: string[] }

/**
 * Apunta en SIE los tests de DynaMo pendientes de los pacientes enlazados.
 *
 * Un test de VALD queda `aplicado` cuando todos sus movimientos tienen enlace (y se han
 * apuntado, o eran de antes del `desde` de su enlace). Los que tienen algún movimiento
 * sin enlazar siguen pendientes: si mañana lo enlazas, se recogen entonces.
 *
 * Los de un mismo paciente, test de SIE y día se juntan en UN resultado por lado: el
 * DynaMo a 30° y a 60° del mismo día son la misma batería, no dos tests.
 */
export async function aplicarDynamo(): Promise<Record<string, ResumenAplicado>> {
  const out: Record<string, ResumenAplicado> = {}
  const { data: mapeos } = await supabase.from('vald_mapeo').select('clave,test_id,item,desde')
  if (!mapeos?.length) return out
  const porClave = new Map<string, Mapeo>(mapeos.map((m: any) => [m.clave, m]))

  const { data: pacs } = await supabase.from('pacientes').select('id,vald_profile_id').not('vald_profile_id', 'is', null)
  const pacDe = new Map<string, string>((pacs || []).map((p: any) => [p.vald_profile_id, p.id]))
  if (!pacDe.size) return out

  const perfiles = Array.from(pacDe.keys())
  const pend: any[] = []
  for (let i = 0; i < perfiles.length; i += 100) {
    // Por páginas: Supabase corta en 1000 filas sin avisar (ver lib/paginar).
    const { filas } = await traerTodo<any>((d, h) => supabase.from('vald_tests').select('id,profile_id,fecha,categoria,region,movimiento,posicion,resumen')
      .is('aplicado', null).in('profile_id', perfiles.slice(i, i + 100)).order('id').range(d, h))
    pend.push(...filas)
  }
  pend.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
  if (!pend.length) return out

  // Agrupar: paciente | test de SIE | día → { ítem → valores }
  type Vals = { I: number | null, D: number | null, U: number | null }
  type Lote = { pid: string, test_id: string, fecha: string, items: Record<string, Vals> }
  const lotes = new Map<string, Lote>()
  const aplicados: string[] = []
  for (const t of pend) {
    const pid = pacDe.get(t.profile_id); if (!pid || !t.fecha) continue
    const vals = valoresDe(t)
    let completo = vals.length > 0
    for (const v of vals) {
      const m = porClave.get(v.clave)
      if (!m) { completo = false; continue }
      if (m.desde && t.fecha < m.desde) continue // enlazado sin importar lo anterior
      const dia = t.fecha.slice(0, 10)
      const k = `${pid}|${m.test_id}|${dia}`
      const lote: Lote = lotes.get(k) || { pid, test_id: m.test_id, fecha: dia, items: {} }
      const prev = lote.items[m.item] || { I: null, D: null, U: null }
      // Si ese día se repitió, se queda el mejor.
      lote.items[m.item] = { I: mx(prev.I, v.I), D: mx(prev.D, v.D), U: mx(prev.U, v.U) }
      lotes.set(k, lote)
    }
    if (completo) aplicados.push(t.id)
  }

  const tests = new Map<string, any>()
  const ordenados = Array.from(lotes.values()).sort((a, b) => a.fecha.localeCompare(b.fecha))
  for (const L of ordenados) {
    const r = (out[L.pid] ||= { resultados: 0, positivos: 0, abiertos: 0, logrados: 0, errores: [] })
    if (!tests.has(L.test_id)) {
      const { data } = await supabase.from('tests').select('*').eq('id', L.test_id).maybeSingle()
      tests.set(L.test_id, data)
    }
    const test = tests.get(L.test_id)
    if (!test) { r.errores.push('El test de SIE enlazado ya no existe'); continue }
    // Los ítems del test tal y como están en la biblioteca, con lo medido puesto. Lo que
    // DynaMo no midió ese día se queda vacío: no es un cero.
    const conValores = (k: 'I' | 'D' | 'U') => (test.items || []).map((it: any) => {
      const v = L.items[it.nombre]?.[k]
      return { ...it, valor: v != null ? String(v) : '', marcado: false }
    })
    const hayLados = Object.values(L.items).some(v => v.I != null || v.D != null)
    const lados: [string, 'I' | 'D' | 'U', 'I' | 'D' | null][] = test.tipo_lado === 'lateral' && hayLados
      ? [['izquierdo', 'I', 'D'], ['derecho', 'D', 'I']]
      : [['bilateral', 'U', null]]
    for (const [ladoSie, k, otro] of lados) {
      const items = conValores(k)
      if (!items.some((i: any) => i.valor !== '')) continue
      const res = await registrarResultadoTest(L.pid, test, {
        items, otrosItems: otro ? conValores(otro) : null, lado: ladoSie, fecha: L.fecha,
        observaciones: 'DynaMo (VALD)', contexto: 'DynaMo',
      })
      if (!res.ok) { r.errores.push(res.error); continue }
      r.resultados++
      if (res.resultado === 'positivo') r.positivos++
      r.abiertos += res.abiertos; r.logrados += res.logrados
    }
  }

  for (let i = 0; i < aplicados.length; i += 200)
    await supabase.from('vald_tests').update({ aplicado: new Date().toISOString() }).in('id', aplicados.slice(i, i + 200))
  return out
}
const mx = (a: number | null, b: number | null) => a == null ? b : b == null ? a : Math.max(a, b)

/** Una línea para el aviso: "2 resultados apuntados en SIE · 1 positivo · 1 objetivo abierto". */
export function textoResumen(r?: ResumenAplicado): string {
  if (!r || (!r.resultados && !r.errores.length)) return ''
  const p = [`${r.resultados} resultado${r.resultados === 1 ? '' : 's'} apuntado${r.resultados === 1 ? '' : 's'} en SIE`]
  if (r.positivos) p.push(`${r.positivos} positivo${r.positivos === 1 ? '' : 's'}`)
  if (r.abiertos) p.push(`${r.abiertos} objetivo${r.abiertos === 1 ? '' : 's'} abierto${r.abiertos === 1 ? '' : 's'}`)
  if (r.logrados) p.push(`${r.logrados} objetivo${r.logrados === 1 ? '' : 's'} logrado${r.logrados === 1 ? '' : 's'}`)
  if (r.errores.length) p.push(`${r.errores.length} con error: ${r.errores[0]}`)
  return 'DynaMo: ' + p.join(' · ')
}

/**
 * ENLAZAR TODO DE GOLPE: cada tipo de DynaMo que ha llegado y aún no tiene enlace va a
 * un ítem de un test de SIE, agrupando por articulación y por fuerza/rango:
 * "Fuerza de rodilla (DynaMo)" con un ítem por movimiento y posición. Si el test ya
 * existe (por nombre) se le añaden los ítems que falten. Los ítems miden (kg o grados),
 * comparan lados y dan positivo con `asimetria` % (vacío = solo medir).
 * Devuelve cuántos tests se han creado y cuántos enlaces nuevos hay.
 */
export async function enlazarTodo(asimetria: number | null): Promise<{ testsNuevos: number, enlaces: number }> {
  const { data: ms } = await supabase.from('vald_mapeo').select('clave')
  const hay = new Set((ms || []).map((m: any) => m.clave))
  const { filas } = await traerTodo<any>((d, h) => supabase.from('vald_tests').select('id,categoria,region,movimiento,posicion,resumen').order('id').range(d, h))
  // tipo → { test, ítem, lateral }
  const tipos = new Map<string, { test: string, item: string, rango: boolean, lateral: boolean }>()
  for (const t of filas) for (const v of valoresDe(t)) {
    if (hay.has(v.clave)) continue
    const prev = tipos.get(v.clave)
    const zona = (esVald(t.region) || 'Otra zona').toLowerCase()
    tipos.set(v.clave, {
      test: `${v.rango ? 'Rango' : 'Fuerza'} de ${zona} (DynaMo)`,
      item: [esVald(v.mov), posicionVald(t.posicion)].filter(Boolean).join(' · '),
      rango: v.rango, lateral: (prev?.lateral || false) || v.I != null || v.D != null,
    })
  }
  if (!tipos.size) return { testsNuevos: 0, enlaces: 0 }

  const { data: existentes } = await supabase.from('tests').select('id,nombre,items,tipo_lado').is('archivado_el', null)
  const porNombre = new Map<string, any>((existentes || []).map((t: any) => [t.nombre, t]))
  let testsNuevos = 0
  const enlaces: any[] = []
  const porTest = new Map<string, { clave: string, item: string, rango: boolean, lateral: boolean }[]>()
  tipos.forEach((v, clave) => { const l = porTest.get(v.test) || []; l.push({ clave, ...v }); porTest.set(v.test, l) })

  for (const [nombre, lista] of Array.from(porTest.entries())) {
    const items = (l: typeof lista) => l.map(x => ({ nombre: x.item, unidad: x.rango ? 'grados' : 'kg', regla: 'medir', mejor: 'mas',
      ...(asimetria && x.lateral ? { asimetria } : {}) }))
    let t = porNombre.get(nombre)
    if (!t) {
      const { data, error } = await supabase.from('tests').insert({
        nombre, descripcion: 'Resultados del DynaMo (VALD), apuntados solos al traer de VALD.',
        frecuencia_meses: 3, items: items(lista), logica: 'cualquiera', tipo_lado: lista.some(x => x.lateral) ? 'lateral' : 'bilateral',
        bandas: [], baremos: [], etiquetas_relacionadas: [], etiquetas_bloquea: [], video_url: '', imagen_url: '',
      }).select('id').single()
      if (error) throw new Error(error.message)
      t = { id: data.id }; testsNuevos++
    } else {
      const ya = new Set((t.items || []).map((i: any) => i.nombre))
      const faltan = lista.filter(x => !ya.has(x.item))
      if (faltan.length) {
        const { error } = await supabase.from('tests').update({ items: [...(t.items || []), ...items(faltan)] }).eq('id', t.id)
        if (error) throw new Error(error.message)
      }
    }
    lista.forEach(x => enlaces.push({ clave: x.clave, test_id: t.id, item: x.item, desde: null }))
  }
  const { error } = await supabase.from('vald_mapeo').upsert(enlaces, { onConflict: 'clave' })
  if (error) throw new Error(error.message)
  return { testsNuevos, enlaces: enlaces.length }
}
