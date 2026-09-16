import type { Factura } from './facturado'

// ---------------------------------------------------------------------------
// LO QUE HAY QUE APARTAR PARA HACIENDA
//
// El cálculo vivía dentro de ImpuestosTab. Al querer enseñarlo también en el
// Resumen, la salida fácil era copiarlo; y una fórmula copiada es una fórmula
// que mañana se arregla en un sitio y no en el otro. Ya pasó con el IVA
// soportado y con el beneficio: dos pantallas diciendo cosas distintas del
// mismo mes.
//
// Vive aquí y la llaman los dos. Funciona por rango de fechas, así que sirve
// igual para un mes que para un trimestre.
// ---------------------------------------------------------------------------

export type Impuestos = {
  ivaRepercutido: number
  ivaSoportado: number
  modelo303: number
  baseIngresos: number
  baseGastos: number
  beneficio: number
  modelo130: number
  modelo111: number
  modelo115: number
  total: number
  sinBase: number
}

const dentro = (fecha: string | null | undefined, desde: string, hasta: string) =>
  !!fecha && fecha >= desde && fecha <= hasta

export function calcularImpuestos(args: {
  facturas?: Factura[]
  ingresos?: any[]
  gastos?: any[]
  bonos?: any[]
  precioBono?: (b: any) => number
  desde: string
  hasta: string
  irpfPct?: number
  /**
   * PREVISTO vs REAL.
   *
   * Real: solo lo que existe en papel —facturas emitidas y gastos confirmados—.
   * Es lo que declararías si el periodo cerrase hoy.
   *
   * Previsto: añade las cuotas aún sin facturar y los gastos estimados. Sirve
   * para ir apartando dinero, no para declarar.
   */
  previsto?: boolean
}): Impuestos {
  const { desde, hasta, irpfPct = 20, previsto = false } = args
  const facturas = args.facturas || []
  const ingresos = args.ingresos || []
  const gastos = args.gastos || []

  const fact = facturas.filter(f => dentro(f.fecha_expedicion, desde, hasta))
  let ivaRepercutido = fact.reduce((a, f) => a + Number(f.cuota_total || 0), 0)
  let baseIngresos = fact.reduce((a, f) => a + Number(f.base_total || 0), 0)

  const otros = ingresos.filter(i => dentro(i.fecha, desde, hasta))
  baseIngresos += otros.reduce((a, i) => a + Number(i.base_imponible || 0), 0)
  ivaRepercutido += otros.reduce((a, i) => a + (Number(i.importe || 0) - Number(i.base_imponible || 0)), 0)

  // En previsto se añaden las cuotas del periodo que todavía no se han
  // facturado: son ingreso seguro y su IVA habrá que ingresarlo igual.
  if (previsto && args.bonos && args.precioBono) {
    const totalCuotas = args.bonos.reduce((a: number, b: any) => a + args.precioBono!(b), 0)
    const pendienteFacturar = Math.max(0, totalCuotas - fact.reduce((a, f) => a + Number(f.total || 0), 0))
    if (pendienteFacturar > 0) {
      // Las cuotas llevan el IVA dentro del precio. Se separa al tipo general.
      const basePend = pendienteFacturar / 1.21
      baseIngresos += basePend
      ivaRepercutido += pendienteFacturar - basePend
    }
  }

  const gastosP = gastos.filter(g => dentro(g.fecha, desde, hasta) && (previsto || !g.estimado))

  // Desde la base, nunca restando del total: con retención el total ya lleva
  // el IRPF descontado y el IVA salía por los suelos.
  const ivaSoportado = gastosP.reduce((a, g) => a + Number(g.base_imponible || 0) * (Number(g.iva_pct || 0) / 100), 0)
  const baseGastos = gastosP.reduce((a, g) => a + Number(g.base_imponible ?? g.importe ?? 0), 0)
  const sinBase = gastosP.filter(g => g.base_imponible == null && Number(g.iva_pct || 0) > 0).length

  const modelo303 = ivaRepercutido - ivaSoportado
  const beneficio = baseIngresos - baseGastos
  const modelo130 = Math.max(0, beneficio * (irpfPct / 100))

  const retenciones = (modelo: string) =>
    gastosP.filter(g => g.irpf_modelo === modelo && Number(g.irpf_pct || 0) > 0)
      .reduce((a, g) => a + Number(g.base_imponible || 0) * (Number(g.irpf_pct) / 100), 0)

  // Las nóminas retienen un importe del papel, no un porcentaje sobre base.
  const modelo111 = retenciones('111')
    + gastosP.filter(g => g.clase === 'nomina').reduce((a, g) => a + Number(g.irpf_retenido || 0), 0)
  const modelo115 = retenciones('115')

  return {
    ivaRepercutido, ivaSoportado, modelo303, baseIngresos, baseGastos,
    beneficio, modelo130, modelo111, modelo115,
    total: modelo303 + modelo130 + modelo111 + modelo115,
    sinBase,
  }
}

/** Primer y último día del trimestre al que pertenece un mes 'YYYY-MM'. */
export function rangoTrimestre(mesISO: string) {
  const [anio, mes] = mesISO.split('-').map(Number)
  const t = Math.ceil(mes / 3)
  const ini = (t - 1) * 3 + 1
  const fin = ini + 2
  const ultimo = new Date(anio, fin, 0).getDate()
  return {
    t,
    desde: `${anio}-${String(ini).padStart(2, '0')}-01`,
    hasta: `${anio}-${String(fin).padStart(2, '0')}-${ultimo}`,
  }
}

/** Primer y último día de un mes 'YYYY-MM'. */
export function rangoMes(mesISO: string) {
  const [anio, mes] = mesISO.split('-').map(Number)
  const ultimo = new Date(anio, mes, 0).getDate()
  return { desde: `${mesISO}-01`, hasta: `${mesISO}-${String(ultimo).padStart(2, '0')}` }
}
