import { supabase } from './supabase'
import { rangoDeMes } from './fechas'

// ---------------------------------------------------------------------------
// LO QUE SE HA FACTURADO DE VERDAD
//
// Finanzas contaba los ingresos desde `bonos`, y para saber si algo estaba
// cobrado miraba `bonos.estado_pago === 'pagado'`. Ese campo dejó de escribirse
// el día que los cobros pasaron a vivir en su propia tabla: emitir una factura
// crea filas en `cobros` y `facturas` y no toca el bono.
//
// El resultado era que cobrabas a alguien, Cobros lo daba por pagado —esa
// pantalla sí mira los cobros— y Finanzas seguía contándolo como pendiente. Dos
// pantallas con cifras distintas del mismo mes.
//
// LA DISTINCIÓN QUE IMPORTA:
//
//   bonos    → lo que DEBERÍAS cobrar. Sirve para prever y para saber a quién
//              le falta pagar.
//   facturas → lo que HAS facturado. Es lo que va al 303 y lo que verá la
//              gestoría, y no admite duplicados ni olvidos por construcción.
//
// Para el resumen del mes y para Impuestos manda lo segundo.
// ---------------------------------------------------------------------------

export type Factura = {
  id: string
  serie: string
  numero: number
  fecha_expedicion: string
  tipo: string
  base_total: number
  cuota_total: number
  total: number
  cobros?: { forma_pago?: string | null } | null
}

/**
 * Las facturas de un rango de fechas.
 *
 * Las RECTIFICATIVAS vienen incluidas, con sus importes en negativo. No es un
 * descuido: una factura rectificada y su rectificativa suman cero, que es
 * exactamente lo que se ha facturado. Filtrarlas dejaría dentro la original
 * anulada y el mes saldría inflado.
 */
export async function facturasEntre(desde: string, hasta: string) {
  const { data, error } = await supabase.from('facturas')
    .select('id, serie, numero, fecha_expedicion, tipo, base_total, cuota_total, total, cobros(forma_pago)')
    .gte('fecha_expedicion', desde).lte('fecha_expedicion', hasta)
    .order('fecha_expedicion')
  if (error) return { ok: false as const, error: error.message, filas: [] as Factura[] }
  return { ok: true as const, error: null, filas: (data || []) as unknown as Factura[] }
}

/** Todas las del año, para poder repartirlas por trimestres sin cuatro consultas. */
export async function facturasDelAnio(anio: number) {
  return facturasEntre(`${anio}-01-01`, `${anio}-12-31`)
}

export type Resumen = { base: number, iva: number, total: number, n: number }

const VACIO: Resumen = { base: 0, iva: 0, total: 0, n: 0 }

/** Suma base, IVA y total de un puñado de facturas. */
export function sumar(filas: Factura[]): Resumen {
  return (filas || []).reduce((a, f) => ({
    base:  a.base  + Number(f.base_total  || 0),
    iva:   a.iva   + Number(f.cuota_total || 0),
    total: a.total + Number(f.total       || 0),
    n:     a.n + 1,
  }), { ...VACIO })
}

/** Lo facturado en un mes concreto. `mes` va de 1 a 12. */
export function delMes(filas: Factura[], anio: number, mes: number): Resumen {
  const { desde, hasta } = rangoDeMes(anio, mes)
  return sumar(filas.filter(f => f.fecha_expedicion >= desde && f.fecha_expedicion <= hasta))
}

/** Lo facturado en un trimestre. `t` va de 1 a 4. */
export function delTrimestre(filas: Factura[], anio: number, t: number): Resumen {
  const desde = `${anio}-${String((t - 1) * 3 + 1).padStart(2, '0')}-01`
  const { hasta } = rangoDeMes(anio, t * 3)
  return sumar(filas.filter(f => f.fecha_expedicion >= desde && f.fecha_expedicion <= hasta))
}

/**
 * Cuánto entró por cada vía de pago. Para cuadrar el cajón y el extracto del TPV.
 *
 * Las rectificativas restan de su propia vía: si devolviste 66 € en efectivo, en
 * el cajón hay 66 € menos.
 */
export function porFormaDePago(filas: Factura[]) {
  const ORDEN = ['efectivo', 'tarjeta', 'transferencia', 'domiciliacion', 'otro']
  const m = new Map<string, Resumen>()
  filas.forEach(f => {
    const forma = f.cobros?.forma_pago || 'otro'
    const a = m.get(forma) || { ...VACIO }
    a.base += Number(f.base_total || 0)
    a.iva += Number(f.cuota_total || 0)
    a.total += Number(f.total || 0)
    a.n += 1
    m.set(forma, a)
  })
  return ORDEN.filter(k => m.has(k)).map(k => ({ forma: k, ...m.get(k)! }))
}
