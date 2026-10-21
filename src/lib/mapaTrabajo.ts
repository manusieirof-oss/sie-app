/**
 * EL MAPA DE TRABAJO DE UN PACIENTE: cuánto de lo que hace va a cada zona del cuerpo.
 *
 * Todo en SEGUNDOS DE TRABAJO EFECTIVO (lib/trabajo): así un 3×10 y una plancha de 45 s
 * se pueden sumar y repartir en porcentajes.
 *
 * Cada serie anotada en el taller (registros_ejercicio) se reparte entre las parejas
 * articulación + movimiento de su ejercicio (`ejercicios.anatomia`):
 *   · Capa PRINCIPAL: solo lo marcado ★. Es "a qué va" el ejercicio.
 *   · Capa COMBINADA: también lo secundario, a medio peso. Es todo lo que mueve.
 * Los músculos se reparten igual, para teñir la malla.
 *
 * La intensidad de cada serie la pone la dosis (3 reps = fuerza máxima), limitada a las
 * que admite el ejercicio; la ejecución, la apuntada en la sala si se cambió, o la del
 * ejercicio.
 */
import { categoriaDe } from '@/lib/etiquetas'
import { intensidadPorReps, segundosSerie, type ConfigTrabajo } from '@/lib/trabajo'
import { trabajoDe, anatomiaDe } from '@/components/TrabajoEjercicio'

/** Zonas del mapa: dónde se pintan (huesos del modelo) y qué articulaciones caen en cada una. */
export interface Zona { k: string, n: string, huesos: string[], off?: [number, number, number], art: string[] }
export const ZONAS: Zona[] = [
  { k: 'maxilar', n: 'Maxilar', huesos: ['cabeza'], off: [0, 1, 3], art: ['Maxilar'] },
  { k: 'cervical', n: 'Cervical', huesos: ['cuello'], art: ['Cervical'] },
  { k: 'hombro', n: 'Hombro', huesos: ['brazoD', 'brazoI'], art: ['Hombro', 'Escapular', 'Glenohumeral', 'Escapulotorácica', 'Escápulotorácica', 'Acromioclavicular', 'Esternoclavicular'] },
  { k: 'dorsal', n: 'Dorsal y tórax', huesos: ['pecho'], art: ['Dorsal', 'Costal', 'Columna'] },
  { k: 'lumbar', n: 'Lumbar', huesos: ['lumbar'], off: [0, -2, 0], art: ['Lumbar'] },
  { k: 'codo', n: 'Codo', huesos: ['antebrazoD', 'antebrazoI'], art: ['Codo'] },
  { k: 'muneca', n: 'Muñeca', huesos: ['manoD', 'manoI'], art: ['Muñeca'] },
  { k: 'mano', n: 'Mano', huesos: ['manoD', 'manoI'], off: [0, -4, 0.5], art: ['Mano'] },
  { k: 'cadera', n: 'Cadera', huesos: ['musloD', 'musloI'], art: ['Cadera', 'Coxofemoral', 'Lumbosacra', 'Sacroilíaca'] },
  { k: 'rodilla', n: 'Rodilla', huesos: ['piernaD', 'piernaI'], art: ['Rodilla'] },
  { k: 'tobillo', n: 'Tobillo', huesos: ['pieD', 'pieI'], art: ['Tobillo'] },
  { k: 'pie', n: 'Pie', huesos: ['pieD', 'pieI'], off: [0, -3, 3], art: ['Pie'] },
]

/** Músculo de la biblioteca → grupo pintado en la malla (los de cuerpo-rig.json). */
export const MUS_RIG: Record<string, string> = {
  'Cuádriceps': 'cuadriceps', 'Sartorio': 'cuadriceps',
  'Glúteo': 'gluteo', 'Glúteo - Piramidal': 'gluteo', 'Abductor - TFL': 'gluteo',
  'Isquiotibial': 'isquios', 'Aductores': 'aductores',
  'Tríceps Sural': 'gemelos', 'Tibial': 'gemelos', 'Peroneos': 'gemelos',
  'Abdomen': 'core', 'Psoas': 'core', 'Diafragma': 'core', 'Intercostales': 'core',
  'Espalda': 'erectores', 'Erectores Espinales': 'erectores', 'Multífidos': 'erectores', 'Cuadrado lumbar': 'erectores', 'Semiespinoso': 'erectores',
  'Dorsal Ancho': 'dorsal', 'Romboides Mayor': 'dorsal', 'Romboides Menor': 'dorsal', 'Serrato Inferior': 'dorsal', 'Serrato Superior': 'dorsal',
  'Pectoral': 'pectoral', 'Hombro': 'deltoides',
  'Trapecio': 'trapecio', 'Cervical': 'trapecio', 'Elevador de la Escápula': 'trapecio',
  'Tríceps': 'triceps',
  'Bíceps': 'biceps', 'Braquioradial': 'biceps', 'Flexor de muñeca': 'biceps', 'Extensor de muñecas': 'biceps', 'Flexor de Dedos': 'biceps', 'Extensor de Dedos': 'biceps',
}

export interface Acumulado { seg: number, porMov: Record<string, number>, porInt: Record<string, number>, porEje: Record<string, number>, porArt: Record<string, number>, porEj: Record<string, number> }
const vacio = (): Acumulado => ({ seg: 0, porMov: {}, porInt: {}, porEje: {}, porArt: {}, porEj: {} })
const suma = (o: Record<string, number>, k: string, v: number) => { o[k] = (o[k] || 0) + v }

export interface Mapa {
  total: number                     // segundos que cuentan como carga (y pasan los filtros)
  estimado: number                  // de ellos, calculados con el "aguanta lo que puedas" por defecto
  liberacion: number                // segundos de intensidades sin carga (masaje…): pintan, no suman
  sinAnatomia: number               // trabajo de ejercicios sin anatomía: no se puede repartir
  zonas: Record<string, Acumulado>
  musculos: Record<string, number>  // grupo de la malla → segundos
  porInt: Record<string, number>
  porEje: Record<string, number>
  sesiones: number
}

export interface Filtros { int: string[], eje: string[], combinada: boolean }

/** Registro de la sala tal como se lee (registros_ejercicio). */
export interface Registro { fecha: string, ejercicio_id: string | null, series: any[] | null, regimen?: string | null, sesion_id?: string | null }

/** Índices de etiquetas que hacen falta para repartir, construidos una vez. */
export function indices(etiquetas: any[]) {
  const porId: Record<string, any> = {}
  etiquetas.forEach(e => { porId[e.id] = e })
  const subir = (id: string) => { const r: any[] = []; let e = porId[id]; const v = new Set<string>(); while (e && !v.has(e.id)) { v.add(e.id); r.push(e); e = porId[e.padre_id] } return r }
  const zonaDe: Record<string, string | null> = {}
  const rigDe: Record<string, string | null> = {}
  etiquetas.forEach(e => {
    const cat = categoriaDe(etiquetas, e)
    if (cat === 'articulacion') {
      const cadena = subir(e.id)
      let z: string | null = null
      for (const x of cadena) { const zz = ZONAS.find(Z => Z.art.includes(x.nombre)); if (zz) { z = zz.k; break } }
      zonaDe[e.id] = z
    } else if (cat === 'musculo') {
      let g: string | null = null
      for (const x of subir(e.id)) { if (MUS_RIG[x.nombre]) { g = MUS_RIG[x.nombre]; break } }
      rigDe[e.id] = g
    }
  })
  return { zonaDe, rigDe, porId }
}

const num = (v: any) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0 }

/**
 * Intensidad de una serie: la que pone la dosis, entre las que admite el ejercicio.
 *  · Por repeticiones: el tramo de fuerza de esas reps si lo admite; si es explosivo o
 *    pliométrico y admite "explosiva", esa; si no, la primera que admita.
 *  · Por tiempo: lo que no es fuerza (movilidad, estiramiento, equilibrio…) va antes;
 *    si solo admite fuerza, la de más resistencia que admita.
 */
export function intensidadSerie(cfg: ConfigTrabajo, admite: string[], reps: number, seg: number, ejes: string[]): string {
  const ints = cfg.intensidades
  const ok = (id: string) => admite.length === 0 || admite.includes(id)
  const rapido = ejes.some(e => /explos|plio/i.test(cfg.ejecuciones.find(x => x.id === e)?.nombre || e))
  if (reps > 0 && seg <= 0) {
    if (rapido) { const ex = ints.find(i => i.familia === 'potencia' && ok(i.id)); if (ex) return ex.id }
    const r = intensidadPorReps(cfg, reps)
    if (r && ok(r.id)) return r.id
    const otra = ints.find(i => admite.includes(i.id))
    if (otra) return otra.id
    return r?.id || 'sin'
  }
  const noFuerza = ints.find(i => i.familia !== 'fuerza' && i.familia !== 'potencia' && admite.includes(i.id))
  if (noFuerza) return noFuerza.id
  const fuerzas = ints.filter(i => i.familia === 'fuerza' && ok(i.id))
  return fuerzas[fuerzas.length - 1]?.id || admite[0] || 'sin'
}

/** Calcula el mapa con unos filtros. Es barato: se rehace al tocar un filtro. */
export function calcularMapa(regs: Registro[], ejercicios: Record<string, any>, idx: ReturnType<typeof indices>, cfg: ConfigTrabajo, f: Filtros): Mapa {
  const m: Mapa = { total: 0, estimado: 0, liberacion: 0, sinAnatomia: 0, zonas: {}, musculos: {}, porInt: {}, porEje: {}, sesiones: 0 }
  const ses = new Set<string>()
  for (const r of regs) {
    const ej = r.ejercicio_id ? ejercicios[r.ejercicio_id] : null
    if (!ej || !Array.isArray(r.series)) continue
    const t = trabajoDe(ej), a = anatomiaDe(ej)
    // "Concéntrico" es lo que la sesión pone por defecto: no dice nada. Cualquier otro
    // régimen sí se eligió a propósito en la sala y manda sobre el del ejercicio.
    const reg = (r.regimen || '').trim()
    const ejes = reg && !/^conc[eé]ntrico$/i.test(reg) ? [cfg.ejecuciones.find(e => e.nombre.toLowerCase() === reg.toLowerCase())?.id || reg] : t.eje
    const porTiempo = /tiempo|seg|iso/i.test(ej.tipo_medida || '')
    for (const s of r.series) {
      const reps = num(s?.reps), segs = num(s?.segundos)
      const { seg, estimado } = segundosSerie(cfg, { reps, segundos: segs, ejecuciones: ejes, aguanta: !reps && !segs && porTiempo })
      if (seg <= 0) continue
      const intId = intensidadSerie(cfg, t.int, reps, segs, ejes)
      if (f.int.length && !f.int.includes(intId)) continue
      if (f.eje.length && !ejes.some(e => f.eje.includes(e))) continue
      const intCfg = cfg.intensidades.find(i => i.id === intId)
      if (r.sesion_id) ses.add(r.sesion_id + r.fecha)
      if (intCfg && !intCfg.carga) { m.liberacion += seg; continue }
      m.total += seg; if (estimado) m.estimado += seg
      suma(m.porInt, intId, seg); ejes.forEach(e => suma(m.porEje, e, seg / (ejes.length || 1)))

      // Reparto entre articulaciones: principal 1, secundario 0,5 (solo en la combinada).
      const acc = a.acc.filter(x => idx.zonaDe[x.a])
      const usar = f.combinada ? acc : (acc.some(x => x.p) ? acc.filter(x => x.p) : acc)
      const peso = (p: boolean) => (f.combinada && !p ? 0.5 : 1)
      const tot = usar.reduce((n, x) => n + peso(x.p), 0)
      if (!tot) { m.sinAnatomia += seg; continue }
      for (const x of usar) {
        const v = seg * peso(x.p) / tot
        const z = idx.zonaDe[x.a]!
        const Z = (m.zonas[z] ||= vacio())
        Z.seg += v
        suma(Z.porMov, x.m || 'sin', v); suma(Z.porInt, intId, v); suma(Z.porArt, x.a, v); suma(Z.porEj, ej.id, v)
        ejes.forEach(e => suma(Z.porEje, e, v / (ejes.length || 1)))
      }
      // Músculos, igual.
      const mus = a.mus.filter(x => idx.rigDe[x.u])
      const usarM = f.combinada ? mus : (mus.some(x => x.p) ? mus.filter(x => x.p) : mus)
      const totM = usarM.reduce((n, x) => n + peso(x.p), 0)
      if (totM) for (const x of usarM) suma(m.musculos, idx.rigDe[x.u]!, seg * peso(x.p) / totM)
    }
  }
  m.sesiones = ses.size
  return m
}

/** Carga semanal: minutos de las últimas semanas y si la última sube mucho sobre la media. */
export function cargaSemanal(regs: Registro[], ejercicios: Record<string, any>, cfg: ConfigTrabajo, semanas = 6) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const min = new Array(semanas).fill(0), kg = new Array(semanas).fill(0)
  for (const r of regs) {
    const ej = r.ejercicio_id ? ejercicios[r.ejercicio_id] : null
    if (!ej || !Array.isArray(r.series)) continue
    const d = Math.floor((hoy.getTime() - new Date(r.fecha + 'T00:00:00').getTime()) / 86400000)
    const w = Math.floor(d / 7)
    if (w < 0 || w >= semanas) continue
    const t = trabajoDe(ej)
    for (const s of r.series) {
      const reps = num(s?.reps), segs = num(s?.segundos)
      const { seg } = segundosSerie(cfg, { reps, segundos: segs, ejecuciones: t.eje, aguanta: !reps && !segs && /tiempo|seg|iso/i.test(ej.tipo_medida || '') })
      min[w] += seg / 60
      kg[w] += num(s?.peso) * reps
    }
  }
  const previas = min.slice(1, 5).filter(x => x > 0)
  const media = previas.length ? previas.reduce((a, b) => a + b, 0) / previas.length : 0
  const ratio = media ? min[0] / media : null
  return { min: min.map(x => Math.round(x)), kg: kg.map(x => Math.round(x)), media: Math.round(media), ratio, pico: ratio != null && ratio > 1.3 }
}
