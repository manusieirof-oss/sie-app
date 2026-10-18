// Cifras de resultados de un paciente y colores de las gráficas.
//
// Los mismos cinco números se calculaban en tres sitios —la vista de análisis, la
// vista "Para el paciente" y `generarPDF`— cada uno con su propia copia. Y los colores
// estaban declarados dos veces con valores DISTINTOS: las gráficas usaban #C25B5B y
// #D4A24E donde el resto de la app usa #B05A5A y #C9A84C, así que llevaban tiempo
// pintándose en un rojo y un ámbar que no eran los de la clínica.
//
import { resumen } from './ejecucion'
import { nombreMotivo } from './cambioSesion'

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
 * 1RM ESTIMADO (Epley): peso × (1 + reps / 30).
 *
 * El peso máximo del día engaña: 20 kg × 12 y 22 kg × 6 dicen "subió" y no es verdad.
 * El 1RM estimado pone las dos series en la misma escala. Por encima de 12 repeticiones
 * la fórmula se vuelve poco fiable (mide más resistencia que fuerza), así que no se usa.
 */
export function rm1(peso: number, reps: number): number {
  if (!(peso > 0) || !(reps > 0) || reps > 12) return 0
  return reps === 1 ? peso : peso * (1 + reps / 30)
}

/**
 * Evolución de la carga por ejercicio, a partir de lo registrado en el taller.
 *
 * De cada día se toma la serie más exigente, no la media: lo que dice si alguien
 * progresa es el tope que mueve, y promediar con las series de aproximación lo
 * enmascara.
 *
 * QUÉ SE MIDE, POR ORDEN: kg; si no hay kg, la banda (su puesto en la escala de
 * Ajustes, de la más suave a la más dura); si no, segundos; si no, metros; y si no
 * hay nada más, las repeticiones. Antes solo contaban kg, segundos y metros, así que
 * una flexión o un ejercicio con banda nunca salían aunque se anotaran cada día.
 *
 * Un ejercicio se pinta en UNA unidad: la que más días tenga. Si un día se anotó en
 * kg y otro en segundos, mezclarlos en la misma línea dibujaría un salto falso.
 */
export function cargaPorEjercicio(registros: any[], bandas: string[] = []) {
  type Punto = { fecha: string, valor: number, unidad: string, rm?: number }
  const porEj: Record<string, { nombre: string, variante: string, fechaNombre: string, puntos: Punto[] }> = {}
  const nivel = (b: any) => {
    const i = bandas.findIndex(x => x.toLowerCase() === String(b ?? '').toLowerCase().trim())
    return i < 0 ? NaN : i + 1
  }
  const ORDEN = ['kg', 'banda', 's', 'm', 'reps']

  registros.forEach(r => {
    const series = Array.isArray(r.series) ? r.series : []
    if (series.length === 0 || !r.ejercicio_id || !r.fecha) return

    // El mejor valor de cada unidad en el día; luego se queda la de más rango.
    const mejor: Record<string, number> = {}
    let mejorRm = 0
    series.forEach((s: any) => {
      const r1 = rm1(parseFloat(s?.peso), parseFloat(s?.reps))
      if (r1 > mejorRm) mejorRm = r1
      const vals: [string, number][] = [
        ['kg', parseFloat(s?.peso)], ['banda', nivel(s?.banda)], ['s', parseFloat(s?.segundos)],
        ['m', parseFloat(s?.metros)], ['reps', parseFloat(s?.reps)],
      ]
      vals.forEach(([u, v]) => { if (!isNaN(v) && v > 0 && v > (mejor[u] || 0)) mejor[u] = v })
    })
    const unidad = ORDEN.find(u => mejor[u] > 0)
    if (!unidad) return
    const valor = mejor[unidad]

    // Una serie por ejercicio Y VARIANTE: un unilateral no se compara con un bilateral.
    const clave = `${r.ejercicio_id}|${r.variante || ''}`
    const ej = porEj[clave] || (porEj[clave] = {
      nombre: r.ejercicio_nombre || 'Ejercicio', variante: r.variante || '', fechaNombre: r.fecha, puntos: [],
    })
    // El nombre, del registro más reciente: si el ejercicio se renombró, manda el nuevo.
    if (r.fecha >= ej.fechaNombre) { ej.nombre = r.ejercicio_nombre || ej.nombre; ej.fechaNombre = r.fecha }

    // Varios registros el mismo día y misma unidad: se queda el mayor.
    const rm = unidad === 'kg' && mejorRm > 0 ? Math.round(mejorRm * 10) / 10 : undefined
    const ya = ej.puntos.find(p => p.fecha === r.fecha && p.unidad === unidad)
    if (ya) { if (valor > ya.valor) ya.valor = valor; if (rm && rm > (ya.rm || 0)) ya.rm = rm }
    else ej.puntos.push({ fecha: r.fecha, valor, unidad, rm })
  })

  return Object.entries(porEj)
    .map(([clave, v]) => {
      const cuenta: Record<string, number> = {}
      v.puntos.forEach(p => { cuenta[p.unidad] = (cuenta[p.unidad] || 0) + 1 })
      const unidad = Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a] || ORDEN.indexOf(a) - ORDEN.indexOf(b))[0] || ''
      const puntos = v.puntos.filter(p => p.unidad === unidad).sort((a, b) => a.fecha.localeCompare(b.fecha))
      const primero = puntos[0]?.valor || 0
      const ultimo = puntos[puntos.length - 1]?.valor || 0
      return {
        ejercicio_id: clave, nombre: v.nombre, variante: v.variante,
        unidad, puntos, primero, ultimo, delta: ultimo - primero,
        // Días anotados en otra medida (un día en kg, otro en segundos): no van en la
        // línea, pero se cuentan para no esconder que existen.
        otros: v.puntos.length - puntos.length,
      }
    })
    // Los de un solo día también se devuelven: no hay línea que pintar, pero sí un dato,
    // y ocultarlos hacía parecer que faltaban ejercicios. Quien pinta decide cómo.
    .sort((a, b) => b.puntos.length - a.puntos.length)
}

/** Cómo se lee un valor de carga: "20 kg", "Roja", "45 s", "12 reps". */
export function textoCarga(valor: number, unidad: string, bandas: string[] = []) {
  if (unidad === 'banda') return bandas[Math.round(valor) - 1] || `Banda ${valor}`
  const v = Math.round(valor * 10) / 10
  return unidad === 'kg' ? `${v} kg` : unidad === 's' ? `${v} s` : unidad === 'm' ? `${v} m` : `${v} reps`
}

/**
 * ESFUERZO Y DOLOR ANOTADOS EN LA SALA, por ejercicio y día.
 *
 * RPE, RIR y dolor se apuntan serie a serie (si están encendidos en Ajustes) y hasta
 * ahora no se veían en ningún sitio. Del día se toma la MEDIA de las series: aquí no
 * interesa el tope sino cómo lo vivió. El dolor es lo más útil: un ejercicio que
 * duele cada vez menos con la misma carga es la mejor noticia en rehabilitación.
 */
export function esfuerzoPorEjercicio(registros: any[]) {
  type Dia = { fecha: string, rpe?: number, rir?: number, dolor?: number }
  const porEj: Record<string, { nombre: string, fechaNombre: string, dias: Dia[] }> = {}
  const CAMPOS = ['rpe', 'rir', 'dolor'] as const

  registros.forEach(r => {
    const series = Array.isArray(r.series) ? r.series : []
    if (series.length === 0 || !r.ejercicio_id || !r.fecha) return
    const dia: Dia = { fecha: r.fecha }
    CAMPOS.forEach(c => {
      const vals = series.map((s: any) => parseFloat(s?.[c])).filter((n: number) => !isNaN(n))
      if (vals.length) dia[c] = Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length * 10) / 10
    })
    if (CAMPOS.every(c => dia[c] == null)) return
    const ej = porEj[r.ejercicio_id] || (porEj[r.ejercicio_id] = { nombre: r.ejercicio_nombre || 'Ejercicio', fechaNombre: r.fecha, dias: [] })
    if (r.fecha >= ej.fechaNombre) { ej.nombre = r.ejercicio_nombre || ej.nombre; ej.fechaNombre = r.fecha }
    if (!ej.dias.some(d => d.fecha === r.fecha)) ej.dias.push(dia)
  })

  return Object.entries(porEj)
    .map(([id, v]) => {
      const dias = v.dias.sort((a, b) => a.fecha.localeCompare(b.fecha))
      const campos = CAMPOS.filter(c => dias.some(d => d[c] != null))
      const ultimoDolor = [...dias].reverse().find(d => d.dolor != null)?.dolor
      const primerDolor = dias.find(d => d.dolor != null)?.dolor
      return { ejercicio_id: id, nombre: v.nombre, dias, campos,
        dolor: ultimoDolor, deltaDolor: ultimoDolor != null && primerDolor != null ? ultimoDolor - primerDolor : 0 }
    })
    .filter(e => e.dias.length >= 2)
    // Primero los que duelen: es lo que hay que mirar antes.
    .sort((a, b) => (b.dolor || 0) - (a.dolor || 0) || b.dias.length - a.dias.length)
}

/**
 * Evolución del gesto: qué porcentaje de criterios técnicos cumple cada día.
 *
 * La sección Ejecución solo enseña la ÚLTIMA evaluación de cada ejercicio, que dice
 * cómo está hoy pero no si va a mejor. Aquí interesa la tendencia: un 40% que sube es
 * mejor noticia que un 80% que lleva tres meses igual.
 */
export function ejecucionPorEjercicio(registros: any[]) {
  const porEj: Record<string, { nombre: string, fechaNombre: string, puntos: { fecha: string, pct: number, ok: number, total: number }[] }> = {}

  registros.forEach(r => {
    // `resumen` cuenta sobre las claves guardadas, sean índices o textos: así el
    // porcentaje no depende del orden de los criterios en la biblioteca.
    const { ok, total, pct } = resumen(r.items_evaluados)
    if (total === 0 || !r.ejercicio_id || !r.fecha) return

    const ej = porEj[r.ejercicio_id] || (porEj[r.ejercicio_id] = { nombre: r.ejercicio_nombre || 'Ejercicio', fechaNombre: r.fecha, puntos: [] })
    if (r.fecha >= ej.fechaNombre) { ej.nombre = r.ejercicio_nombre || ej.nombre; ej.fechaNombre = r.fecha }
    const ya = ej.puntos.find(p => p.fecha === r.fecha)
    if (!ya) ej.puntos.push({ fecha: r.fecha, pct, ok, total })
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


/** Lunes de la semana de una fecha "aaaa-mm-dd", en el mismo formato. */
function lunesDe(f: string): string {
  const d = new Date(f + 'T12:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/**
 * CARGA SEMANA A SEMANA, con aviso de picos.
 *
 * Por semana: series hechas (vale para todo, se mida como se mida), tonelaje (kg × reps,
 * solo lo que va con peso) y el RPE medio si se apunta. Las recaídas aparecen sobre todo
 * cuando la carga sube de golpe: si una semana supera en más de un 30% la media de las
 * cuatro anteriores (la relación aguda:crónica), se marca como PICO.
 */
export function cargaSemanal(registros: any[]) {
  const sem: Record<string, { series: number, tonelaje: number, rpe: number[] }> = {}
  registros.forEach(r => {
    if (!r.fecha) return
    const k = lunesDe(r.fecha)
    const w = sem[k] || (sem[k] = { series: 0, tonelaje: 0, rpe: [] })
    ;(Array.isArray(r.series) ? r.series : []).forEach((s: any) => {
      const vals = ['peso', 'banda', 'reps', 'segundos', 'metros'].map(c => s?.[c]).filter(v => v != null && String(v).trim() !== '')
      if (!vals.length) return
      w.series++
      const kg = parseFloat(s?.peso), reps = parseFloat(s?.reps)
      if (kg > 0 && reps > 0) w.tonelaje += kg * reps
      const rpe = parseFloat(s?.rpe); if (!isNaN(rpe)) w.rpe.push(rpe)
    })
  })
  const semanas = Object.keys(sem).sort()
  return semanas.map((k, i) => {
    const w = sem[k]
    const previas = semanas.slice(Math.max(0, i - 4), i).map(x => sem[x].series)
    const media = previas.length ? previas.reduce((a, b) => a + b, 0) / previas.length : 0
    return {
      semana: k, series: w.series, tonelaje: Math.round(w.tonelaje),
      rpe: w.rpe.length ? Math.round(w.rpe.reduce((a, b) => a + b, 0) / w.rpe.length * 10) / 10 : null,
      // Hacen falta al menos dos semanas previas para que "la media" signifique algo.
      ratio: previas.length >= 2 && media > 0 ? Math.round(w.series / media * 100) / 100 : null,
      pico: previas.length >= 2 && media > 0 && w.series > media * 1.3,
    }
  })
}

/**
 * ADHERENCIA AL PLAN: lo que hizo de lo que tenía programado.
 *
 * Cada día con registros de una sesión se compara con la sesión: los ejercicios del
 * plan que no dejaron registro son los que no hizo ("No lo hizo" en el taller no deja
 * registro, a propósito) o los que se le cambiaron por otro ese día. Y aparte, los
 * cambios de sesión entera con su motivo (cambios_sesion), que es el dato clínico:
 * si siempre se cambia "por dolor", algo pasa.
 */
export function adherencia(registros: any[], sesiones: Record<string, any>, cambios: any[] = [], noHechos: any[] = []) {
  const noSet = new Set(noHechos.map(n => `${n.fecha}|${n.sesion_id}|${n.ejercicio_id || 'n:' + n.ejercicio_nombre}`))
  const dias: Record<string, { sesion: string, hechos: Set<string> }> = {}
  registros.forEach(r => {
    if (!r.sesion_id || !r.fecha || !sesiones[r.sesion_id]) return
    const k = r.fecha + '|' + r.sesion_id
    const d = dias[k] || (dias[k] = { sesion: r.sesion_id, hechos: new Set() })
    d.hechos.add(r.ejercicio_id || 'n:' + r.ejercicio_nombre)
  })
  let plan = 0, hechos = 0
  let noHizo = 0, cambiados = 0
  const saltados: Record<string, { nombre: string, veces: number, de: number, no: number }> = {}
  Object.entries(dias).forEach(([clave, d]) => {
    const fecha = clave.split('|')[0]
    const ejs = (sesiones[d.sesion].partes || []).flatMap((p: any) => p.ejercicios || [])
    const vistos = new Set<string>()
    ejs.forEach((e: any) => {
      const k = e.ejercicio_id || 'n:' + e.nombre
      if (vistos.has(k)) return
      vistos.add(k); plan++
      const s = saltados[k] || (saltados[k] = { nombre: e.nombre || 'Ejercicio', veces: 0, de: 0, no: 0 })
      s.de++
      if (d.hechos.has(k)) { hechos++; return }
      s.veces++
      // Sin registro: o se marcó "no lo hizo" (guardado desde que existe no_hechos), o se le
      // cambió por otro ese día.
      if (noSet.has(`${fecha}|${d.sesion}|${k}`)) { noHizo++; s.no++ } else cambiados++
    })
  })
  const motivos: Record<string, number> = {}
  cambios.forEach(c => { const m = c.motivo === 'nota' ? 'Otro' : c.motivo ? nombreMotivo(c.motivo) : 'Sin motivo'; motivos[m] = (motivos[m] || 0) + 1 })
  return {
    clases: Object.keys(dias).length, plan, hechos, noHizo, cambiados,
    pct: plan ? Math.round(hechos / plan * 100) : null,
    saltados: Object.values(saltados).filter(s => s.veces > 0).sort((a, b) => b.veces - a.veces || b.veces / b.de - a.veces / a.de),
    cambios: cambios.length,
    motivos: Object.entries(motivos).sort((a, b) => b[1] - a[1]),
  }
}
