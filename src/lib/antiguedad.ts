import { hoyISO, desdeISO } from './fechas'

// ---------------------------------------------------------------------------
// CUANTO LLEVA UN OBJETIVO SIN QUE LE PASE NADA
//
// Los ciclos tienen fechas; los objetivos no tenian ninguna a la vista. Uno
// abierto hace ocho meses, sin clases que lo trabajen y sin test pasado, se
// veia igual que uno de ayer: la ficha era un archivo y no una lista de
// trabajo.
//
// "Quieto desde" es la ultima vez que le paso ALGO -se abrio, se resolvio una
// de sus vias, se logro-. Sale de la fila que ya esta cargada, sin una sola
// consulta mas, y por eso puede ordenar la rejilla entera sin coste.
//
// La cuenta fina -cuando se midio y cuantas clases lo tocaron desde entonces-
// vive en `lib/dosis` y solo se calcula al abrir el objetivo.
// ---------------------------------------------------------------------------

const soloFecha = (x: any) => {
  const s = String(x || '')
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}

/** La ultima fecha en la que le paso algo. Null si no se sabe nada. */
export function quietoDesde(o: any): string | null {
  const f: string[] = []
  const a = soloFecha(o?.created_at); if (a) f.push(a)
  const l = soloFecha(o?.fecha_logrado); if (l) f.push(l)
  for (const v of (Array.isArray(o?.vias) ? o.vias : [])) {
    const r = soloFecha(v?.fecha_resuelto); if (r) f.push(r)
  }
  if (f.length === 0) return null
  return f.sort()[f.length - 1]
}

export function diasQuieto(o: any): number | null {
  const d = quietoDesde(o)
  if (d == null) return null
  return Math.round((desdeISO(hoyISO()).getTime() - desdeISO(d).getTime()) / 86400000)
}

/** "hace 8 meses", "hace 3 semanas", "hoy". */
export function hace(iso?: string | null): string {
  if (!iso) return ''
  const d = Math.round((desdeISO(hoyISO()).getTime() - desdeISO(iso).getTime()) / 86400000)
  if (d <= 0) return 'hoy'
  if (d === 1) return 'ayer'
  if (d < 14) return `hace ${d} días`
  if (d < 60) return `hace ${Math.round(d / 7)} semanas`
  const m = Math.round(d / 30)
  if (m < 24) return `hace ${m} mes${m === 1 ? '' : 'es'}`
  return `hace ${Math.floor(m / 12)} años`
}

/**
 * De mas parado a menos. Los que no tienen ninguna fecha van al final: no se
 * sabe que lleven parados, solo que no consta nada.
 */
export function porParado(a: any, b: any): number {
  const x = quietoDesde(a), y = quietoDesde(b)
  if (x == null && y == null) return 0
  if (x == null) return 1
  if (y == null) return -1
  return x < y ? -1 : x > y ? 1 : 0
}
