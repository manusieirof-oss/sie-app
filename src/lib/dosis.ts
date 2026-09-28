import { supabase } from './supabase'
import { hoyISO } from './fechas'
import { medidasDeObjetivo, type Medida } from './metasVia'

// ---------------------------------------------------------------------------
// CUANTO SE HA TRABAJADO UN OBJETIVO, SIN ETIQUETAR NADA
//
// Que una sesion "trabaje" un objetivo era una etiqueta puesta a mano que nadie
// comprobaba, y ponersela al ejercicio habria sido la misma fisura un piso mas
// abajo. Asi que no se etiqueta: la unidad es la VENTANA entre dos mediciones
// del test que ya mide el objetivo.
//
// El hombro daba 8 el 12 de agosto y 15 el 19 de septiembre. En medio hubo 9
// clases dadas, y en ellas se hizo press militar 7 veces. Eso no lo declara
// nadie: sale de `registros_ejercicio` cruzado con `resultados_tests`.
//
// De ahi que el mismo ejercicio cuente distinto en cada objetivo: son ventanas
// distintas. Y de ahi que no haya nada que guardar -si manana cambia la forma
// de contar, el pasado se recalcula solo-.
//
// LIMITE, y es importante: en una ventana se hicieron ocho ejercicios. Que el
// numero suba no dice cual lo subio. Esto cuenta lo que paso; no demuestra que
// nada funcione.
// ---------------------------------------------------------------------------

const norm = (x: any) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
const num = (x: any) => {
  const n = Number(String(x ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export type Punto = { fecha: string, valor: number }

/** Todas las mediciones de un item, de la mas vieja a la mas nueva. */
export async function serieDe(pacienteId: string, testId: string, item: string, lado?: string | null) {
  let q = supabase.from('resultados_tests')
    .select('fecha,lado,items_resultado').eq('paciente_id', pacienteId).eq('test_id', testId)
    .order('fecha')
  if (lado) q = q.eq('lado', lado)
  const { data } = await q
  const serie: Punto[] = []
  for (const r of (data || []) as any[]) {
    const it = (Array.isArray(r.items_resultado) ? r.items_resultado : [])
      .find((x: any) => norm(x?.nombre) === norm(item))
    const v = num(it?.valor)
    if (v != null) serie.push({ fecha: r.fecha, valor: v })
  }
  return serie
}

/**
 * Las clases DADAS en (desde, hasta]. Ni las canceladas ni las faltas: la
 * dosis es lo que piso la sala, no lo que estaba en la agenda.
 */
export async function clasesEntre(pacienteId: string, desde: string | null, hasta: string) {
  let q = supabase.from('citas').select('fecha')
    .eq('paciente_id', pacienteId).lte('fecha', hasta)
    .not('estado', 'in', '("cancelada","falta")')
  if (desde) q = q.gt('fecha', desde)
  const { data } = await q
  return (data || []).map((c: any) => c.fecha)
}

export type EjercicioEnVentana = {
  id: string | null
  nombre: string
  clases: number
  series: number
}

/** Que se hizo en esas clases. Una fila por ejercicio, con en cuantas salio. */
export async function ejerciciosEntre(pacienteId: string, desde: string | null, hasta: string) {
  let q = supabase.from('registros_ejercicio')
    .select('fecha,ejercicio_id,ejercicio_nombre,series')
    .eq('paciente_id', pacienteId).lte('fecha', hasta)
  if (desde) q = q.gt('fecha', desde)
  const { data } = await q

  const por: Record<string, { id: string | null, nombre: string, dias: Set<string>, series: number }> = {}
  for (const r of (data || []) as any[]) {
    const k = r.ejercicio_id || 'n:' + norm(r.ejercicio_nombre)
    if (por[k] == null) por[k] = { id: r.ejercicio_id || null, nombre: r.ejercicio_nombre || 'Ejercicio', dias: new Set(), series: 0 }
    if (r.fecha) por[k].dias.add(r.fecha)
    por[k].series += Array.isArray(r.series) ? r.series.length : 0
  }
  return Object.values(por)
    .map(x => ({ id: x.id, nombre: x.nombre, clases: x.dias.size, series: x.series }))
    .sort((a, b) => b.clases - a.clases || b.series - a.series)
}

export type Ventana = {
  desde: string | null
  hasta: string | null
  valorDesde: number | null
  valorHasta: number | null
  clases: number
  enCurso: boolean
}

/**
 * La dosis de un objetivo.
 *
 * `ventanas` va de la mas nueva a la mas vieja e incluye la EN CURSO -desde la
 * ultima medicion hasta hoy-, que sin numero todavia es justo el aviso de que
 * toca medir. `ejercicios` son los de la ultima ventana cerrada, que es la
 * unica de la que se puede decir si el numero se movio.
 */
export async function dosisDeObjetivo(pacienteId: string, objetivo: any, tests: any[]) {
  const hoy = hoyISO()

  // La medida con mas historia manda: mezclar dos items seria mezclar unidades.
  let medida: Medida | null = null
  let serie: Punto[] = []
  try {
    const medidas = await medidasDeObjetivo(pacienteId, objetivo, tests)
    for (const m of medidas) {
      const s = await serieDe(pacienteId, m.test.id, m.item, m.lado)
      if (s.length > serie.length) { serie = s; medida = m }
    }
  } catch { /* sin medidas: se queda sin ventanas */ }

  const clasesTotales = (await clasesEntre(pacienteId, null, hoy)).length

  if (serie.length === 0) {
    return { medida: null, ventanas: [] as Ventana[], ejercicios: [] as EjercicioEnVentana[],
      cerrada: null as Ventana | null, clasesTotales }
  }

  const cortes: { desde: string | null, hasta: string | null }[] = []
  for (let i = 0; i < serie.length; i++) {
    cortes.push({ desde: i === 0 ? null : serie[i - 1].fecha, hasta: serie[i].fecha })
  }
  cortes.push({ desde: serie[serie.length - 1].fecha, hasta: null })

  const ventanas: Ventana[] = []
  for (const c of cortes) {
    const fechas = await clasesEntre(pacienteId, c.desde, c.hasta || hoy)
    ventanas.push({
      desde: c.desde, hasta: c.hasta,
      valorDesde: c.desde ? (serie.find(p => p.fecha === c.desde)?.valor ?? null) : null,
      valorHasta: c.hasta ? (serie.find(p => p.fecha === c.hasta)?.valor ?? null) : null,
      clases: fechas.length,
      enCurso: c.hasta == null,
    })
  }
  ventanas.reverse()

  // La ultima cerrada: la primera que ya tiene numero de llegada.
  const cerrada = ventanas.find(v => v.enCurso === false && v.valorHasta != null) || null
  const ejercicios = cerrada ? await ejerciciosEntre(pacienteId, cerrada.desde, cerrada.hasta as string) : []

  return { medida, ventanas, ejercicios, cerrada, clasesTotales }
}
