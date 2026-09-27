import { supabase } from './supabase'
import { aISO, hoyISO, desdeISO } from './fechas'

// ---------------------------------------------------------------------------
// EL OBJETIVO LOGRADO NO LO ES PARA SIEMPRE
//
// En rehabilitacion se pierde lo ganado. Un objetivo conseguido en marzo
// seguia conseguido en diciembre sin una sola medicion nueva, y como al
// cerrarse desaparecia de la lista activa, nadie volvia a pasarle el test.
//
// Asi que lo logrado pide confirmacion. NO se reabre solo: eso seria mentir al
// reves -no sabes que lo ha perdido, sabes que hace tiempo que no lo miras-.
// Se marca "por confirmar" y el aviso se oscurece con el tiempo. Quien reabre
// el objetivo sigue siendo el test, como siempre.
//
// La escalera: al mes, luego a los tres, luego cada seis. Un objetivo
// confirmado tres veces ya es estable y no merece mirarse cada mes. La fecha
// se puede poner a mano siempre: la escalera es el punto de partida, no una
// norma.
// ---------------------------------------------------------------------------

export const ESCALA = [1, 3, 6]

/** Meses hasta la siguiente confirmacion, segun cuantas lleve encadenadas. */
export function plazoDe(confirmaciones: number): number {
  const i = Math.min(Math.max(0, Math.floor(confirmaciones || 0)), ESCALA.length - 1)
  return ESCALA[i]
}

/** Suma meses sin que el 31 de enero se vaya al 3 de marzo. */
export function sumarMeses(iso: string, meses: number): string {
  const d = desdeISO(iso)
  const dia = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + meses)
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(dia, ultimo))
  return aISO(d)
}

/** Dias que faltan para la revision. Negativo = ya vencida. */
export function diasPara(revisarEl?: string | null): number | null {
  if (!revisarEl) return null
  const a = desdeISO(hoyISO()).getTime()
  const b = desdeISO(revisarEl).getTime()
  return Math.round((b - a) / 86400000)
}

/**
 * 0 al dia · 1 toca ya · 2 lleva un mes vencida · 3 lleva tres.
 * El aviso crece con el tiempo en vez de reabrir nada.
 */
export function urgenciaDe(revisarEl?: string | null): 0 | 1 | 2 | 3 {
  const d = diasPara(revisarEl)
  if (d == null || d > 0) return 0
  if (d > -30) return 1
  if (d > -90) return 2
  return 3
}

/** El aro de la moneda. El 0 no pinta nada. */
export const COLOR_URGENCIA = ['', '#C9A84C', '#B8791F', '#B4544F']

export function textoRevision(revisarEl?: string | null): string {
  const d = diasPara(revisarEl)
  if (d == null) return ''
  const cuando = desdeISO(revisarEl as string)
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  if (d > 1) return `se confirma el ${cuando}`
  if (d === 1) return 'se confirma mañana'
  if (d === 0) return 'toca confirmarlo hoy'
  if (d > -30) return `por confirmar desde el ${cuando}`
  const meses = Math.floor(-d / 30)
  return `sin confirmar desde hace ${meses} mes${meses === 1 ? '' : 'es'}`
}

// ── Lo que mueve la fecha ──────────────────────────────────────────────────

/** Recien logrado: primera confirmacion al mes. */
export async function alLograr(pacienteId: string, objetivoId: string) {
  await supabase.from('pacientes_objetivos')
    .update({ revisar_el: sumarMeses(hoyISO(), plazoDe(0)), confirmaciones: 0 })
    .eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId)
}

/**
 * Vuelve a pasar el test y sigue logrado: sube un escalon de la escalera.
 * Solo cuenta si venia de una medicion, no de cualquier retoque de una via.
 */
export async function alConfirmar(pacienteId: string, objetivoId: string) {
  const { data } = await supabase.from('pacientes_objetivos')
    .select('confirmaciones, revisar_el')
    .eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId).maybeSingle()
  const ya = Number(data?.confirmaciones || 0)
  // Ya se confirmo hoy: un test que toca dos vias del mismo objetivo no sube
  // dos escalones de golpe.
  if (data?.revisar_el && data.revisar_el === sumarMeses(hoyISO(), plazoDe(ya))) return
  const n = ya + 1
  await supabase.from('pacientes_objetivos')
    .update({ revisar_el: sumarMeses(hoyISO(), plazoDe(n)), confirmaciones: n })
    .eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId)
}

/** Deja de estar logrado: ya no hay nada que confirmar, vuelve a la lista activa. */
export async function alReabrir(pacienteId: string, objetivoId: string) {
  await supabase.from('pacientes_objetivos')
    .update({ revisar_el: null, confirmaciones: 0 })
    .eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId)
}

/** El "editar" a mano: la escalera es el punto de partida, no una norma. */
export async function fijarRevision(pacienteId: string, objetivoId: string, fecha: string | null) {
  const { error } = await supabase.from('pacientes_objetivos')
    .update({ revisar_el: fecha || null })
    .eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

// ── Quien tiene algo por confirmar ─────────────────────────────────────────

export type PorConfirmar = {
  objetivo_id: string
  nombre: string
  revisar_el: string
  urgencia: 0 | 1 | 2 | 3
}

/** Los objetivos de un paciente cuya confirmacion ya vence. Ordenados por lo mas viejo. */
export async function porConfirmarDe(pacienteId: string, hasta?: string): Promise<PorConfirmar[]> {
  if (!pacienteId) return []
  const { data } = await supabase.from('pacientes_objetivos')
    .select('objetivo_id, nombre, revisar_el, objetivos(nombre)')
    .eq('paciente_id', pacienteId).eq('logrado', true)
    .not('revisar_el', 'is', null).lte('revisar_el', hasta || hoyISO())
    .order('revisar_el')
  return (data || []).map((o: any) => ({
    objetivo_id: o.objetivo_id,
    nombre: o.nombre || o.objetivos?.nombre || 'Objetivo',
    revisar_el: o.revisar_el,
    urgencia: urgenciaDe(o.revisar_el),
  }))
}

/**
 * LOS TESTS QUE CONFIRMAN LO LOGRADO, PARA EL TALLER.
 *
 * No cuelgan de ninguna evaluacion ni de ningun dia: la fecha vive en el
 * objetivo, asi que desde que vence salen en CUALQUIER clase que tenga el
 * paciente. Por eso no se pierde nada si hoy no tiene citas: el dia que le
 * pongas una, aparece solo.
 */
export async function testsPorConfirmar(pacienteId: string, hasta?: string) {
  const pend = await porConfirmarDe(pacienteId, hasta)
  if (pend.length === 0) return { tests: [], sinTest: [] as PorConfirmar[] }

  const { data: enl } = await supabase.from('objetivos_tests')
    .select('objetivo_id,test_id,item, tests:test_id(*)')
    .in('objetivo_id', pend.map(p => p.objetivo_id))

  const por: Record<string, { test: any, items: string[], entero: boolean,
    objetivos: string[], urgencia: 0 | 1 | 2 | 3 }> = {}
  for (const r of (enl || []) as any[]) {
    const t = Array.isArray(r.tests) ? r.tests[0] : r.tests
    if (t == null || t.archivado_el != null) continue
    const p = pend.find(x => x.objetivo_id === r.objetivo_id)
    if (p == null) continue
    if (por[t.id] == null) por[t.id] = { test: t, items: [], entero: false, objetivos: [], urgencia: 0 }
    if (r.item == null) por[t.id].entero = true
    else if (por[t.id].items.includes(r.item) === false) por[t.id].items.push(r.item)
    if (por[t.id].objetivos.includes(p.nombre) === false) por[t.id].objetivos.push(p.nombre)
    if (p.urgencia > por[t.id].urgencia) por[t.id].urgencia = p.urgencia
  }

  /* LOS QUE NO TIENEN TEST tampoco pueden quedarse fuera: se cerraron
     mirandolos y son justo los que mas facil es olvidar, porque nada los saca.
     Van a la misma lista, pero se confirman a mano. */
  const conTest = new Set<string>()
  for (const r of (enl || []) as any[]) {
    const t = Array.isArray(r.tests) ? r.tests[0] : r.tests
    if (t && t.archivado_el == null) conTest.add(r.objetivo_id)
  }

  return {
    tests: Object.values(por).map(x => ({
      test: x.test,
      items: x.entero ? [] : x.items,
      motivo: 'mantenimiento' as const,
      objetivos: x.objetivos,
      urgencia: x.urgencia,
    })),
    sinTest: pend.filter(p => conTest.has(p.objetivo_id) === false),
  }
}

/**
 * CONFIRMAR A MANO.
 *
 * Un objetivo cerrado a mano -"ya sabe atarse los cordones"- no tiene test del
 * que heredar nada, asi que tampoco puede confirmarse con uno. Se mira y se
 * dice. Sube el mismo escalon que si lo hubiera dicho una medicion, y queda en
 * el historial para que no parezca que el objetivo se cerro solo.
 */
export async function confirmarAMano(pacienteId: string, objetivoId: string, nombre?: string) {
  await alConfirmar(pacienteId, objetivoId)
  await supabase.from('eventos_paciente').insert({
    paciente_id: pacienteId,
    tipo: 'objetivo_confirmado',
    titulo: `Sigue logrado: ${nombre || 'objetivo'}`,
    descripcion: 'Confirmado a mano',
    fecha: hoyISO(),
  })
}
