import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// GASTOS RECURRENTES Y ESTIMADOS
//
// El alquiler se paga los doce meses, el móvil también, la luz cada dos. Meter
// eso a mano son doce oportunidades de equivocarse y una de olvidarse.
//
// LA REGLA QUE RIGE TODO ESTO: UNA ESTIMACIÓN NO ES UNA FACTURA.
//
// Un gasto con `estimado = true` es una previsión: sabes que vas a pagarlo pero
// el papel todavía no existe. Por eso NO puede tocar los impuestos — deducir el
// IVA de una factura que no tienes, o declarar una retención que no has
// practicado, no es un número feo en pantalla, es una declaración mal hecha.
//
// Se ven en el resumen y en la previsión, marcadas, porque para eso están: para
// saber lo que viene. Y desaparecen del 303 y del 115 hasta que confirmes que
// la factura llegó.
// ---------------------------------------------------------------------------

/**
 * Cada cuánto se repite. Los meses de salto son lo único que las diferencia,
 * así que generar la serie es una sola función para las cuatro.
 */
export const CADENCIAS = [
  { id: 'mensual',    nombre: 'Cada mes',      meses: 1,  ayuda: 'Alquiler, móvil, cuotas.' },
  { id: 'bimestral',  nombre: 'Cada 2 meses',  meses: 2,  ayuda: 'La luz y el agua suelen venir así.' },
  { id: 'trimestral', nombre: 'Cada 3 meses',  meses: 3,  ayuda: 'Algunos seguros y servicios.' },
  { id: 'anual',      nombre: 'Una vez al año', meses: 12, ayuda: 'Seguro del local, dominios, licencias.' },
] as const

export type Cadencia = typeof CADENCIAS[number]['id']

export const mesesDeCadencia = (c: string) =>
  CADENCIAS.find(x => x.id === c)?.meses ?? 1

export type Plantilla = {
  concepto: string
  base: number
  iva_pct: number
  irpf_pct: number
  irpf_modelo: string | null
  tipo: string
  categoria: string | null
  notas: string | null
}

/** Base + IVA − retención. La misma cuenta que el formulario, en un solo sitio. */
export function totalDe(base: number, ivaPct: number, irpfPct: number) {
  const iva = base * (ivaPct / 100)
  const irpf = base * (irpfPct / 100)
  return Math.round((base + iva - irpf) * 100) / 100
}

/**
 * Las fechas de una serie: desde `desde` hasta fin del año de `desde`, saltando
 * los meses de la cadencia.
 *
 * El día se conserva —el alquiler es siempre el 5— y si un mes no llega a ese
 * día se usa el último. Sin eso, "el 31" en febrero se iría a marzo.
 */
export function fechasDeSerie(desde: string, cadencia: string, hastaAnio?: number): string[] {
  const [a, m, d] = desde.split('-').map(Number)
  if (!a || !m || !d) return []
  const salto = mesesDeCadencia(cadencia)
  const finAnio = hastaAnio ?? a
  const fechas: string[] = []
  for (let i = 0; i < 60; i++) {
    const mesAbs = (m - 1) + i * salto
    const anio = a + Math.floor(mesAbs / 12)
    const mes = (mesAbs % 12) + 1
    if (anio > finAnio) break
    // Día 31 en un mes de 30: se queda en el último día real del mes.
    const ultimo = new Date(anio, mes, 0).getDate()
    const dia = Math.min(d, ultimo)
    fechas.push(`${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`)
  }
  return fechas
}

/**
 * Lo que ha costado de media un concepto, mirando SOLO los gastos reales.
 *
 * Promediar estimaciones sería promediar inventos: la media de doce previsiones
 * calculadas a partir de una previsión no dice nada de la realidad.
 *
 * Devuelve null si no hay histórico, y entonces quien llama usa el importe que
 * se esté tecleando. Sin histórico no hay media, y fingir una sería peor.
 */
export async function mediaDeConcepto(concepto: string) {
  const clave = concepto.trim().toLowerCase()
  if (!clave) return { ok: true as const, media: null, n: 0 }
  const { data, error } = await supabase.from('gastos')
    .select('base_imponible')
    .eq('estimado', false)
    .ilike('concepto', clave)
    .not('base_imponible', 'is', null)
  if (error) return { ok: false as const, error: error.message, media: null, n: 0 }
  const bases = (data || []).map((g: any) => Number(g.base_imponible)).filter(n => !isNaN(n))
  if (!bases.length) return { ok: true as const, media: null, n: 0 }
  const media = bases.reduce((a, b) => a + b, 0) / bases.length
  return { ok: true as const, media: Math.round(media * 100) / 100, n: bases.length }
}

/**
 * Crea la serie entera de un gasto recurrente.
 *
 * El PRIMERO es real —es la factura que tienes delante— y los siguientes van
 * como estimados. Esa es la diferencia que decide si cuentan para el 303.
 *
 * Todos comparten `serie_id`, para poder verlos juntos y para que borrar la
 * serie no obligue a ir uno por uno.
 */
export async function crearSerie(args: {
  plantilla: Plantilla
  desde: string
  cadencia: string
  hastaAnio?: number
  /** Base a usar en los estimados. Si falta, se repite la del primero. */
  baseEstimada?: number | null
}) {
  const fechas = fechasDeSerie(args.desde, args.cadencia, args.hastaAnio)
  if (!fechas.length) return { ok: false as const, error: 'No hay fechas que generar' }

  const serieId = crypto.randomUUID()
  const p = args.plantilla
  const baseEst = args.baseEstimada ?? p.base

  const filas = fechas.map((fecha, i) => {
    const base = i === 0 ? p.base : baseEst
    return {
      concepto: p.concepto,
      importe: totalDe(base, p.iva_pct, p.irpf_pct),
      base_imponible: Math.round(base * 100) / 100,
      iva_pct: p.iva_pct,
      irpf_pct: p.irpf_pct,
      irpf_modelo: p.irpf_pct > 0 ? p.irpf_modelo : null,
      tipo: p.tipo,
      categoria: p.categoria,
      fecha,
      // El primero es la factura que tienes en la mano; el resto, previsiones.
      estimado: i > 0,
      tiene_factura: i === 0,
      notas: p.notas,
      serie_id: serieId,
    }
  })

  const { error } = await supabase.from('gastos').insert(filas)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, creados: filas.length, estimados: filas.length - 1, serieId }
}

/**
 * Confirma una estimación: llegó la factura y este es el importe de verdad.
 *
 * A partir de aquí sí cuenta para los impuestos, así que se pide la base real.
 * Si coincide con la estimada, mejor; si no, manda la factura.
 */
export async function confirmarGasto(id: string, base: number, ivaPct: number, irpfPct: number) {
  const { error } = await supabase.from('gastos').update({
    base_imponible: Math.round(base * 100) / 100,
    importe: totalDe(base, ivaPct, irpfPct),
    iva_pct: ivaPct,
    irpf_pct: irpfPct,
    estimado: false,
    tiene_factura: true,
  }).eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

/** Borra los que quedan por confirmar de una serie. Los reales no se tocan. */
export async function borrarEstimadosDeSerie(serieId: string) {
  const { error, count } = await supabase.from('gastos')
    .delete({ count: 'exact' })
    .eq('serie_id', serieId).eq('estimado', true)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, borrados: count ?? 0 }
}

/** Los que ya deberían haber llegado y siguen sin confirmar. */
export function estimadosVencidos(gastos: any[], hoy: string) {
  return (gastos || []).filter(g => g.estimado && g.fecha && g.fecha <= hoy)
}
