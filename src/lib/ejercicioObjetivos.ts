import { ES_UUID } from './objetivos'

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
): string[] {
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
): string[] {
  const ids = (objetivosSesion || []).map((o: any) => o?.id)
  if (ej?.objetivos_manual && Array.isArray(ej.objetivos)) return ej.objetivos.filter((id: string) => ids.includes(id))
  return sugerirObjetivos(etiquetasEj, objetivosSesion, movsSel)
}
