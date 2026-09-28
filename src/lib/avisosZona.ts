import { normNombre, raizDe, casaZona, categoriaDe } from './etiquetas'

// ---------------------------------------------------------------------------
// LA MOLESTIA, SOBRE EL EJERCICIO QUE LA TOCA
//
// El icono de "este paciente tiene cosas" salia igual en los doce ejercicios de
// la sesion, asi que se acababa ignorando. Pero la molestia ya se marca en el
// mapa del cuerpo con su zona, y los ejercicios ya llevan etiquetas: cruzarlos
// es todo lo que hace falta para que el aviso salga solo donde toca.
//
// SE CRUZA POR LA MADRE, no por la especifica. "Hombro" y no "deltoides
// anterior": la molestia se marca en una zona del cuerpo, no en un fasciculo, y
// exigir que coincidan las hojas del arbol seria no avisar nunca.
//
// Es informativo y no prohibitivo: lo dice y decides tu. Y caduca solo, porque
// desactivar la molestia apaga el aviso sin tocar nada mas.
// ---------------------------------------------------------------------------

/**
 * La etiqueta RAIZ que representa una zona del mapa. Primero por articulacion
 * -"hombro", "rodilla"- y si no, por musculo -"isquiotibiales"-. Null si esa
 * zona no tiene etiqueta que le corresponda.
 */
export function raizDeZona(etiquetas: any[], zona: string): any | null {
  const z = normNombre(zona || '')
  if (z === '') return null
  const candidatas = (etiquetas || []).filter(e => normNombre(e.nombre) === z)
  if (candidatas.length === 0) return null
  const porCat = (c: string) => candidatas.find(e => categoriaDe(etiquetas, e) === c)
  const et = porCat('articulacion') || porCat('musculo') || candidatas[0]
  return raizDe(etiquetas, et) || et
}

export type AvisoZona = {
  zona: string
  lado?: string | null
  eva?: number | null
  nota?: string | null
  tipo?: string | null
}

/**
 * Las molestias activas que tocan a este ejercicio. Vacio si ninguna: el press
 * de piernas no tiene por que enterarse de un hombro.
 */
export function avisosDeEjercicio(
  molestias: any[], etiquetas: any[], idsEjercicio: string[],
): AvisoZona[] {
  if (!Array.isArray(idsEjercicio) || idsEjercicio.length === 0) return []
  const salida: AvisoZona[] = []
  for (const m of (molestias || [])) {
    if (m?.activa === false) continue
    const raiz = raizDeZona(etiquetas, m.zona)
    if (raiz == null) continue
    if (casaZona(etiquetas, idsEjercicio, raiz.id) === false) continue
    salida.push({
      zona: m.zona, lado: m.lado, eva: m.eva,
      nota: m.observaciones || m.sensacion || null, tipo: m.tipo,
    })
  }
  // La que mas duele, primero.
  return salida.sort((a, b) => (Number(b.eva) || 0) - (Number(a.eva) || 0))
}

/** "hombro derecho · EVA 6" */
export function tituloAviso(a: AvisoZona): string {
  return [
    [a.zona, a.lado && a.lado !== 'bilateral' ? a.lado : ''].filter(Boolean).join(' '),
    a.eva == null || a.eva === ('' as any) ? '' : `EVA ${a.eva}`,
  ].filter(Boolean).join(' · ')
}
