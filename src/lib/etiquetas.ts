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

/**
 * Nombre de etiqueta en forma comparable: sin mayúsculas, sin tildes y sin espacios
 * sobrantes. Estaba escrito a mano en cada sembrador.
 */
export const normNombre = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

export type IndiceEtiquetas = Record<string, Record<string, string[]>>

/**
 * Índice de etiquetas por CATEGORÍA y nombre. Se construye una vez y se consulta con
 * `idEnCategoria`.
 *
 * POR QUÉ NO BASTA UN MAPA POR NOMBRE. Hay nombres repetidos en categorías distintas y
 * son etiquetas legítimas: "Cervical" es una articulación bajo Columna y a la vez un
 * músculo con sus dos hijas; lo mismo "Hombro", "Rodilla", "Pie" o "Mano". Un mapa
 * `nombre -> id` se queda con la última que lea, y esa fue la avería real: trece
 * objetivos acabaron con un MÚSCULO guardado como zona, y en la pestaña salían dos
 * "Cervical" que parecían el mismo repetido.
 *
 * La categoría se resuelve desde la RAÍZ (`categoriaDe`), no leyendo la columna: las
 * hijas heredan la de su madre.
 */
export function indicePorCategoria(etiquetas: any[]): IndiceEtiquetas {
  const mapa: IndiceEtiquetas = {}
  ;(etiquetas || []).forEach(e => {
    const n = normNombre(e?.nombre)
    if (!n) return
    const cat = categoriaDe(etiquetas, e)
    const porNombre = (mapa[cat] = mapa[cat] || {})
    ;(porNombre[n] = porNombre[n] || []).push(e.id)
  })
  return mapa
}

/**
 * El id de la etiqueta con ese nombre DENTRO de esa categoría.
 *
 * Si hay dos con el mismo nombre en la misma categoría devuelve `null` y dice cuántas
 * son: entre dos candidatas igual de válidas no hay forma de acertar, y elegir una a
 * dedo es exactamente lo que provocó el problema que esto viene a evitar. Quien llama
 * tiene que avisar, no seguir como si nada.
 */
export function idEnCategoria(indice: IndiceEtiquetas, categoria: string, nombre: string):
  { id: string | null, repetidas: number } {
  const ids = indice[categoria]?.[normNombre(nombre)] || []
  return { id: ids.length === 1 ? ids[0] : null, repetidas: ids.length }
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

/**
 * Las ZONAS que representa un conjunto de etiquetas: sus raíces de articulación.
 *
 * Es lo que ordena la biblioteca de tests, y estaba resuelto a mano y mal en el
 * explorador: comparaba `etiqueta.categoria === 'articulacion'` directamente sobre la
 * fila. Las etiquetas hijas NO repiten la categoría de su raíz —eso es lo que dice
 * `categoriaDe`— así que un test etiquetado con una subetiqueta de Hombro no contaba como
 * de hombro y se caía al cajón de "Sin zona", sin ninguna forma de darse cuenta salvo
 * echar de menos el test en su filtro.
 *
 * Se devuelve siempre la RAÍZ, no la etiqueta puesta: quien etiqueta un test con una
 * subzona quiere encontrarlo por su articulación, no abrir un filtro nuevo por cada
 * subetiqueta que use.
 */
export function zonasDe(etiquetas: any[], ids: string[]): any[] {
  const salida: any[] = []
  for (const id of (ids || [])) {
    const et = etiquetas.find(e => e.id === id)
    if (!et) continue
    if (categoriaDe(etiquetas, et) !== 'articulacion') continue
    const raiz = raizDe(etiquetas, et)
    if (raiz && !salida.some(z => z.id === raiz.id)) salida.push(raiz)
  }
  return salida
}

/**
 * Valor del filtro de zona para "las filas que no tienen ninguna".
 *
 * Está aquí y no en cada pantalla porque las tres lo escribían por su cuenta y ya había
 * dos cadenas distintas para la misma idea.
 */
export const SIN_ZONA = '_sin'

/**
 * Las SUBZONAS de una raíz que alguien usa de verdad, entre las etiquetas dadas.
 *
 * Solo las que están en uso: ofrecer el árbol entero llenaría la fila de filtros que no
 * devuelven nada. No incluye la raíz.
 */
export function subzonasEnUso(etiquetas: any[], usadas: string[], raizId: string): any[] {
  const rama = conDescendientes(etiquetas, raizId)
  const salida: any[] = []
  for (const id of (usadas || [])) {
    if (id === raizId || !rama.includes(id)) continue
    const et = etiquetas.find(e => e.id === id)
    if (et && !salida.some(x => x.id === et.id)) salida.push(et)
  }
  return salida
}

/**
 * ¿Esta fila cae bajo la zona elegida?
 *
 * Elegir una RAÍZ trae también lo etiquetado por debajo —"Columna" trae lo de "Cervical"—,
 * y elegir una SUBZONA trae solo esa rama. Es la misma regla en los dos casos: la elegida
 * con sus descendientes. Así desplegar las subzonas sirve para afinar y nunca para dejar
 * de ver algo.
 */
export function casaZona(etiquetas: any[], ids: string[], zona: string): boolean {
  if (!zona) return true
  if (zona === SIN_ZONA) return zonasDe(etiquetas, ids).length === 0
  const rama = conDescendientes(etiquetas, zona)
  return (ids || []).some(id => rama.includes(id))
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
