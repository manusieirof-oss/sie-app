import { supabase } from './supabase'
import { precioFinalPlan, precioConDescuento, redondear, Plan, esVentaPuntual } from './bonos'

// ---------------------------------------------------------------------------
// COBROS Y FACTURAS
//
// Único sitio que cobra y el único que emite factura. Crear el cobro, sus
// líneas, reservar el número y escribir la factura van juntos porque no puede
// pasar que ocurra una cosa sin la otra: un cobro sin factura es dinero sin
// documento, y un número reservado sin factura es un hueco en la numeración.
//
// Por eso el trabajo lo hace una función de Postgres (`emitir_cobro`) y no esta
// capa: desde el navegador no hay transacción, así que si fallara el último
// paso nos quedaríamos con el número gastado y sin factura. Aquí solo se
// prepara lo que se va a cobrar y se interpreta lo que devuelve.
// ---------------------------------------------------------------------------

export const SERIE_COMPLETA      = 'F'
export const SERIE_SIMPLIFICADA  = 'S'
export const SERIE_RECTIFICATIVA = 'R'

export type FormaPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'domiciliacion' | 'otro'

export type LineaCobro = {
  concepto: string
  /** Bono al que corresponde la línea, si corresponde a alguno. */
  bono_id?: string | null
  /** Fracción de mes. 1 = mes entero, 0.5 = media cuota. Solo informativo en la factura. */
  cantidad?: number
  /** Total CON IVA de la línea. Es lo que se teclea; base y cuota salen de aquí. */
  total: number
  iva_pct?: number
  exencion?: string | null
  /**
   * Precio de partida, antes del descuento de línea. Se guarda para poder
   * quitar y cambiar el descuento sin que se acumule: aplicar un 10% dos veces
   * tiene que seguir siendo un 10%, no un 19%.
   */
  precioBase?: number
  /** Descuento aplicado a ESTA línea y solo a este cobro. */
  descuento?: { nombre: string, tipo: string, valor: number } | null
}

// ---------------------------------------------------------------------------
// CÁLCULO
// ---------------------------------------------------------------------------

/**
 * Parte un total con IVA en base y cuota. Se trabaja desde el total y no desde
 * la base porque es lo que se teclea y lo que el paciente paga: si se calculara
 * al revés, un redondeo podría dejar un cobro de 63,01 €.
 */
export function desgloseDesdeTotal(total: number, ivaPct: number) {
  const base = ivaPct > 0 ? redondear(total / (1 + ivaPct / 100)) : redondear(total)
  return { base, cuota: redondear(total - base), total: redondear(total) }
}

/**
 * Fracción de mes que le corresponde a quien se da de alta a mitad de mes,
 * redondeada a cuartos. Es una PROPUESTA: el importe se puede cambiar antes de
 * cobrar. Solo aplica al primer cobro de un paciente; después la cuota va entera.
 */
export function fraccionDeAlta(fechaAlta: Date | string): number {
  const d = typeof fechaAlta === 'string' ? new Date(fechaAlta + 'T12:00:00') : fechaAlta
  const diasMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  const quedan = diasMes - d.getDate() + 1
  const cuartos = Math.round((quedan / diasMes) * 4)
  return Math.min(1, Math.max(0.25, cuartos / 4))
}

export const LBL_FRACCION: Record<number, string> = {
  1: 'mes completo', 0.75: 'tres cuartos de mes', 0.5: 'media cuota', 0.25: 'un cuarto de mes',
}

/**
 * Línea propuesta para la cuota de un bono.
 *
 * ORDEN: primero el descuento, después la fracción. El descuento es sobre la
 * cuota mensual del paciente, así que quien viene medio mes paga la mitad de SU
 * cuota. Al revés (prorratear y luego restar el descuento entero) le regalaría
 * medio descuento de más, y solo se notaría con los descuentos de importe fijo.
 */
export function lineaDeBono(bono: any, plan: Plan | undefined, fraccion = 1, etiquetaPeriodo?: string): LineaCobro {
  const nombre = plan?.nombre || bono?.tipo || 'Cuota'

  // UN BONO DE SESIONES NO SE FRACCIONA Y NO ES UNA CUOTA.
  //
  // El fraccionamiento existe para quien empieza a mitad de mes y solo va a usar
  // media cuota. Un bono de ocho sesiones son ocho vengas cuando vengas, así que
  // partirlo por la fecha de alta le cobraría la mitad por las ocho.
  //
  // Y el concepto tiene que describir lo que se vende: la factura es el
  // documento donde consta qué se cobró, y "Cuota mensual" ahí sería falso.
  if (esVentaPuntual(bono)) {
    const precio = precioConDescuento(precioFinalPlan(plan), bono)
    const cad = bono?.caduca
      ? ` · válido hasta ${new Date(bono.caduca + 'T12:00:00').toLocaleDateString('es-ES')}`
      : ''
    return {
      concepto: `${nombre} · ${bono.sesiones_totales} sesiones${cad}`,
      bono_id: bono?.id ?? null,
      cantidad: 1,
      total: precio,
      precioBase: precio,
      iva_pct: Number(plan?.iva ?? 21),
    }
  }

  const mensual = precioConDescuento(precioFinalPlan(plan), bono)
  const total = redondear(mensual * fraccion)
  const sufijo = fraccion < 1 ? ` · ${LBL_FRACCION[fraccion] || `${fraccion} de mes`}` : ''
  return {
    concepto: `Cuota mensual · ${nombre}${etiquetaPeriodo ? ` · ${etiquetaPeriodo}` : ''}${sufijo}`,
    bono_id: bono?.id ?? null,
    cantidad: fraccion,
    total,
    precioBase: total,
    iva_pct: Number(plan?.iva ?? 21),
  }
}

/**
 * Diferencia a cobrar al subir de bono a mitad de mes, con el descuento del
 * paciente aplicado a los dos lados. Sobre PVP saldrían 22 € donde en realidad
 * son 19,80: cobrarle de más justo a quien tiene descuento.
 */
export function lineaAmpliacionBono(bono: any, planNuevo: Plan | undefined, planViejo: Plan | undefined, yaCobrado: number): LineaCobro {
  const nuevo = precioConDescuento(precioFinalPlan(planNuevo), bono)
  const dif = redondear(Math.max(0, nuevo - yaCobrado))
  return {
    concepto: `Ampliación de bono · de ${planViejo?.nombre || '—'} a ${planNuevo?.nombre || '—'}`,
    bono_id: bono?.id ?? null,
    cantidad: 1,
    total: dif,
    precioBase: dif,
    iva_pct: Number(planNuevo?.iva ?? 21),
  }
}

export function totalesDe(lineas: LineaCobro[]) {
  return lineas.reduce((acc, l) => {
    const d = desgloseDesdeTotal(l.total, l.iva_pct ?? 21)
    return { base: redondear(acc.base + d.base), cuota: redondear(acc.cuota + d.cuota), total: redondear(acc.total + d.total) }
  }, { base: 0, cuota: 0, total: 0 })
}

// ---------------------------------------------------------------------------
// EMISIÓN
// ---------------------------------------------------------------------------

export type ResultadoCobro =
  | { ok: true; cobroId: string; facturaId: string; serie: string; numero: number }
  | { ok: false; error: string }

/**
 * Cobra y emite factura. Todo o nada.
 *
 * `tipo` decide la serie: completa (F) si el paciente tiene DNI y domicilio,
 * simplificada (S) si no. Se emite completa siempre que se pueda, porque una
 * simplificada no le sirve al paciente para deducirse el gasto y rehacerla
 * después obliga a una rectificativa.
 */
export async function emitirCobro(args: {
  pacienteId: string
  lineas: LineaCobro[]
  formaPago: FormaPago
  fecha?: string
  tipo?: 'completa' | 'simplificada'
  notas?: string
}): Promise<ResultadoCobro> {
  if (!args.lineas.length) return { ok: false, error: 'No hay nada que cobrar.' }
  if (args.lineas.some(l => !(l.total > 0))) {
    return { ok: false, error: 'Hay líneas con importe cero. Quítalas o ponles importe.' }
  }

  const lineas = args.lineas.map((l, i) => {
    const d = desgloseDesdeTotal(l.total, l.iva_pct ?? 21)
    return {
      orden: i,
      // El descuento se nombra en el concepto al emitir, no antes: si se escribiera
      // en el texto según se pulsa, quitarlo obligaría a deshacer la cadena.
      concepto: l.descuento ? `${l.concepto} · ${l.descuento.nombre}` : l.concepto,
      bono_id: l.bono_id ?? null,
      cantidad: l.cantidad ?? 1,
      base: d.base,
      iva_pct: l.iva_pct ?? 21,
      cuota_iva: d.cuota,
      total: d.total,
      exencion: l.exencion ?? null,
    }
  })

  const { data, error } = await supabase.rpc('emitir_cobro', {
    p_paciente_id: args.pacienteId,
    p_fecha: args.fecha ?? new Date().toISOString().split('T')[0],
    p_forma_pago: args.formaPago,
    p_notas: args.notas ?? null,
    p_tipo: args.tipo ?? 'completa',
    p_lineas: lineas,
  })

  if (error) return { ok: false, error: error.message }
  const r = Array.isArray(data) ? data[0] : data
  if (!r?.factura_id) return { ok: false, error: 'El servidor no ha devuelto la factura emitida.' }

  await registrarEvento(args.pacienteId, r.serie, r.numero, lineas)
  return { ok: true, cobroId: r.cobro_id, facturaId: r.factura_id, serie: r.serie, numero: r.numero }
}

/**
 * Rectifica una factura ya emitida. No la borra ni la edita: emite otra en la
 * serie R que la referencia y va en negativo.
 *
 * `lineas` en positivo; la función las invierte. Rectificar entero o solo una
 * parte es cosa de qué líneas se pasen.
 */
export async function emitirRectificativa(args: {
  facturaId: string
  motivo: string
  lineas: LineaCobro[]
}): Promise<ResultadoCobro> {
  if (!args.motivo?.trim()) return { ok: false, error: 'Una rectificativa necesita motivo.' }
  if (!args.lineas.length) return { ok: false, error: 'No hay líneas que rectificar.' }

  const lineas = args.lineas.map((l, i) => {
    const d = desgloseDesdeTotal(l.total, l.iva_pct ?? 21)
    return {
      orden: i,
      concepto: `${l.concepto} · anulación`,
      bono_id: l.bono_id ?? null,
      cantidad: l.cantidad ?? 1,
      base: -d.base,
      iva_pct: l.iva_pct ?? 21,
      cuota_iva: -d.cuota,
      total: -d.total,
      exencion: l.exencion ?? null,
    }
  })

  const { data, error } = await supabase.rpc('emitir_rectificativa', {
    p_factura_id: args.facturaId,
    p_motivo: args.motivo,
    p_lineas: lineas,
  })

  if (error) return { ok: false, error: error.message }
  const r = Array.isArray(data) ? data[0] : data
  if (!r?.factura_id) return { ok: false, error: 'El servidor no ha devuelto la rectificativa.' }
  return { ok: true, cobroId: r.cobro_id, facturaId: r.factura_id, serie: r.serie, numero: r.numero }
}

// El evento va aparte a propósito: si falla, el cobro y la factura ya existen y
// son lo que importa. Perder una línea del historial no puede tirar un cobro.
async function registrarEvento(pacienteId: string, serie: string, numero: number, lineas: any[]) {
  const total = lineas.reduce((a, l) => a + Number(l.total), 0)
  const { error } = await supabase.from('eventos_paciente').insert({
    paciente_id: pacienteId,
    tipo: 'cobro',
    titulo: `Cobro · factura ${serie}/${String(numero).padStart(4, '0')}`,
    descripcion: `${lineas.map(l => l.concepto).join(' · ')} — ${total.toFixed(2)} €`,
    fecha: new Date().toISOString().split('T')[0],
  })
  if (error) console.error('El cobro se emitió pero no se pudo registrar el evento:', error.message)
}

// ---------------------------------------------------------------------------
// CONSULTA
// ---------------------------------------------------------------------------

/** Listado para la gestoría. Mismas columnas que el fichero que ya te envían. */
export async function listadoGestoria(desde: string, hasta: string) {
  const { data, error } = await supabase
    .from('v_listado_gestoria').select('*')
    .gte('fecha', desde).lte('fecha', hasta)
    .order('fecha')
  if (error) return { ok: false as const, error: error.message, filas: [] }
  return { ok: true as const, filas: data || [] }
}

/** Qué bonos están cobrados de verdad. La verdad es el cobro, no `estado_pago`. */
export async function pagoDeBonos(bonoIds: string[]) {
  if (!bonoIds.length) return { ok: true as const, pago: new Map<string, any>() }
  const { data, error } = await supabase.from('v_bonos_pago').select('*').in('bono_id', bonoIds)
  if (error) return { ok: false as const, error: error.message, pago: new Map<string, any>() }
  return { ok: true as const, pago: new Map((data || []).map((r: any) => [r.bono_id, r])) }
}

/**
 * La fecha de la última factura emitida en una serie.
 *
 * Hace falta antes de emitir con fecha atrasada. Una serie de facturas va numerada de
 * forma correlativa, y el orden de los números tiene que acompañar al de las fechas: si la
 * F-24 lleva fecha del 20 y la F-25 del 12, la numeración deja de ser correlativa en el
 * tiempo y eso es un defecto de la serie, no un detalle.
 */
export async function ultimaFechaDeSerie(serie: string): Promise<string | null> {
  const { data } = await supabase.from('facturas')
    .select('fecha_expedicion')
    .eq('serie', serie)
    .order('fecha_expedicion', { ascending: false })
    .limit(1)
  return data?.[0]?.fecha_expedicion ?? null
}
