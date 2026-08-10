import { supabase } from './supabase'
import { redondear } from './bonos'

// ---------------------------------------------------------------------------
// PREVISIÓN DE INGRESOS
//
// Dos fuentes y cada una contesta a lo que sabe:
//
//   Los BONOS saben el futuro.  Son cuotas recurrentes: las activas de hoy
//   dicen lo que va a entrar los meses que vienen si nadie se mueve.
//
//   Las FACTURAS saben el pasado. Lo emitido de verdad, cuadrado al céntimo.
//
// Antes los bonos intentaban hacer las dos cosas, y de ahí venían los
// duplicados y los desajustes con la gestoría.
//
// TODO VA EN BASE IMPONIBLE, nunca en total facturado. El IVA no es ingreso: es
// dinero que recaudas para Hacienda. Mezclarlo hace que subir de exento al 21%
// parezca un crecimiento cuando es justo lo contrario.
// ---------------------------------------------------------------------------

/**
 * Ingresos históricos de la clínica, en BASE IMPONIBLE y por mes.
 *
 * Hasta 2025 la actividad estaba EXENTA de IVA (la prestaban fisioterapeutas
 * titulados), así que lo cobrado y la base son lo mismo. Desde 2026 la
 * actividad va al 21% y hay que comparar base contra base: si no, el cambio de
 * régimen fiscal se lee como crecimiento.
 *
 * No entran 2020-2022: entonces no era la clínica, era trabajo por cuenta
 * propia en otro sitio, con un volumen que no tiene nada que ver.
 * Tampoco entra "Bilates", que se lleva aparte.
 *
 * Se retira en cuanto haya dos años de facturas propias en la app: entonces el
 * índice sale de `facturas` y este bloque sobra.
 */
export const HISTORICO_BASE: Record<number, Record<number, number>> = {
  2023: { 1:3820, 2:4590, 3:5450, 4:4991, 5:5390, 6:4710, 7:3800, 8:1170, 9:4970, 10:5850, 11:6215, 12:6633 },
  2024: { 1:6014, 2:6424, 3:6656, 4:6160, 5:6472, 6:5945, 7:5605, 8:3320, 9:6235, 10:7625, 11:8470, 12:8045 },
  2025: { 1:9038, 2:7797, 3:7195, 4:7376, 5:7506, 6:6830, 7:5562, 8:5165, 9:8317, 10:8237, 11:8145, 12:6778 },
}

/** Años en los que la actividad estaba exenta. Solo para poder decirlo en pantalla. */
export const ANIOS_EXENTOS = [2023, 2024, 2025]

export const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
export const MESES_CORTO = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export type IndiceMes = { mes: number, indice: number, porAnio: { anio: number, valor: number }[] }

/**
 * Índice de estacionalidad: cuánto vale cada mes respecto al mes medio del año.
 *
 * Promedio de los tres años, no solo del último. 2025 es el año más parecido al
 * modelo de hoy, pero su diciembre flojo puede ser un año raro y con tres se
 * reparte el error. El desglose por año va incluido para poder enseñarlo: una
 * previsión que no deja ver de dónde sale cada número no se la cree nadie.
 */
export function indiceEstacional(historico = HISTORICO_BASE): IndiceMes[] {
  const anios = Object.keys(historico).map(Number)
  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    const porAnio = anios
      .filter(a => historico[a]?.[mes] != null)
      .map(a => {
        const meses = Object.values(historico[a])
        const media = meses.reduce((x, y) => x + y, 0) / meses.length
        return { anio: a, valor: redondear(historico[a][mes] / media) }
      })
    const indice = porAnio.length
      ? porAnio.reduce((x, y) => x + y.valor, 0) / porAnio.length
      : 1
    return { mes, indice: redondear(indice), porAnio }
  })
}

/**
 * Nivel base del año: cuánto se ingresaría en un mes medio, corregido de
 * estacionalidad. Sale de los últimos meses ya facturados, no de la media del
 * año entero: si el negocio crece, la media arrastra hacia abajo.
 */
export function nivelBase(realPorMes: Record<number, number>, idx: IndiceMes[], ultimos = 3) {
  const meses = Object.keys(realPorMes).map(Number).sort((a, b) => b - a).slice(0, ultimos)
  if (!meses.length) return 0
  const suma = meses.reduce((acc, m) => acc + realPorMes[m] / (idx[m - 1]?.indice || 1), 0)
  return redondear(suma / meses.length)
}

export type FilaPrevision = {
  mes: number
  real: number | null
  previsto: number
  desvio: number | null
  acumulado: number
}

export function proyectar(realPorMes: Record<number, number>, idx: IndiceMes[]): FilaPrevision[] {
  const nivel = nivelBase(realPorMes, idx)
  let acc = 0
  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    const previsto = redondear(nivel * (idx[i]?.indice || 1))
    const real = realPorMes[mes] ?? null
    acc = redondear(acc + (real ?? previsto))
    return {
      mes, real, previsto,
      desvio: real != null && previsto > 0 ? redondear((real / previsto - 1) * 100) : null,
      acumulado: acc,
    }
  })
}

// ---------------------------------------------------------------------------
// DATOS
// ---------------------------------------------------------------------------

/**
 * Lo facturado por mes del año, en BASE IMPONIBLE.
 *
 * Las rectificativas van en negativo dentro de `base_total`, así que restan
 * solas y no hay que tratarlas aparte.
 */
export async function facturadoPorMes(anio: number) {
  const { data, error } = await supabase.from('facturas')
    .select('fecha_expedicion, base_total, cuota_total')
    .gte('fecha_expedicion', `${anio}-01-01`).lte('fecha_expedicion', `${anio}-12-31`)
  if (error) return { ok: false as const, error: error.message, base: {}, iva: {} }

  const base: Record<number, number> = {}
  const iva: Record<number, number> = {}
  for (const f of data || []) {
    const m = Number(String(f.fecha_expedicion).slice(5, 7))
    base[m] = redondear((base[m] || 0) + Number(f.base_total))
    iva[m]  = redondear((iva[m]  || 0) + Number(f.cuota_total))
  }
  return { ok: true as const, error: null, base, iva }
}

/**
 * Lo que entra al mes si nadie se mueve: las cuotas activas a su precio, en base
 * imponible. Es el suelo de la previsión cuando todavía no hay meses facturados.
 */
export function nivelDesdeBonos(bonos: any[], precioBono: (b: any) => number, ivaPct = 21) {
  const total = bonos.filter(b => b.activo).reduce((a, b) => a + precioBono(b), 0)
  return redondear(ivaPct > 0 ? total / (1 + ivaPct / 100) : total)
}

/** Lo que habría que cobrar para ingresar lo mismo que cuando estaba exento. */
export function precioNeutro(precioActual: number, ivaPct = 21) {
  return redondear(precioActual * (1 + ivaPct / 100))
}
