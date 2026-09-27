import { supabase } from './supabase'
import { guardarVias, type Via } from './objetivos'

/**
 * LA META, COMO UNA VÍA MÁS.
 *
 * Hasta ahora un objetivo se cerraba cuando su test daba negativo: ausencia de
 * hallazgo. Eso es un cribado, no un objetivo de entrenamiento —un paciente que
 * pasa de 8 a 15 repeticiones no habia logrado nada según la app—.
 *
 * Una META pone el listón de ESTE paciente sobre un ítem que YA mide el objetivo.
 * Y no es un sistema aparte: es una vía más, con el mismo `tipo/ref` que las
 * demás, así que `estaLogradoCon` no cambia, `guardarVias` no cambia, el panel
 * las pinta y la fase se cierra igual. Un objetivo con meta no se cierra solo
 * porque el test salga limpio: le falta llegar al número.
 *
 * Como guarda la PARTIDA además del objetivo, por primera vez hay un porcentaje
 * de avance de verdad. Es lo que llena la esfera.
 *
 * SIN META EL OBJETIVO SE COMPORTA COMO HOY. Por eso no hacen falta dos clases de
 * objetivo declaradas: la distinción sale de lo que tiene puesto.
 */

export type Meta = Via & {
  tipo: 'meta'
  /** `testId:índice`, igual que una vía de ítem: es la misma medida. */
  ref: string
  item: string
  unidad?: string | null
  /** Dónde estaba el día que se puso la meta. Congelado. */
  partida: number | null
  partida_fecha?: string | null
  /** Adónde tiene que llegar. */
  hasta: number
  /** 'subir' = el número tiene que crecer; 'bajar' = tiene que bajar. */
  dir: 'subir' | 'bajar'
  /** La fase del ciclo a la que pertenece este escalón, si viene de uno. */
  fase_id?: string | null
}

export const esMeta = (v: any): v is Meta => v?.tipo === 'meta'

/**
 * Por dónde va, de 0 a 1.
 *
 * Se cuenta desde la PARTIDA y no desde cero: de 8 a 20 repeticiones, estar en 15
 * es más de la mitad del camino, no tres cuartos del total. Sin partida no hay
 * porcentaje posible y se devuelve null, que es más honesto que inventar un cero.
 */
export function avanceDe(m: Meta, valor: number | null): number | null {
  if (valor == null || m.partida == null) return null
  const recorrido = m.hasta - m.partida
  if (recorrido === 0) return cumple(m, valor) ? 1 : 0
  const hecho = (valor - m.partida) / recorrido
  return Math.max(0, Math.min(1, hecho))
}

/** Si el valor medido ya alcanza la meta. */
export function cumple(m: Meta, valor: number | null): boolean {
  if (valor == null) return false
  return m.dir === 'bajar' ? valor <= m.hasta : valor >= m.hasta
}

/**
 * Hacia dónde mejora un ítem, deducido de su regla.
 *
 * `regla: 'mayor'` significa que el hallazgo aparece cuando el número SUBE —más
 * milímetros de caída del escafoides es peor—, así que mejorar es bajar. Y al
 * revés. Se deduce para no preguntarlo, pero se guarda en la meta: si mañana se
 * cambia la regla del test, el listón de marzo tiene que seguir significando lo
 * mismo.
 */
export function direccionDe(item: any): 'subir' | 'bajar' {
  return item?.regla === 'mayor' ? 'bajar' : 'subir'
}

const num = (x: any) => {
  const n = Number(String(x ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** El último valor medido de un ítem, por nombre y lado. Es la partida y es el "hoy está en". */
export async function ultimoValor(
  pacienteId: string, testId: string, item: string, lado?: string | null,
): Promise<{ valor: number | null, fecha: string | null, unidad: string | null }> {
  const norm = (x: any) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  let q = supabase.from('resultados_tests')
    .select('fecha,lado,items_resultado').eq('paciente_id', pacienteId).eq('test_id', testId)
    .order('fecha', { ascending: false })
  if (lado) q = q.eq('lado', lado)
  const { data } = await q
  for (const r of (data || [])) {
    const it = (Array.isArray(r.items_resultado) ? r.items_resultado : [])
      .find((x: any) => norm(x?.nombre) === norm(item))
    const v = num(it?.valor)
    if (v != null) return { valor: v, fecha: r.fecha, unidad: it?.unidad || null }
  }
  return { valor: null, fecha: null, unidad: null }
}

/**
 * Pone —o cambia— la meta de una medida. Si ya había una para ese ítem, lado y
 * fase, se sustituye: el listón es uno, no una pila.
 */
export async function ponerMeta(pacienteId: string, objetivoId: string, m: Omit<Meta, 'tipo' | 'resuelto'>) {
  const { data: po } = await supabase.from('pacientes_objetivos')
    .select('vias,logrado').eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId).maybeSingle()
  if (po == null) return { ok: false as const, error: 'El paciente no lleva ese objetivo.' }

  const vias: any[] = Array.isArray(po.vias) ? po.vias : []
  const misma = (v: any) => esMeta(v) && v.ref === m.ref && (v.lado || null) === (m.lado || null)
    && (v.fase_id || null) === (m.fase_id || null)
  const nueva: any = { ...m, tipo: 'meta', resuelto: false, fecha_resuelto: null }
  const quedan = vias.filter(v => misma(v) === false)

  const r = await guardarVias(pacienteId, objetivoId, [...quedan, nueva] as Via[], {
    logradoAntes: !!po.logrado, contexto: 'una meta nueva',
  })
  return r.ok ? { ok: true as const } : { ok: false as const, error: r.error }
}

export async function quitarMeta(pacienteId: string, objetivoId: string, ref: string, lado: any, faseId: any) {
  const { data: po } = await supabase.from('pacientes_objetivos')
    .select('vias,logrado').eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId).maybeSingle()
  if (po == null) return { ok: true as const }
  const vias: any[] = Array.isArray(po.vias) ? po.vias : []
  const quedan = vias.filter(v => (esMeta(v) && v.ref === ref
    && (v.lado || null) === (lado || null) && (v.fase_id || null) === (faseId || null)) === false)
  const r = await guardarVias(pacienteId, objetivoId, quedan as Via[], {
    logradoAntes: !!po.logrado, contexto: 'una meta quitada',
  })
  return r.ok ? { ok: true as const } : { ok: false as const, error: r.error }
}

/**
 * Revisa las metas de un test recién registrado.
 *
 * Se llama desde `registrarResultadoTest`, en el mismo sitio que lo demás: un test
 * es el único momento en que un valor puede haber cambiado, así que revisarlas
 * aquí evita un proceso aparte del que haya que acordarse.
 *
 * Solo toca las metas de ESE test y ESE lado. Y se resuelven o se reabren: si el
 * paciente baja de 16 a 14, la meta vuelve a estar pendiente y el objetivo se
 * reabre solo. Que es justo lo que no hacía el modelo anterior.
 */
export async function revisarMetasDeTest(
  pacienteId: string, testId: string, items: any[], lado?: string | null, contexto?: string,
) {
  const norm = (x: any) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

  const { data: filas } = await supabase.from('pacientes_objetivos')
    .select('objetivo_id,vias,logrado').eq('paciente_id', pacienteId)
  let cumplidas = 0, logrados = 0

  for (const po of (filas || [])) {
    const vias: any[] = Array.isArray(po.vias) ? po.vias : []
    let tocada = false
    const nuevas = vias.map((v: any) => {
      if (esMeta(v) === false) return v
      if (String(v.ref || '').split(':')[0] !== testId) return v
      if ((v.lado || null) !== (lado || null)) return v
      const it = items.find((x: any) => norm(x?.nombre) === norm(v.item))
      const valor = num(it?.valor)
      if (valor == null) return v
      const ok = cumple(v, valor)
      if (ok === !!v.resuelto) return v
      tocada = true
      if (ok) cumplidas++
      return { ...v, resuelto: ok, fecha_resuelto: ok ? new Date().toISOString().slice(0, 10) : null }
    })
    if (tocada === false) continue
    const r = await guardarVias(pacienteId, po.objetivo_id, nuevas as Via[], {
      logradoAntes: !!po.logrado, contexto: contexto || 'una medición',
    })
    if (r.ok && r.logrado && po.logrado !== true) logrados++
  }
  return { cumplidas, logrados }
}

/* ─── QUÉ SE PUEDE MEDIR DE UN OBJETIVO ──────────────────────────────────────
 *
 * Sale de las DOS relaciones, no de una: de los tests enganchados desde la
 * biblioteca (`objetivos_tests`, "lo evalúa") y también de los que ya abrieron el
 * objetivo por un ítem (la vía, "lo abre"). Ese ítem mide exactamente igual, y
 * mirando solo la primera un objetivo con su vía delante salía sin ninguna medida.
 *
 * Solo entran los ítems que dan NÚMERO: en una casilla no hay meta posible.
 * Un test lateral saca una fila por lado, que es el fallo que ya costó caro en las
 * vías —con la rodilla derecha en 20 y la izquierda en 8, una sola meta daría el
 * objetivo por bueno—.
 */

export type Medida = {
  clave: string
  test: any
  item: any
  ref: string
  lado: string | null
  unidad: string
  /** La meta sin fase: la final. */
  meta: any | null
  hoy: number | null
  fechaHoy: string | null
}

export async function medidasDeObjetivo(
  pacienteId: string, objetivo: any, tests: any[],
): Promise<Medida[]> {
  const { testsDeObjetivo } = await import('./objetivosTests')
  const { tieneBarra, unidadDe } = await import('./tests')
  const n = (x: any) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

  const vias: any[] = Array.isArray(objetivo?.vias) ? objetivo.vias : []
  const evs = await testsDeObjetivo(objetivo.id)
  const candidatas: { testId: string, item: string | null, lado?: string | null }[] =
    evs.map((e: any) => ({ testId: e.test_id, item: e.item || null }))

  vias.forEach((v: any) => {
    if (v?.tipo !== 'test' && v?.tipo !== 'test_item') return
    const ref = String(v.ref || '')
    const testId = ref.split(':')[0].split('|')[0]
    if (testId === '') return
    const idx = v.tipo === 'test_item' ? Number(ref.split(':')[1]) : null
    candidatas.push({
      testId,
      item: idx != null && Number.isFinite(idx) ? '#' + idx : null,
      lado: v.lado || null,
    })
  })

  const out: Medida[] = []
  const puestas = new Set<string>()

  for (const c of candidatas) {
    const t = (tests || []).find((x: any) => x.id === c.testId)
    if (t == null || t.archivado_el != null) continue
    const items = Array.isArray(t.items) ? t.items : []

    let cuales: any[]
    if (c.item && c.item.startsWith('#')) {
      const it = items[Number(c.item.slice(1))]
      cuales = it ? [it] : []
    } else if (c.item) {
      cuales = items.filter((i: any) => n(i?.nombre) === n(c.item))
    } else {
      cuales = items
    }

    for (const it of cuales) {
      if (tieneBarra(it) === false) continue
      const idx = items.indexOf(it)
      const ref = t.id + ':' + idx
      const lados: (string | null)[] = c.lado
        ? [c.lado]
        : (t.tipo_lado === 'lateral' ? ['izquierdo', 'derecho'] : ['bilateral'])
      for (const lado of lados) {
        const clave = ref + '|' + lado
        if (puestas.has(clave)) continue
        puestas.add(clave)
        const meta = vias.find((v: any) => esMeta(v) && v.ref === ref
          && (v.lado || null) === lado && (v.fase_id || null) === null) || null
        const u = await ultimoValor(pacienteId, t.id, it.nombre, lado)
        out.push({
          clave, test: t, item: it, ref, lado,
          unidad: (unidadDe(it)?.simbolo || '').trim() || unidadDe(it)?.id || '',
          meta, hoy: u.valor, fechaHoy: u.fecha,
        })
      }
    }
  }
  return out
}

/** La meta de una medida EN UNA FASE concreta: el escalón. */
export function escalonDe(objetivo: any, ref: string, lado: string | null, faseId: string) {
  const vias: any[] = Array.isArray(objetivo?.vias) ? objetivo.vias : []
  return vias.find((v: any) => esMeta(v) && v.ref === ref
    && (v.lado || null) === (lado || null) && v.fase_id === faseId) || null
}
