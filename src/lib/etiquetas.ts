// Categorías de etiquetas de ejercicio. Estaban escritas a mano dentro de
// EtiquetasTab; al necesitarlas también el explorador, se sacan aquí para que no
// haya dos listas que puedan divergir.
//
// La jerarquía es: categoría (fija, de esta lista) -> etiqueta raíz -> subetiquetas,
// hasta tres niveles. `etiquetas.padre_id` marca el anidamiento y `etiquetas.categoria`
// la columna a la que pertenece la raíz.

export const CATEGORIAS_ETIQUETA = [
  { key: 'musculo', label: 'Músculo' },
  { key: 'articulacion', label: 'Articulación' },
  { key: 'movimiento', label: 'Movimiento' },
  { key: 'posicion', label: 'Posición' },
  { key: 'material', label: 'Material' },
  { key: 'apoyo', label: 'Apoyo' },
  { key: 'agarre', label: 'Agarre' },
  { key: 'patologia', label: 'Patología' },
  { key: 'plano_eje', label: 'Plano y eje' },
]

export function labelCategoria(key: string) {
  return CATEGORIAS_ETIQUETA.find(c => c.key === key)?.label || key
}

/**
 * Todos los descendientes de una etiqueta, a cualquier profundidad, incluida ella.
 *
 * Sirve para que filtrar por "Cuádriceps" encuentre también lo etiquetado solo como
 * "Recto femoral". Sin esto, la jerarquía sería decorativa: tendrías que saber de
 * antemano en qué nivel exacto etiquetaste cada ejercicio.
 */
export function conDescendientes(etiquetas: any[], id: string): string[] {
  const hijos: Record<string, string[]> = {}
  etiquetas.forEach(e => {
    if (!e.padre_id) return
    ;(hijos[e.padre_id] = hijos[e.padre_id] || []).push(e.id)
  })
  const salida: string[] = []
  const pila = [id]
  while (pila.length) {
    const actual = pila.pop() as string
    if (salida.includes(actual)) continue
    salida.push(actual)
    ;(hijos[actual] || []).forEach(h => pila.push(h))
  }
  return salida
}

/** La categoría de una etiqueta es la de su raíz: las hijas no la repiten. */
export function categoriaDe(etiquetas: any[], et: any): string {
  let actual = et
  const vistos = new Set<string>()
  while (actual?.padre_id && !vistos.has(actual.id)) {
    vistos.add(actual.id)
    const padre = etiquetas.find(e => e.id === actual.padre_id)
    if (!padre) break
    actual = padre
  }
  return actual?.categoria || et?.categoria || ''
}

/** La etiqueta raíz de la que cuelga esta. Si ya es raíz, se devuelve ella misma. */
export function raizDe(etiquetas: any[], et: any): any {
  let actual = et
  const vistos = new Set<string>()
  while (actual?.padre_id && !vistos.has(actual.id)) {
    vistos.add(actual.id)
    const padre = etiquetas.find(e => e.id === actual.padre_id)
    if (!padre) break
    actual = padre
  }
  return actual
}

export type GrupoEtiqueta = {
  raiz: any
  /** Las subetiquetas que el ejercicio tiene bajo esa raíz. Puede estar vacío. */
  hijas: any[]
  /** true si la raíz está puesta explícitamente en el ejercicio, no solo deducida. */
  raizPropia: boolean
}

/**
 * Agrupa las etiquetas de un ejercicio bajo su raíz.
 *
 * Un ejercicio etiquetado con "Cuádriceps" y "Vasto Medial" enseñaba las dos pastillas
 * seguidas, y a simple vista parecían dos músculos distintos. Agrupadas, se ve una sola
 * pastilla —"Cuádriceps"— con el detalle escondido detrás.
 *
 * La raíz se muestra AUNQUE el ejercicio no la tenga puesta: si solo está etiquetado
 * como "Vasto Medial", la pastilla dice "Cuádriceps" igual. Es lo que evita la
 * confusión de ver un nombre que no sabes de qué cuelga.
 */
export function agrupaPorRaiz(etiquetas: any[], ids: string[]): GrupoEtiqueta[] {
  const grupos: Record<string, GrupoEtiqueta> = {}
  const orden: string[] = []

  ;(ids || []).forEach(id => {
    const et = etiquetas.find(e => e.id === id)
    if (!et) return
    const raiz = raizDe(etiquetas, et)
    if (!grupos[raiz.id]) { grupos[raiz.id] = { raiz, hijas: [], raizPropia: false }; orden.push(raiz.id) }
    if (raiz.id === et.id) grupos[raiz.id].raizPropia = true
    else if (!grupos[raiz.id].hijas.some(h => h.id === et.id)) grupos[raiz.id].hijas.push(et)
  })

  return orden.map(id => grupos[id])
}

/** Profundidad de anidamiento, para pintar las hijas más pequeñas que las raíces. */
export function nivelDe(etiquetas: any[], et: any): number {
  let n = 0
  let actual = et
  const vistos = new Set<string>()
  while (actual?.padre_id && !vistos.has(actual.id)) {
    vistos.add(actual.id)
    const padre = etiquetas.find(e => e.id === actual.padre_id)
    if (!padre) break
    actual = padre
    n++
  }
  return n
}
