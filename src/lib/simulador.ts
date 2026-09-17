// ---------------------------------------------------------------------------
// PROBAR ANTES DE DECIDIR
//
// No guarda nada ni toca la base de datos: coge tus cifras reales y responde
// "¿y si...?". Contratar, comprar una máquina, subir precios.
//
// Las cuentas viven aquí y no en la pantalla por lo de siempre: si mañana
// cambia el tipo de la Seguridad Social, se cambia en un sitio.
// ---------------------------------------------------------------------------

/**
 * Lo que cuesta de verdad un trabajador.
 *
 * El bruto no es el coste: encima va la Seguridad Social de empresa, que ronda
 * un tercio más. Contratar a alguien por 1.200 € cuesta unos 1.600 €.
 *
 * El tipo es aproximado —depende del contrato, del grupo de cotización y de las
 * bonificaciones— así que se deja tocar. El 32% es el orden de magnitud normal.
 */
export const SS_EMPRESA_PCT = 32

export function costeTrabajador(brutoMensual: number, ssPct = SS_EMPRESA_PCT, pagas = 12) {
  const brutoAnual = brutoMensual * pagas
  const brutoMes = brutoAnual / 12          // prorrateado, que es como pesa en el mes
  const ss = brutoMes * (ssPct / 100)
  return { brutoMes, ss, coste: brutoMes + ss, costeAnual: (brutoMes + ss) * 12 }
}

export type ModoCompra = 'contado' | 'financiado' | 'renting' | 'leasing'

/**
 * Lo que cuesta una máquina según cómo la pagues.
 *
 *   contado / financiado → la compras: el IVA te lo deduces de una vez y el
 *                          bien se amortiza en varios años.
 *   renting              → es un alquiler: la cuota entera es gasto y el IVA
 *                          se deduce mes a mes. No es tuya al acabar.
 *   leasing              → alquiler con opción de compra: cuota deducible, y al
 *                          final decides si la compras por el valor residual.
 *
 * La diferencia importa: en compra descuentas 5.000 € de golpe del bolsillo
 * pero solo una parte es gasto del año; en renting no sale nada de golpe pero
 * todo es gasto.
 */
export function costeCompra(args: {
  precioSinIva: number
  ivaPct?: number
  modo: ModoCompra
  meses?: number
  interesPct?: number
  anosAmortizacion?: number
  valorResidual?: number
}) {
  const { precioSinIva, ivaPct = 21, modo, meses = 48, interesPct = 0,
          anosAmortizacion = 5, valorResidual = 0 } = args
  const iva = precioSinIva * (ivaPct / 100)
  const total = precioSinIva + iva

  if (modo === 'contado') {
    return {
      desembolsoInicial: total,
      cuotaMes: 0,
      ivaRecuperable: iva,
      gastoDeducibleMes: precioSinIva / (anosAmortizacion * 12),
      nota: `Se amortiza en ${anosAmortizacion} años: cada mes te deduces solo una parte.`,
    }
  }
  if (modo === 'financiado') {
    const i = interesPct / 100 / 12
    const cuota = i > 0
      ? (total * i) / (1 - Math.pow(1 + i, -meses))
      : total / meses
    const intereses = cuota * meses - total
    return {
      desembolsoInicial: 0,
      cuotaMes: cuota,
      ivaRecuperable: iva,
      gastoDeducibleMes: precioSinIva / (anosAmortizacion * 12) + intereses / meses,
      nota: `La cuota no es gasto: lo son la amortización y los intereses (${intereses.toFixed(0)} € en total).`,
    }
  }
  const base = (precioSinIva - valorResidual) / meses
  return {
    desembolsoInicial: 0,
    cuotaMes: base * (1 + ivaPct / 100),
    ivaRecuperable: base * (ivaPct / 100) * meses,
    gastoDeducibleMes: base,
    nota: modo === 'renting'
      ? 'Cuota entera deducible. Al acabar no es tuya.'
      : `Cuota deducible. Al acabar puedes comprarla por ${valorResidual.toFixed(0)} €.`,
  }
}

/**
 * Qué pasa si subes los precios.
 *
 * Subir un 5% no da un 5% más: alguien se va. La pregunta útil no es cuánto
 * ganarías, es cuántas bajas aguantas antes de estar peor que ahora.
 */
export function simularSubida(args: {
  ingresoActual: number
  nClientes: number
  subidaPct: number
  bajasEsperadas: number
}) {
  const { ingresoActual, nClientes, subidaPct, bajasEsperadas } = args
  if (nClientes <= 0) return { nuevo: 0, diferencia: 0, bajasLimite: 0, quedan: 0, nuevoPrecio: 0, porCliente: 0 }
  const porCliente = ingresoActual / nClientes
  const nuevoPrecio = porCliente * (1 + subidaPct / 100)
  const quedan = Math.max(0, nClientes - bajasEsperadas)
  const nuevo = quedan * nuevoPrecio
  const bajasLimite = nuevoPrecio > 0
    ? Math.floor(nClientes - ingresoActual / nuevoPrecio)
    : 0
  return { nuevo, diferencia: nuevo - ingresoActual, bajasLimite, quedan, nuevoPrecio, porCliente }
}
