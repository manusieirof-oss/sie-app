import { supabase } from './supabase'
import { normNombre, conDescendientes } from './etiquetas'

// ---------------------------------------------------------------------------
// QUÉ EVITAR Y QUÉ CONVIENE (Clínico): cada patología, operación o molestia de la
// biblioteca guarda dos listas de etiquetas. Con ellas un ejercicio avisa si lleva algo
// que esa persona debe evitar (más fino que el aviso por zona) y se pueden sugerir los
// que convienen. Se cruza por el NOMBRE: el paciente guarda «Hernia L5-S1» y la
// biblioteca tiene la ficha con ese nombre.
//
// Se cargan una vez y se guardan aquí: el taller pinta muchas tarjetas y no puede ir a
// la base por cada una. Al llegar avisan con el evento 'sie-reglas' para repintar.
// ---------------------------------------------------------------------------

export type Regla = { nombre: string, tipo: 'patologia' | 'operacion' | 'molestia', evitar: string[], conviene: string[] }

let reglas: Record<string, Regla[]> | null = null
let pidiendo = false

export function cargarReglas(forzar = false) {
  if ((reglas && !forzar) || pidiendo) return
  pidiendo = true
  const tablas: [string, Regla['tipo']][] = [['patologias_biblioteca', 'patologia'], ['operaciones_biblioteca', 'operacion'], ['molestias_biblioteca', 'molestia']]
  Promise.all(tablas.map(([t]) => supabase.from(t).select('nombre,evitar,conviene'))).then(rs => {
    const m: Record<string, Regla[]> = {}
    rs.forEach((r, i) => (r.data || []).forEach((x: any) => {
      const ev = Array.isArray(x.evitar) ? x.evitar : [], co = Array.isArray(x.conviene) ? x.conviene : []
      if (!ev.length && !co.length) return
      const k = normNombre(x.nombre || '')
      ;(m[k] = m[k] || []).push({ nombre: x.nombre, tipo: tablas[i][1], evitar: ev, conviene: co })
    }))
    reglas = m; pidiendo = false
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('sie-reglas'))
  }, () => { pidiendo = false })
}

/** Las reglas de un nombre (de patología, operación o molestia). Vacío si aún no han llegado. */
export function reglasDe(nombre: string | null | undefined): Regla[] {
  if (!reglas) { cargarReglas(); return [] }
  return reglas[normNombre(nombre || '')] || []
}

/**
 * Las reglas de `lista` que el ejercicio cumple (contando subetiquetas). Una regla puede
 * ser COMBINADA, con sus ids unidos por «+»: «Flexión+Lumbar» solo casa si el ejercicio
 * lleva las dos. Así «evitar flexión lumbar» no avisa en un curl de bíceps (que también
 * es flexión, pero de codo).
 */
export function etiquetasQueCasan(etiquetas: any[], lista: string[], idsEjercicio: string[]): string[] {
  const salida: string[] = []
  for (const regla of lista || []) {
    const partes = String(regla).split('+').filter(Boolean)
    const casa = partes.length > 0 && partes.every(id => {
      const rama = conDescendientes(etiquetas, id)
      return (idsEjercicio || []).some(x => rama.includes(x))
    })
    if (casa) salida.push(regla)
  }
  return salida
}

/** El nombre de una regla: «Flexión + Lumbar». */
export function nombreRegla(etiquetas: any[], regla: string): string {
  return String(regla).split('+').map(id => etiquetas.find((e: any) => e.id === id)?.nombre).filter(Boolean).join(' + ')
}
