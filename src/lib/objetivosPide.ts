import { supabase } from './supabase'

/**
 * Lo que PIDE la gente: el catálogo de objetivos en palabras del paciente.
 *
 * No hay tabla. El catálogo es la lista de textos distintos que ya se han escrito en las
 * valoraciones, y se calcula al vuelo. Una tabla aparte habría que mantenerla al día cada
 * vez que alguien escribe algo nuevo, y a la semana diría cosas que ya nadie pide.
 *
 * ESTO NO ES EL OBJETIVO CLÍNICO. "Quiero volver a correr" es un deseo; "Movilidad de
 * tobillo · dorsiflexión" es un hallazgo que se mide. Viven separados a propósito.
 *
 * Lo que hace que converjan es que al escribir se sugiera lo ya dicho por otros: con texto
 * libre y sin sugerencias, "bajar de peso" y "perder peso" no se juntan jamás.
 */

export type ObjetivoPedido = {
  texto: string
  /** Cuánta gente lo ha pedido. Ordena las sugerencias: lo más pedido, primero. */
  veces: number
}

/** Para comparar: sin mayúsculas, sin tildes y sin espacios de sobra. */
export const normalizar = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/**
 * El catálogo, ordenado de más pedido a menos.
 *
 * Se agrupa por el texto normalizado pero se DEVUELVE el más frecuente tal cual se
 * escribió: si nueve personas pusieron "Bajar de peso" y una "bajar de peso", la
 * sugerencia sale con la mayúscula que usa casi todo el mundo.
 */
export async function catalogoDeObjetivos(): Promise<ObjetivoPedido[]> {
  const { data, error } = await supabase.from('valoraciones').select('objetivos')
  if (error) { console.error('No se ha podido leer lo que pide la gente:', error.message); return [] }

  const grupos: Record<string, Record<string, number>> = {}
  for (const v of (data || []) as any[]) {
    for (const t of (v.objetivos || []) as string[]) {
      const texto = (t || '').trim()
      if (!texto) continue
      const clave = normalizar(texto)
      if (!clave) continue
      grupos[clave] = grupos[clave] || {}
      grupos[clave][texto] = (grupos[clave][texto] || 0) + 1
    }
  }

  return Object.values(grupos)
    .map(formas => {
      const entradas = Object.entries(formas)
      const veces = entradas.reduce((n, [, c]) => n + c, 0)
      // La forma más repetida gana; a igualdad, la más corta, que suele ser la limpia.
      const texto = entradas.sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0]
      return { texto, veces }
    })
    .sort((a, b) => b.veces - a.veces || a.texto.localeCompare(b.texto))
}

/**
 * Qué sugerir para lo que se está escribiendo.
 *
 * Con el campo vacío se ofrecen los más pedidos, que es cuando más ayuda: no hay que
 * acordarse de cómo se escribió, se elige. Con texto, se filtra por lo que contenga.
 */
export function sugerencias(catalogo: ObjetivoPedido[], escrito: string, max = 6) {
  const t = normalizar(escrito)
  const base = t
    ? catalogo.filter(o => normalizar(o.texto).includes(t) && normalizar(o.texto) !== t)
    : catalogo
  return base.slice(0, max)
}
