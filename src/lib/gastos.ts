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
  // El `.select()` es lo que distingue "se ha guardado" de "no ha tocado nada".
  // Sin él, un UPDATE bloqueado por RLS devuelve lo mismo que uno correcto:
  // silencio. Y un fallo que se presenta como un éxito es peor que un fallo.
  const { data, error } = await supabase.from('gastos').update({
    base_imponible: Math.round(base * 100) / 100,
    importe: totalDe(base, ivaPct, irpfPct),
    iva_pct: ivaPct,
    irpf_pct: irpfPct,
    estimado: false,
    tiene_factura: true,
  }).eq('id', id).select('id')
  if (error) return { ok: false as const, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false as const,
      error: 'la base de datos no ha modificado ninguna fila (suele faltar el permiso de actualizar en la tabla de gastos)' }
  }
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

// ---------------------------------------------------------------------------
// PRECIO FIJO O PRECIO QUE VARÍA
//
// La media sirve para la luz, que cambia cada mes. Para la gestoría o la
// limpieza es peor que inútil: si son 90 € y en abril suben a 100, la media de
// 90·90·90·100 da 92,50 €, un importe que no está en ninguna factura y que
// además no volverá a estarlo nunca.
//
// Lo que quieres en un coste fijo es el ÚLTIMO precio conocido. Y cuando sube,
// que suba en todas las previsiones que quedan de golpe.
// ---------------------------------------------------------------------------

export const MODOS_ESTIMACION = [
  { id: 'fijo',  nombre: 'Siempre el mismo importe',
    ayuda: 'Gestoría, limpieza, alquiler. Repite el último precio conocido.' },
  { id: 'media', nombre: 'La media de los anteriores',
    ayuda: 'Luz, agua, teléfono. Lo que varía cada factura.' },
] as const

export type ModoEstimacion = typeof MODOS_ESTIMACION[number]['id']

/** Lo natural según el tipo de gasto, para no obligar a elegir en cada alta. */
export const modoPorDefecto = (tipo: string): ModoEstimacion =>
  tipo === 'fijo' ? 'fijo' : 'media'

/**
 * Cambia el importe de las previsiones que quedan POR VENIR de una serie.
 *
 * Es la respuesta a "en abril me suben la cuota": confirmas la de abril con el
 * precio nuevo y las de mayo a diciembre se ponen al día de una vez.
 *
 * Solo toca las que siguen siendo estimaciones. Una factura ya confirmada dice
 * lo que decía su papel, y eso no se reescribe: lo que ya pagaste a 90 € no
 * pasa a haber costado 100 porque hoy cueste otra cosa.
 */
export async function actualizarEstimadosPendientes(
  serieId: string, desdeFecha: string, base: number, ivaPct: number, irpfPct: number,
) {
  const { data, error } = await supabase.from('gastos')
    .update({
      base_imponible: Math.round(base * 100) / 100,
      importe: totalDe(base, ivaPct, irpfPct),
    })
    .eq('serie_id', serieId).eq('estimado', true).gt('fecha', desdeFecha)
    .select('id')
  if (error) return { ok: false as const, error: error.message, actualizados: 0 }
  return { ok: true as const, actualizados: (data || []).length }
}

/** Cuántas previsiones quedan por delante de una fecha. Para poder preguntar antes. */
export async function contarPendientes(serieId: string, desdeFecha: string) {
  const { count, error } = await supabase.from('gastos')
    .select('id', { count: 'exact', head: true })
    .eq('serie_id', serieId).eq('estimado', true).gt('fecha', desdeFecha)
  if (error) return { ok: false as const, error: error.message, n: 0 }
  return { ok: true as const, n: count ?? 0 }
}

/**
 * Dar de baja un servicio: borra las previsiones a partir de una fecha.
 *
 * Dejaste la limpieza en junio pero tienes previsiones hasta diciembre. Esas
 * seis no van a existir, y mientras estén ahí inflan el gasto del mes y ensucian
 * la media del concepto para siempre.
 *
 * Lo YA CONFIRMADO no se toca, esté antes o después de la fecha: eso son
 * facturas que pagaste, y siguen siendo gasto deducible aunque el servicio se
 * haya acabado.
 */
export async function darDeBajaSerie(serieId: string, desdeFecha: string) {
  const { data, error } = await supabase.from('gastos')
    .delete()
    .eq('serie_id', serieId).eq('estimado', true).gte('fecha', desdeFecha)
    .select('id')
  if (error) return { ok: false as const, error: error.message, borrados: 0 }
  return { ok: true as const, borrados: (data || []).length }
}

/**
 * El último importe REAL de un concepto. Lo que usa el modo "fijo".
 *
 * El último y no la media: en un coste fijo lo que vale es lo que cuesta ahora,
 * no lo que costaba de media antes de la subida.
 */
export async function ultimoImporteDe(concepto: string) {
  const clave = concepto.trim().toLowerCase()
  if (!clave) return { ok: true as const, base: null }
  const { data, error } = await supabase.from('gastos')
    .select('base_imponible, fecha')
    .eq('estimado', false).ilike('concepto', clave)
    .not('base_imponible', 'is', null)
    .order('fecha', { ascending: false }).limit(1)
  if (error) return { ok: false as const, error: error.message, base: null }
  const b = data?.[0]?.base_imponible
  return { ok: true as const, base: b != null ? Number(b) : null }
}

// ---------------------------------------------------------------------------
// EN QUÉ TE GASTAS EL DINERO
//
// Era un campo de texto libre, y un campo de texto libre acaba siempre igual:
// "Suministros", "suministros" y "Luz" son tres categorías distintas para el
// ordenador, así que el desglose se rompe solo en tres meses sin que nadie haga
// nada mal. Lista cerrada.
//
// Lo que ya estaba guardado se sigue viendo tal cual: cambiar a mano el
// histórico de alguien para que encaje en una lista nueva sería reescribir lo
// que ya pasó. Se queda como está y las nuevas van por aquí.
//
// UN AVISO SOBRE LOS IMPUESTOS: el IVA y el IRPF que ingresas a Hacienda NO son
// gasto. Son dinero que recaudas o que adelantas, no coste tuyo. En "Bancos e
// impuestos" van las comisiones y las tasas, no el resultado del 303.
// ---------------------------------------------------------------------------

export const CATEGORIAS_GASTO = [
  { id: 'Local',                  ayuda: 'Alquiler, comunidad, IBI, obras, limpieza.' },
  { id: 'Suministros',            ayuda: 'Luz, agua, internet, móvil.' },
  { id: 'Personal',               ayuda: 'Nóminas, seguros sociales, tu cuota de autónomos.' },
  { id: 'Servicios profesionales',ayuda: 'Gestoría, abogado, prevención de riesgos, protección de datos.' },
  { id: 'Material y equipamiento',ayuda: 'Fungible, aparatos, mantenimiento y reparaciones.' },
  { id: 'Software y web',         ayuda: 'Programas, dominio, hosting, comisiones de la pasarela.' },
  { id: 'Seguros',                ayuda: 'Responsabilidad civil, seguro del local.' },
  { id: 'Marketing',              ayuda: 'Redes, cartelería, fotos, imprenta.' },
  { id: 'Formación',              ayuda: 'Cursos, congresos, colegiación.' },
  { id: 'Bancos e impuestos',     ayuda: 'Comisiones del TPV, comisiones bancarias, tasas. El IVA y el IRPF que pagas a Hacienda NO van aquí: no son gasto.' },
  { id: 'Otros',                  ayuda: 'Lo que no encaje. Si crece mucho, es que falta una categoría.' },
] as const

export const ayudaDeCategoria = (id?: string | null) =>
  CATEGORIAS_GASTO.find(c => c.id === id)?.ayuda ?? null
