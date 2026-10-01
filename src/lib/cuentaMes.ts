// ---------------------------------------------------------------------------
// LO QUE SE HA COBRADO DE UN MES, BONO A BONO.
//
// El resumen de Finanzas calculaba el pendiente restando dos totales: lo que tocaba
// cobrar (los bonos del mes) menos lo facturado en el mes. Parece lo mismo y no lo es,
// porque la fecha de la factura no es el mes de la cuota:
//
//   · La cuota de septiembre cobrada el 31 de agosto tiene factura de agosto. Septiembre
//     no la veia y la contaba como pendiente: en septiembre de 2026 eran 450 EUR de
//     gente que ya habia pagado.
//   · Al reves, lo facturado en septiembre que no es cuota de septiembre (valoraciones,
//     la cuota de octubre adelantada) se restaba del pendiente de otros y lo tapaba.
//
// Con el boton de adelantar cobros esto pasa todos los meses, asi que ya no vale como
// aproximacion. Ahora cada bono mira SU cobro, sea de la fecha que sea: el mes cuenta
// lo que le pertenece aunque se cobrase antes.
//
// Esto NO sustituye a lo facturado por fecha. Hacienda va por fecha de expedicion y el
// IVA, el 130 y el beneficio fiscal siguen saliendo de `facturas` (ver lib/facturado).
// ---------------------------------------------------------------------------

/** Lo cobrado de cada bono, neto de rectificativas (v_bonos_pago). */
export type PagoBono = { neto: number, fecha: string | null }

export type CuentaMes = {
  previsto: number
  cobrado: number
  pendiente: number
  impago: number
  /** Cuotas de este mes que se cobraron en un mes anterior. Ya estan dentro de `cobrado`. */
  adelantado: number
  /** Lo facturado este mes sin bono: valoraciones, sesiones sueltas. Dentro de previsto y cobrado. */
  sueltas: number
}

export function cuentaDelMes({ bonos, precioBono, pagos, sueltas, otros, clave, antesDeLaApp = false }: {
  bonos: any[]
  precioBono: (b: any) => number
  pagos: Record<string, PagoBono>
  /** Lineas facturadas sin bono, con la fecha de su factura. */
  sueltas: { fecha: string, total: number }[]
  /** Otros ingresos del mes (charlas, alquiler de sala...): ya cobrados. */
  otros: number
  /** 'YYYY-MM' */
  clave: string
  /** Mes anterior a cobrar con la app: lo que no tiene cobro aqui se cobro fuera. Ver lib/bonos `cobrosDesde`. */
  antesDeLaApp?: boolean
}): CuentaMes {
  let previsto = 0, cobrado = 0, pendiente = 0, impago = 0, adelantado = 0
  const inicioMes = `${clave}-01`
  for (const b of bonos) {
    const precio = precioBono(b)
    const p = b.id ? pagos[b.id] : undefined
    const neto = Number(p?.neto || 0)
    if (neto > 0) {
      // Pagado: cuenta lo que se cobro de verdad, no el precio del plan. Si al cobrar
      // se hizo un descuento que no estaba en el bono, el precio dejaria una diferencia
      // pendiente para siempre que nadie debe.
      previsto += neto
      cobrado += neto
      if (p?.fecha && p.fecha < inicioMes) adelantado += neto
    } else if (antesDeLaApp) {
      previsto += precio
      cobrado += precio
    } else {
      previsto += precio
      pendiente += precio
      // Impago es un juicio tuyo sobre lo que no se ha cobrado. Si se acabo cobrando,
      // deja de serlo aunque la marca siga en el bono: la ficha ya lo trataba asi.
      if (b.estado_pago === 'impago') impago += precio
    }
  }
  const sueltasMes = sueltas.filter(s => s.fecha?.slice(0, 7) === clave).reduce((a, s) => a + Number(s.total || 0), 0)
  // Lo suelto y los otros ingresos ya estan cobrados: suman a los dos lados, o el
  // porcentaje cobrado del mes se hundiria por dinero que si esta en el banco.
  previsto += sueltasMes + otros
  cobrado += sueltasMes + otros
  return { previsto, cobrado, pendiente, impago, adelantado, sueltas: sueltasMes }
}
