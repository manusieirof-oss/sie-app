import { ES_UUID } from './objetivos'
import { conDescendientes, categoriaDe } from './etiquetas'
import { CONFIG_DEFECTO } from './trabajo'

/**
 * QUÉ OBJETIVO TRABAJA CADA EJERCICIO DE UNA SESIÓN.
 *
 * Antes el objetivo colgaba solo de la sesión entera: "esta sesión trabaja movilidad de
 * tobillo", pero no se veía con qué ejercicio. Para que el objetivo tenga credibilidad
 * mientras se trabaja hace falta la relación directa ejercicio → objetivo.
 *
 * Se guarda DENTRO de la sesión (`partes[].ejercicios[].objetivos`), no en la biblioteca:
 * el mismo ejercicio sirve para objetivos distintos según el paciente. La biblioteca solo
 * sugiere, cruzando etiquetas del árbol.
 *
 * `objetivos_manual` = alguien lo tocó a mano. Mientras no, la sugerencia se recalcula
 * cada vez (si se añade un objetivo a la sesión, sus ejercicios se enganchan solos).
 */

/**
 * Los objetivos de la sesión que, por etiquetas, trabaja un ejercicio.
 *
 *  1. Si la sesión dice qué específico trabaja de ese objetivo (`movsSel`), manda eso.
 *  2. Si no, los específicos del objetivo que sean etiquetas del árbol.
 *  3. Si no tiene ninguno, su articulación y sus etiquetas.
 *
 * Basta con que el ejercicio tenga UNA de esas etiquetas. Los específicos escritos a
 * mano (frases) no pueden coincidir con nada: esos se enganchan a mano.
 */
export function sugerirObjetivos(
  etiquetasEj: string[], objetivosSesion: any[], movsSel: Record<string, string[]> = {},
  /** Con el ejercicio de la biblioteca y las etiquetas: CRUCE ESTRICTO (ver `cruceObjetivo`). */
  estricto?: { ej: any, etiquetas: any[] },
): string[] {
  if (estricto?.ej && estricto.etiquetas?.length)
    return (objetivosSesion || []).filter((o: any) => o?.id && cruceObjetivo(estricto.ej, o, estricto.etiquetas, movsSel[o.id]) === 'si').map((o: any) => o.id)
  const del = new Set((etiquetasEj || []).filter(Boolean))
  if (del.size === 0) return []
  const out: string[] = []
  for (const o of objetivosSesion || []) {
    if (!o?.id) continue
    const deSesion = (movsSel[o.id] || []).filter((x: string) => ES_UUID.test(String(x)))
    const especificos = (Array.isArray(o.movimientos) ? o.movimientos : []).filter((x: any) => ES_UUID.test(String(x)))
    const generales = [o.articulacion_id, ...(Array.isArray(o.etiquetas) ? o.etiquetas : [])].filter(Boolean)
    const claves = deSesion.length > 0 ? deSesion : especificos.length > 0 ? especificos : generales
    if (claves.some((k: string) => del.has(k))) out.push(o.id)
  }
  return out
}

/** Los objetivos de un ejercicio: lo puesto a mano, o si no, la sugerencia. */
export function objetivosDeEjercicio(
  ej: any, etiquetasEj: string[], objetivosSesion: any[], movsSel: Record<string, string[]> = {},
  estricto?: { ej: any, etiquetas: any[] },
): string[] {
  const ids = (objetivosSesion || []).map((o: any) => o?.id)
  if (ej?.objetivos_manual && Array.isArray(ej.objetivos)) return ej.objetivos.filter((id: string) => ids.includes(id))
  return sugerirObjetivos(etiquetasEj, objetivosSesion, movsSel, estricto)
}

// ---------------------------------------------------------------------------
// CRUCE ESTRICTO: DOS COMPROBACIONES
//
// Antes bastaba UNA etiqueta en comun: un ejercicio de movilidad de hombro contaba
// para "Fuerza de hombro" por llevar los dos "Hombro". Ahora:
//   1. QUE MUEVE: su anatomia (articulacion + movimiento) tiene lo que pide el objetivo.
//   2. PARA QUE SIRVE: lo que el objetivo BUSCA (fuerza, movilidad…) esta en lo que el
//      ejercicio ADMITE.
//   · Las dos → 'si' (se engancha solo).  · Una → 'sugerido' (a confirmar).  · Ninguna → 'no'.
// Lo que falte por rellenar (ejercicio sin anatomia, objetivo sin "busca") no suspende:
// se usa lo de antes (etiquetas) o se da por bueno, para no esconder nada por un hueco.
// ---------------------------------------------------------------------------
export const FAMILIAS_BUSCA: [string, string][] = [
  ['fuerza', 'Fuerza'], ['potencia', 'Potencia'], ['movilidad', 'Movilidad'], ['estiramiento', 'Estiramiento'],
  ['equilibrio', 'Equilibrio'], ['control', 'Control motor'], ['respiracion', 'Respiración'], ['liberacion', 'Liberación'],
]
const nrm = (t: string) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
/** Lo que busca un objetivo: lo guardado o, si no, lo que dice su nombre. */
export function buscaDe(o: any): string[] {
  if (Array.isArray(o?.busca) && o.busca.length) return o.busca
  const n = nrm(o?.nombre || '')
  const out: string[] = []
  if (/fuerza|fortalec|potenciar|tonific|resistencia/.test(n)) out.push('fuerza')
  if (/potencia|explosiv|salto/.test(n)) out.push('potencia')
  if (/movilidad|rango|flexibilidad|amplitud/.test(n)) out.push('movilidad')
  if (/estira|elastic|acortamiento|tension/.test(n)) out.push('estiramiento')
  if (/equilibrio|propiocep|estabilidad/.test(n)) out.push('equilibrio')
  if (/control|activ|postur|conciencia|coordinac|patron|aprender/.test(n)) out.push('control')
  if (/respira/.test(n)) out.push('respiracion')
  return out
}
const FAM: Record<string, string> = Object.fromEntries(CONFIG_DEFECTO.intensidades.map(i => [i.id, i.familia]))

export function cruceObjetivo(ej: any, o: any, etiquetas: any[], movsSesion?: string[]): 'si' | 'sugerido' | 'no' {
  const acc: any[] = Array.isArray(ej?.anatomia?.acc) ? ej.anatomia.acc : []
  const mus: any[] = Array.isArray(ej?.anatomia?.mus) ? ej.anatomia.mus : []
  const tags = new Set<string>([...(ej?.etiquetas || []), ...acc.map(x => x.a), ...acc.map(x => x.m), ...mus.map(x => x.u)].filter(Boolean))
  const rama = (id: string) => new Set(conDescendientes(etiquetas, id))
  const casa = (id: string, otro: string) => !!id && !!otro && (id === otro || rama(id).has(otro) || rama(otro).has(id))

  // 1) QUE MUEVE
  const espec = (movsSesion && movsSesion.length ? movsSesion : (Array.isArray(o?.movimientos) ? o.movimientos : [])).filter((x: any) => ES_UUID.test(String(x)))
  const movs = espec.filter((id: string) => categoriaDe(etiquetas, etiquetas.find((e: any) => e.id === id)) === 'movimiento')
  const otros = espec.filter((id: string) => !movs.includes(id))
  const art = o?.articulacion_id || ''
  let anat: boolean
  if (!acc.length) {
    // Sin anatomia: como antes, por etiquetas.
    const claves = espec.length ? espec : [art, ...(o?.etiquetas || [])].filter(Boolean)
    anat = claves.some((k: string) => tags.has(k))
  } else if (movs.length) {
    anat = acc.some(x => movs.some((m: string) => casa(m, x.m)) && (!art || casa(art, x.a))) || otros.some((k: string) => tags.has(k))
  } else if (otros.length) {
    anat = otros.some((k: string) => Array.from(tags).some(t => casa(k, t)))
  } else if (art) {
    anat = acc.some(x => casa(art, x.a))
  } else {
    anat = (o?.etiquetas || []).some((k: string) => tags.has(k))
  }

  // 2) PARA QUE SIRVE
  const busca = buscaDe(o)
  const admite: string[] = Array.isArray(ej?.trabajo?.int) ? ej.trabajo.int.map((id: string) => FAM[id]).filter(Boolean) : []
  const sinDato = !busca.length || !admite.length
  const cap = !sinDato && busca.some(b => admite.includes(b))

  if (anat) return cap || sinDato ? 'si' : 'sugerido'
  // No mueve lo que pide, pero sirve para lo que busca y comparte alguna etiqueta (la de
  // antes): se sugiere. Sin esa pista no, o saldria cualquier ejercicio de fuerza.
  const pista = [art, ...espec, ...(o?.etiquetas || [])].filter(Boolean).some((k: string) => tags.has(k))
  return cap && pista ? 'sugerido' : 'no'
}
