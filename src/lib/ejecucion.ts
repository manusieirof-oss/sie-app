// Criterios de ejecución de un ejercicio: cómo se guardan y cómo se leen.
//
// EL PROBLEMA
// `registros_ejercicio.items_evaluados` se guardaba como {0:true, 1:false}, donde el
// número es la POSICIÓN del criterio en `ejercicios.items_ejecucion` en el momento de
// evaluar. Al pintarlo se cruzaba contra la lista ACTUAL de la biblioteca, así que en
// cuanto se añadía un criterio al principio o se reordenaban dos, todas las
// evaluaciones anteriores se desplazaban en silencio: "cumple la posición 1" pasaba a
// leerse sobre otro criterio distinto. No fallaba nada, no avisaba nadie, y las
// gráficas de progresión empezaban a medir otra cosa.
//
// LA SOLUCIÓN
// Guardar por TEXTO del criterio: {"Rodilla alineada": true}. Deja de depender del
// orden y se explica solo al mirar la fila en la base. Si un criterio se renombra, su
// evaluación antigua queda huérfana — que es lo honesto, porque ya es otro criterio,
// y muy preferible a asignarla a uno equivocado.
//
// Las filas antiguas con claves numéricas se siguen leyendo por posición, avisando de
// que esa lectura puede no ser fiable.

export type ItemLeido = {
  texto: string
  ok: boolean
  /** Se leyó por posición porque la fila es antigua: puede no corresponder. */
  dudoso?: boolean
}

const esNumerica = (k: string) => /^\d+$/.test(k)

/** Formato antiguo: todas las claves son índices. */
export function formatoAntiguo(iv: any): boolean {
  const claves = Object.keys(iv || {})
  return claves.length > 0 && claves.every(esNumerica)
}

/**
 * Cruza lo evaluado con los criterios actuales del ejercicio.
 * Devuelve también los que se evaluaron y ya no existen en la biblioteca, para no
 * hacer desaparecer trabajo que sí se hizo.
 */
export function leerItems(iv: any, itemsActuales: any[]): { items: ItemLeido[], huerfanos: ItemLeido[], dudoso: boolean } {
  const evaluado = iv || {}
  const actuales = (itemsActuales || []).map((it: any) => (typeof it === 'string' ? it : it?.texto)).filter(Boolean)
  const antiguo = formatoAntiguo(evaluado)

  const items: ItemLeido[] = actuales.map((texto: string, i: number) => ({
    texto,
    ok: antiguo ? evaluado[i] === true : evaluado[texto] === true,
    dudoso: antiguo,
  }))

  // Solo tiene sentido en el formato nuevo: con índices no se sabe a qué texto iban.
  const huerfanos: ItemLeido[] = antiguo ? [] : Object.keys(evaluado)
    .filter(k => !esNumerica(k) && !actuales.includes(k))
    .map(texto => ({ texto, ok: evaluado[texto] === true }))

  return { items, huerfanos, dudoso: antiguo && actuales.length > 0 }
}

/** Marca o desmarca un criterio. Siempre por texto. */
export function alternarItem(iv: any, texto: string) {
  const salida = { ...(iv || {}) }
  salida[texto] = !salida[texto]
  return salida
}

/** ¿Está marcado este criterio? Acepta las filas antiguas por posición. */
export function itemMarcado(iv: any, texto: string, indice: number): boolean {
  const evaluado = iv || {}
  if (formatoAntiguo(evaluado)) return evaluado[indice] === true
  return evaluado[texto] === true
}

/** Cuántos criterios se cumplen, sobre cuántos evaluados. Sin depender del orden. */
export function resumen(iv: any): { ok: number, total: number, pct: number } {
  const evaluado = iv || {}
  const claves = Object.keys(evaluado)
  const total = claves.length
  const ok = claves.filter(k => evaluado[k] === true).length
  return { ok, total, pct: total > 0 ? Math.round((ok / total) * 100) : 0 }
}
