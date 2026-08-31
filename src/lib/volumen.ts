import { supabase } from './supabase'
import { raizDe, categoriaDe, conDescendientes } from './etiquetas'
import { modoParte } from './sesiones'
import { aISO } from './fechas'

// Cuánto se ha trabajado cada zona y cada patrón en un periodo.
//
// Es el dato que hoy no existe y que hace falta para decidir el siguiente programa:
// no "qué le prescribí" sino "qué ha entrenado de verdad", y sobre todo QUÉ NO.
//
// Tres decisiones que cambian lo que significan estos números:
//
// 1. Se cuenta lo ASISTIDO, no lo prescrito. Se parte de las citas en estado
//    'realizada' y de la sesión que llevaba cada una. Si asignaste ocho sesiones y
//    vino a seis, entrenó seis: contar ocho inflaría el volumen un 30% y haría el
//    informe inservible justo para el paciente que más falta.
//
// 2. Se mide en SERIES. Los kilos no se comparan entre zonas —cien de sentadilla no
//    son cien de hombro— y contar ejercicios daría el mismo peso a una sentadilla de
//    cinco series que a un estiramiento. En circuito, las vueltas de la parte son las
//    series de cada ejercicio.
//
// 3. Un ejercicio cuenta ENTERO en cada zona que trabaja. Una sentadilla suma sus
//    series a cuádriceps y a glúteo. Repartir la serie entre las etiquetas inventaría
//    una precisión que no existe —nadie sabe qué porcentaje del trabajo se lleva cada
//    músculo—, así que los totales por zona NO suman el total de series y el informe
//    tiene que decirlo.

export type Recuento = {
  id: string
  nombre: string
  series: number
  /** Sesiones distintas en las que aparece. Distingue "mucho un día" de "poco siempre". */
  sesiones: number
}

export type ResumenVolumen = {
  desde: string
  hasta: string
  /** Citas realizadas en el periodo, que son las que aportan volumen. */
  asistidas: number
  /** Citas del periodo que no se hicieron: faltas y cancelaciones. */
  perdidas: number
  seriesTotales: number
  /** Por etiqueta raíz de músculo, de más a menos. Incluye las que están a cero. */
  musculos: Recuento[]
  /** Por patrón de movimiento, de más a menos. Incluye los que están a cero. */
  patrones: Recuento[]
  /** Frases en castellano con lo que hay que mirar. Vacío si no hay nada que decir. */
  avisos: string[]
}

/** Series que aporta un ejercicio dentro de su parte. */
function seriesDe(parte: any, ej: any): number {
  // En circuito manda el número de vueltas de la parte: el ejercicio no tiene series
  // propias y ponerle una por defecto contaría de menos todo el calentamiento.
  const n = modoParte(parte?.modo).id === 'circuito'
    ? parseInt(String(parte?.vueltas || ''))
    : parseInt(String(ej?.series || ''))
  // Sin número, una serie: el ejercicio se hizo, aunque no se anotara cuántas veces.
  return Number.isFinite(n) && n > 0 ? n : 1
}

/**
 * Pares de patrones que deberían ir equilibrados. Si uno tiene menos de un tercio que
 * su pareja, es el aviso más útil que puede dar el informe: lo típico no es que falte
 * un músculo, es que haya el doble de empuje que de tracción y eso por músculo no se ve.
 */
const PARES = [
  ['Empuje horizontal', 'Tracción horizontal'],
  ['Empuje vertical', 'Tracción vertical'],
  ['Sentadilla', 'Bisagra de cadera'],
]

export async function resumenVolumen(pacienteId: string, semanas = 8): Promise<ResumenVolumen> {
  const hoy = new Date()
  const desde = new Date(hoy.getTime() - semanas * 7 * 24 * 3600 * 1000)
  const sDesde = aISO(desde)
  const sHasta = aISO(hoy)

  const [{ data: citas }, { data: etiquetas }, { data: ejercicios }] = await Promise.all([
    supabase.from('citas').select('id,estado,sesion_id, sesiones:sesion_id(id,nombre,partes)')
      .eq('paciente_id', pacienteId).gte('fecha', sDesde).lte('fecha', sHasta),
    supabase.from('etiquetas').select('id,nombre,categoria,padre_id'),
    supabase.from('ejercicios').select('id,etiquetas'),
  ])

  const ets = etiquetas || []
  const etPorId: Record<string, any> = {}
  ets.forEach((e: any) => { etPorId[e.id] = e })
  const ejPorId: Record<string, any> = {}
  ;(ejercicios || []).forEach((e: any) => { ejPorId[e.id] = e })

  const realizadas = (citas || []).filter((c: any) => c.estado === 'realizada')
  const perdidas = (citas || []).filter((c: any) => c.estado === 'falta' || c.estado === 'cancelada')

  // Todos los patrones y todos los músculos raíz que EXISTEN, no solo los que salen.
  // El hueco es el dato: un músculo a cero tiene que aparecer, porque es justo lo que
  // se va a corregir en el programa siguiente.
  const raizPatron = ets.find((e: any) => e.categoria === 'movimiento' && e.nombre === 'Patrón')
  const idsPatron = raizPatron
    ? conDescendientes(ets, raizPatron.id).filter(id => id !== raizPatron.id)
    : []
  const musculosRaiz = ets.filter((e: any) => e.categoria === 'musculo' && !e.padre_id)

  const musc: Record<string, Recuento> = {}
  const patr: Record<string, Recuento> = {}
  musculosRaiz.forEach((e: any) => { musc[e.id] = { id: e.id, nombre: e.nombre, series: 0, sesiones: 0 } })
  idsPatron.forEach(id => {
    const e = etPorId[id]
    if (e) patr[id] = { id, nombre: e.nombre, series: 0, sesiones: 0 }
  })

  let seriesTotales = 0
  // Para contar sesiones distintas y no sumar una por cada ejercicio de la misma.
  const vistoEnSesion: Record<string, Set<string>> = {}

  for (const c of realizadas) {
    const ses: any = Array.isArray(c.sesiones) ? c.sesiones[0] : c.sesiones
    if (!ses?.partes) continue

    for (const parte of ses.partes) {
      for (const ej of (parte.ejercicios || [])) {
        const bib = ejPorId[ej?.ejercicio_id]
        if (!bib) continue
        const n = seriesDe(parte, ej)
        seriesTotales += n

        for (const idEt of (bib.etiquetas || [])) {
          const et = etPorId[idEt]
          if (!et) continue
          const raiz = raizDe(ets, et)
          const cat = categoriaDe(ets, et)

          if (cat === 'musculo' && musc[raiz.id]) {
            musc[raiz.id].series += n
            ;(vistoEnSesion[raiz.id] ||= new Set()).add(String(c.id))
          }
          // El patrón es la etiqueta en sí, no su raíz: la raíz sería "Patrón".
          if (cat === 'movimiento' && patr[idEt]) {
            patr[idEt].series += n
            ;(vistoEnSesion[idEt] ||= new Set()).add(String(c.id))
          }
        }
      }
    }
  }

  Object.values(musc).forEach(r => { r.sesiones = vistoEnSesion[r.id]?.size || 0 })
  Object.values(patr).forEach(r => { r.sesiones = vistoEnSesion[r.id]?.size || 0 })

  const ordena = (a: Recuento, b: Recuento) => b.series - a.series || a.nombre.localeCompare(b.nombre)
  const musculos = Object.values(musc).sort(ordena)
  const patrones = Object.values(patr).sort(ordena)

  return {
    desde: sDesde, hasta: sHasta,
    asistidas: realizadas.length,
    perdidas: perdidas.length,
    seriesTotales,
    musculos,
    patrones,
    avisos: avisosDe(patrones, musculos, realizadas.length),
  }
}

/**
 * Lo que hay que mirar, escrito en castellano.
 *
 * Los números están arriba, pero la conclusión es lo que de verdad se lee con el
 * paciente delante. Son reglas deliberadamente simples y explicables: nada de
 * puntuaciones ni pesos, porque un aviso que no se puede rebatir no sirve para decidir.
 */
function avisosDe(patrones: Recuento[], musculos: Recuento[], asistidas: number): string[] {
  const avisos: string[] = []
  if (asistidas === 0) return ['Sin sesiones realizadas en el periodo: no hay nada que medir.']

  const porNombre: Record<string, Recuento> = {}
  patrones.forEach(p => { porNombre[p.nombre] = p })

  for (const [a, b] of PARES) {
    const x = porNombre[a], y = porNombre[b]
    if (!x || !y) continue
    const [mas, menos] = x.series >= y.series ? [x, y] : [y, x]
    if (mas.series === 0) continue
    // Un tercio es el umbral: por debajo ya no es un matiz de programación.
    if (menos.series * 3 < mas.series) {
      avisos.push(menos.series === 0
        ? `${mas.nombre} lleva ${mas.series} series y ${menos.nombre.toLowerCase()} ninguna.`
        : `${mas.nombre} lleva ${mas.series} series y ${menos.nombre.toLowerCase()} solo ${menos.series}.`)
    }
  }

  const patronesCero = patrones.filter(p => p.series === 0).map(p => p.nombre)
  if (patronesCero.length > 0 && patronesCero.length < patrones.length) {
    avisos.push(`Sin entrenar en todo el periodo: ${patronesCero.join(', ').toLowerCase()}.`)
  }

  // Solo se avisa de los músculos que alguna vez se han tocado y ahora están a cero.
  // Listar los treinta que nunca aparecen sería ruido: nadie entrena todo cada mes.
  const trabajados = musculos.filter(m => m.series > 0)
  if (trabajados.length > 0) {
    const flojos = trabajados.filter(m => m.series * 5 < trabajados[0].series).map(m => m.nombre)
    if (flojos.length > 0 && flojos.length <= 4) {
      avisos.push(`Muy por debajo del resto: ${flojos.join(', ')}.`)
    }
  }

  return avisos
}
