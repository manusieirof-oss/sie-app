// ---------------------------------------------------------------------------
// FECHAS EN TEXTO 'YYYY-MM-DD'
//
// Único sitio donde se convierte una fecha del calendario a la cadena que
// guarda la base. Existe por un fallo concreto y difícil de ver:
//
//   new Date(2026, 8, 0).toISOString().split('T')[0]  →  '2026-08-30'
//
// Eso pretendía ser "el último día de agosto" y devuelve el 30. `toISOString`
// convierte a UTC, y en horario de verano español la medianoche del 31 son las
// 22:00 del 30. El resultado: la lista de facturas preguntaba hasta el día 30 y
// una factura emitida el 31 no salía por ningún lado.
//
// El mismo patrón, aplicado a `new Date()`, falla entre las 00:00 y las 02:00:
// a esa hora te da la fecha de ayer. Está usado unas sesenta veces en la app.
//
// La regla: para una fecha del calendario NUNCA se pasa por UTC. Se leen el
// año, el mes y el día tal cual los tiene el reloj de quien la está mirando.
// ---------------------------------------------------------------------------

/** Una fecha del calendario como 'YYYY-MM-DD', sin pasar por UTC. */
export function aISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Hoy. Sustituye a `new Date().toISOString().split('T')[0]`. */
export const hoyISO = () => aISO(new Date())

/**
 * El mes de hoy, 'YYYY-MM'.
 *
 * `new Date().toISOString().slice(0,7)` devuelve el mes ANTERIOR el día 1 entre
 * las 00:00 y las 02:00. Estrecho, pero es justo el rato en que se abre la app
 * el primer día del mes para ver cómo va.
 */
export const mesISO = () => hoyISO().slice(0, 7)

/** Primer día del mes, 'YYYY-MM-DD'. `mes` va de 1 a 12. */
export const inicioDeMes = (anio: number, mes: number) =>
  `${anio}-${String(mes).padStart(2, '0')}-01`

/**
 * Último día del mes, 'YYYY-MM-DD'. `mes` va de 1 a 12.
 *
 * `new Date(anio, mes, 0)` es el truco de siempre para el último día: el día
 * cero del mes siguiente. Lo que no se puede hacer después es sacarlo por UTC.
 */
export const finDeMes = (anio: number, mes: number) =>
  aISO(new Date(anio, mes, 0))

/** Los dos extremos del mes, que casi siempre se piden juntos. */
export const rangoDeMes = (anio: number, mes: number) =>
  ({ desde: inicioDeMes(anio, mes), hasta: finDeMes(anio, mes) })

/** Suma días a una fecha 'YYYY-MM-DD' y devuelve otra 'YYYY-MM-DD'. */
export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  return aISO(new Date(a, m - 1, d + dias))
}

/**
 * Convierte 'YYYY-MM-DD' a Date al MEDIODÍA local.
 *
 * A las 12:00 y no a las 00:00 porque a mediodía ningún cambio de horario ni
 * desfase de zona la mueve de día. `new Date('2026-08-31')` se interpreta como
 * UTC y en España se ve como el 30 a las 22:00.
 */
export const desdeISO = (iso: string) => new Date(iso + 'T12:00:00')
