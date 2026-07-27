// Cifras de resultados de un paciente y colores de las gráficas.
//
// Los mismos cinco números se calculaban en tres sitios —la vista de análisis, la
// vista "Para el paciente" y `generarPDF`— cada uno con su propia copia. Y los colores
// estaban declarados dos veces con valores DISTINTOS: las gráficas usaban #C25B5B y
// #D4A24E donde el resto de la app usa #B05A5A y #C9A84C, así que llevaban tiempo
// pintándose en un rojo y un ámbar que no eran los de la clínica.
//
// Recharts y el HTML del PDF necesitan hex de verdad, no `var(--x)`, así que la
// constante hace falta. Lo que no hacía falta era tenerla tres veces.

/** Copia exacta de los tokens de globals.css. Si cambian allí, cambian aquí. */
export const COLOR = {
  g:    '#5A969E', // --g
  gd:   '#3E7179', // --gd
  gl:   '#EBF4F5', // --gl
  red:  '#B05A5A', // --red
  redl: '#FDF4F4', // --redl
  amb:  '#C9A84C', // --amb
  ambl: '#FBF1DC', // --ambl
  gris: '#6B6D6A', // --gr
  bm:   '#E4E0D6', // --bm
}

export type Asistencia = {
  realizadas: number
  faltas: number
  canceladas: number
  recuperadas: number
  /** Denominador del porcentaje: realizadas + faltas. */
  base: number
  pct: number
}

/**
 * Asistencia del paciente.
 *
 * Las CANCELADAS quedan fuera del porcentaje a propósito: una clase anulada con
 * antelación no es una falta, es una clase que no llegó a existir. Contarlas
 * hundiría el dato de quien avisa siempre, que es justo el comportamiento que
 * quieres premiar. Por eso `base` se devuelve aparte: el número no significa nada
 * sin decir sobre cuántas está calculado.
 */
export function asistencia(citas: any[], recuperaciones: any[] = []): Asistencia {
  const realizadas = citas.filter(c => c.estado === 'realizada').length
  const faltas = citas.filter(c => c.estado === 'falta').length
  const canceladas = citas.filter(c => c.estado === 'cancelada').length
  const recuperadas = recuperaciones.filter(r => r.estado === 'recuperada').length
  const base = realizadas + faltas
  return {
    realizadas, faltas, canceladas, recuperadas, base,
    pct: base > 0 ? Math.round((realizadas / base) * 100) : 0,
  }
}

/** Realizadas y faltas mes a mes, de los últimos `n` meses con actividad. */
export function porMes(citas: any[], n = 6) {
  const mapa: Record<string, { realizadas: number, faltas: number }> = {}
  citas.forEach(c => {
    const mes = c.fecha?.slice(0, 7)
    if (!mes) return
    if (!mapa[mes]) mapa[mes] = { realizadas: 0, faltas: 0 }
    if (c.estado === 'realizada') mapa[mes].realizadas++
    if (c.estado === 'falta') mapa[mes].faltas++
  })
  return Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b)).slice(-n).map(([mes, v]) => {
    const [anio, m] = mes.split('-')
    return {
      mes: new Date(parseInt(anio), parseInt(m) - 1, 1).toLocaleDateString('es-ES', { month: 'short' }),
      Realizadas: v.realizadas,
      Faltas: v.faltas,
    }
  })
}

/**
 * Evolución de la carga por ejercicio, a partir de lo registrado en el taller.
 *
 * De cada día se toma la serie más pesada, no la media: lo que dice si alguien
 * progresa es el tope que mueve, y promediar con las series de aproximación lo
 * enmascara. En ejercicios por tiempo se toma el más largo.
 */
export function cargaPorEjercicio(registros: any[]) {
  const porEj: Record<string, { nombre: string, puntos: { fecha: string, valor: number, unidad: string }[] }> = {}

  registros.forEach(r => {
    const series = Array.isArray(r.series) ? r.series : []
    if (series.length === 0 || !r.ejercicio_id || !r.fecha) return

    let mejor = 0
    let unidad = ''
    series.forEach((s: any) => {
      const peso = parseFloat(s?.peso)
      const seg = parseFloat(s?.segundos)
      if (!isNaN(peso) && peso > mejor) { mejor = peso; unidad = 'kg' }
      else if (isNaN(peso) && !isNaN(seg) && seg > mejor) { mejor = seg; unidad = 's' }
    })
    if (mejor <= 0) return

    const ej = porEj[r.ejercicio_id] || (porEj[r.ejercicio_id] = { nombre: r.ejercicio_nombre || 'Ejercicio', puntos: [] })
    // Varios registros el mismo día (misma sesión repetida): se queda el mayor.
    const ya = ej.puntos.find(p => p.fecha === r.fecha)
    if (ya) { if (mejor > ya.valor) { ya.valor = mejor; ya.unidad = unidad } }
    else ej.puntos.push({ fecha: r.fecha, valor: mejor, unidad })
  })

  return Object.entries(porEj)
    .map(([id, v]) => {
      const puntos = v.puntos.sort((a, b) => a.fecha.localeCompare(b.fecha))
      const primero = puntos[0]?.valor || 0
      const ultimo = puntos[puntos.length - 1]?.valor || 0
      return {
        ejercicio_id: id,
        nombre: v.nombre,
        unidad: puntos[0]?.unidad || '',
        puntos,
        primero, ultimo,
        delta: ultimo - primero,
      }
    })
    // Con un solo punto no hay evolución que enseñar, solo un dato suelto.
    .filter(e => e.puntos.length >= 2)
    .sort((a, b) => b.puntos.length - a.puntos.length)
}

/**
 * Evolución del gesto: qué porcentaje de criterios técnicos cumple cada día.
 *
 * La sección Ejecución solo enseña la ÚLTIMA evaluación de cada ejercicio, que dice
 * cómo está hoy pero no si va a mejor. Aquí interesa la tendencia: un 40% que sube es
 * mejor noticia que un 80% que lleva tres meses igual.
 */
export function ejecucionPorEjercicio(registros: any[]) {
  const porEj: Record<string, { nombre: string, puntos: { fecha: string, pct: number, ok: number, total: number }[] }> = {}

  registros.forEach(r => {
    const iv = r.items_evaluados || {}
    const claves = Object.keys(iv)
    if (claves.length === 0 || !r.ejercicio_id || !r.fecha) return
    const ok = claves.filter(k => iv[k] === true).length
    const pct = Math.round((ok / claves.length) * 100)

    const ej = porEj[r.ejercicio_id] || (porEj[r.ejercicio_id] = { nombre: r.ejercicio_nombre || 'Ejercicio', puntos: [] })
    const ya = ej.puntos.find(p => p.fecha === r.fecha)
    if (!ya) ej.puntos.push({ fecha: r.fecha, pct, ok, total: claves.length })
  })

  return Object.entries(porEj)
    .map(([id, v]) => {
      const puntos = v.puntos.sort((a, b) => a.fecha.localeCompare(b.fecha))
      return {
        ejercicio_id: id,
        nombre: v.nombre,
        puntos,
        primero: puntos[0]?.pct || 0,
        ultimo: puntos[puntos.length - 1]?.pct || 0,
      }
    })
    .filter(e => e.puntos.length >= 2)
    .sort((a, b) => b.puntos.length - a.puntos.length)
}

/**
 * Molestias agrupadas POR ZONA.
 *
 * La gráfica anterior ordenaba todas las molestias por fecha de registro y las unía
 * con una sola línea, así que enlazaba el dolor de rodilla con el de hombro y con el
 * de lumbar y dibujaba una evolución que no existía. Cada zona es una medida distinta
 * y va por su lado.
 */
export function evaPorZona(molestias: any[]) {
  const zonas: Record<string, { fecha: string, EVA: number }[]> = {}
  molestias
    .filter(m => typeof m.eva === 'number' && m.created_at)
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
    .forEach(m => {
      const z = m.zona || 'Sin zona'
      ;(zonas[z] = zonas[z] || []).push({
        fecha: new Date(m.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        EVA: m.eva,
      })
    })
  return Object.entries(zonas).map(([zona, puntos]) => ({ zona, puntos }))
}
