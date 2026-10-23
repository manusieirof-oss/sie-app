/**
 * MONTAR LAS SESIONES DEL MAPA DE CALOR — sin pantalla.
 *
 * De la mesa (a qué apunta, reparto en sus citas) salen N sesiones distintas. Cada una se
 * monta así:
 *   · Su ESTRUCTURA: partes (activación, parte principal, vuelta a la calma… o las que
 *     se pongan) con su % del tiempo, sus intensidades y su organización (ejercicio a
 *     ejercicio, superserie o circuito, de N en N).
 *   · En cada parte entran ejercicios de la biblioteca que ADMITEN su intensidad y que
 *     cubren lo que la mesa pide a esa sesión (zona, movimiento u objetivo), hasta llenar
 *     su tiempo de trabajo. Las series son fijas (2; 4 en fuerza): el tiempo se llena con
 *     ejercicios, no con series.
 *   · Ejecución y lateralidad salen de la mezcla de cada capacidad (Ajustes) o de la que
 *     se ponga a mano para la sesión; un ejercicio concreto se puede cambiar a mano.
 */
import { segundosPorRep, type ConfigTrabajo } from '@/lib/trabajo'
import { trabajoDe, anatomiaDe } from '@/components/TrabajoEjercicio'
import { sugerirObjetivos } from '@/lib/ejercicioObjetivos'
import { type Mesa, ZPLAN, contenido, pctCapa, pctItem, type Elemento } from '@/lib/planCalor'

export type Org = 'ejercicio' | 'superserie' | 'circuito'
export interface ParteEst { n: string, p: number, i: string[], org: Org, g: number }
export const EST_DEFECTO = (): ParteEst[] => [
  { n: 'Activación', p: 15, i: ['mov'], org: 'ejercicio', g: 3 },
  { n: 'Parte principal', p: 65, i: ['fuerza', 'hiper'], org: 'ejercicio', g: 3 },
  { n: 'Vuelta a la calma', p: 20, i: ['est', 'resp'], org: 'ejercicio', g: 3 },
]
export type Lado = 'Bilateral' | 'Unilateral' | 'Alterno'
export const LADOS: Lado[] = ['Bilateral', 'Unilateral', 'Alterno']
/** Unilateral cuenta los dos lados; alterno se va cambiando, más rápido. */
export const factorLado = (l: Lado) => (l === 'Unilateral' ? 2 : l === 'Alterno' ? 1.5 : 1)

/** Mezcla de ejecuciones por defecto de cada capacidad (ids de Ajustes › Entrenador). */
export const MIX_DEFECTO: Record<string, Record<string, number>> = {
  fmax: { conc: 50, exc: 30, iso: 20 }, fuerza: { conc: 50, exc: 30, iso: 20 }, hiper: { conc: 60, exc: 30, iso: 10 },
  fres: { conc: 70, expl: 30 }, res: { conc: 80, expl: 20 }, expl: { expl: 70, plio: 30 },
  ctrl: { iso: 60, conc: 40 }, mov: { edin: 100 }, est: { eest: 70, efnp: 30 }, equi: {}, resp: {}, lib: {},
}
/** Ejecuciones que tienen sentido en cada familia de capacidad. */
export function opcionesEje(cfg: ConfigTrabajo, intId: string): string[] {
  const fam = cfg.intensidades.find(i => i.id === intId)?.familia
  const g = fam === 'estiramiento' || fam === 'movilidad' ? 'estiramiento' : fam === 'fuerza' || fam === 'potencia' || fam === 'control' ? 'fuerza' : null
  return g ? cfg.ejecuciones.filter(e => e.grupo === g).map(e => e.id) : []
}
/** Series fijas por ahora: 4 en fuerza, 2 en lo demás. En el taller se suben o bajan. */
export const seriesDe = (intId: string) => (intId === 'fuerza' || intId === 'fmax' ? 4 : 2)

export interface MixSes { lat?: Record<string, number>, eje?: Record<string, Record<string, number>> }
export interface ConfigSes { E: Record<string, ParteEst[]>, MIX: Record<string, MixSes> }
export const configVacia = (): ConfigSes => ({ E: { todas: EST_DEFECTO() }, MIX: {} })

// ---------------------------------------------------------------------------
// CATÁLOGO: lo que cubre cada ejercicio de la biblioteca, preparado una vez.
// ---------------------------------------------------------------------------
export interface EjCat {
  id: string, nombre: string, imagen_url: string, tipo_medida: string, variantes: any[]
  etiquetas: string[], int: string[], zonas: string[], movs: string[], objs: string[], lado: Lado, porTiempo: boolean
}
export function ladoPorNombre(n: string): Lado {
  if (/altern/i.test(n)) return 'Alterno'
  if (/unilateral|a una (mano|pierna)|un brazo|una pierna|b[uú]lgara|step ?up|zancada|pistol/i.test(n)) return 'Unilateral'
  return 'Bilateral'
}
export function catalogo(ejs: any[], idx: { rigDe: Record<string, string | null>, zonaDe: Record<string, string | null> },
  nombreTag: Record<string, string>, tagsMov: Set<string>, objetivos: { id: string, nombre: string }[]): EjCat[] {
  return ejs.map(e => {
    const t = trabajoDe(e), a = anatomiaDe(e)
    const mus = a.mus.some(x => x.p) ? a.mus.filter(x => x.p) : a.mus
    const zonas = new Set<string>()
    mus.forEach(x => { const g = idx.rigDe[x.u]; const z = ZPLAN.find(Z => g && Z.rig.includes(g)); if (z) zonas.add(z.k) })
    a.acc.forEach(x => { const z = idx.zonaDe[x.a]; if (z === 'pie' || z === 'tobillo') zonas.add('pie') })
    const et: string[] = Array.isArray(e.etiquetas) ? e.etiquetas : []
    const objs = sugerirObjetivos(et, objetivos).map(id => objetivos.find(o => o.id === id)!.nombre)
    return {
      id: e.id, nombre: e.nombre, imagen_url: e.imagen_url || '', tipo_medida: e.tipo_medida || '', variantes: e.variantes || [],
      etiquetas: et, int: t.int, zonas: Array.from(zonas), movs: et.filter(i => tagsMov.has(i)).map(i => nombreTag[i]),
      objs, lado: ladoPorNombre(e.nombre), porTiempo: /tiempo/i.test(e.tipo_medida || ''),
    }
  })
}
/** ¿Admite el ejercicio esa intensidad? Sin configurar: por tiempo vale para lo suave, por reps para fuerza. */
export function admite(c: EjCat, intId: string, cfg: ConfigTrabajo) {
  if (c.int.length) return c.int.includes(intId)
  const fam = cfg.intensidades.find(i => i.id === intId)?.familia
  return c.porTiempo ? ['movilidad', 'estiramiento', 'equilibrio', 'control', 'respiracion'].includes(fam || '') : ['fuerza', 'potencia', 'control'].includes(fam || '')
}
export const cubre = (c: EjCat, el: Elemento) => (el.capa === 'zon' ? c.zonas.includes(el.k) : el.capa === 'mov' ? c.movs.includes(el.k) : c.objs.includes(el.k))

// ---------------------------------------------------------------------------
// DOSIS
// ---------------------------------------------------------------------------
export function dosis(cfg: ConfigTrabajo, c: EjCat, intId: string, eje: string | undefined, lado: Lado) {
  const I = cfg.intensidades.find(i => i.id === intId)
  const series = seriesDe(intId)
  const porSeg = c.porTiempo || (I?.repsMin == null && I?.segMin != null)
  if (porSeg) {
    const seg = Math.round(((I?.segMin ?? 30) + (I?.segMax ?? I?.segMin ?? 30)) / 2 / 5) * 5
    return { series, seg, reps: 0, trabajo: series * seg * factorLado(lado) }
  }
  const reps = I?.repsMin != null ? Math.round((I.repsMin + (I.repsMax ?? I.repsMin + 4)) / 2) : 10
  // isométrico "con pausa": la repetición normal más 2 s parado
  const sr = eje === 'iso' ? segundosPorRep(cfg, ['conc']) + 2 : segundosPorRep(cfg, eje ? [eje] : [])
  return { series, seg: 0, reps, trabajo: series * reps * sr * factorLado(lado) }
}

/** Reparte una mezcla (% por clave) entre n elementos, en orden. */
export function asigna<T extends string>(mix: Record<string, number>, n: number): (T | undefined)[] {
  const l = Object.entries(mix).filter(([, v]) => v > 0), t = l.reduce((a, [, v]) => a + v, 0)
  if (!t) return Array(n).fill(undefined)
  return Array.from({ length: n }, (_, j) => { let x = (j + 0.5) / n * t; for (const [k, v] of l) { if (x < v) return k as T; x -= v } return l[l.length - 1][0] as T })
}

// ---------------------------------------------------------------------------
// MONTAR UNA SESIÓN
// ---------------------------------------------------------------------------
export interface EjMontado { id: string, k: string, int: string, eje?: string, lado: Lado, series: number, reps: number, seg: number, trabajo: number }
export interface ParteMontada { p: ParteEst, ejs: EjMontado[], seg: number }
export interface Ov { k: string, eje?: string, lado?: Lado }

/** Peso (minutos) de lo que la mesa pide a esta sesión. */
export function pideSesion(m: Mesa, si: number, minSes: number) {
  const its = contenido(m, si)
  const w = its.map(x => pctCapa(m, x.capa) * pctItem(m, x.capa, x.k))
  const t = w.reduce((a, v) => a + v, 0) || 1
  return its.map((x, i) => ({ el: x, min: minSes * w[i] / t }))
}

export function montarSesion(o: {
  m: Mesa, si: number, partes: ParteEst[], cat: EjCat[], cfg: ConfigTrabajo, minSes: number,
  mix: MixSes, elegido: Record<string, string[]>, ov: Record<string, Ov>, semilla: number,
}): ParteMontada[] {
  const { m, si, partes, cat, cfg, minSes, mix, elegido, ov, semilla } = o
  const pide = pideSesion(m, si, minSes)
  const falta = new Map(pide.map(x => [x.el.capa + '|' + x.el.k, x.min * 60]))
  const usados = new Set<string>()
  const azar = (id: string) => { let h = semilla * 9301; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 233280; return h / 233280 }
  return partes.map((p, pi) => {
    const key = `${si}-${pi}`, meta = minSes * 60 * p.p / 100
    const intDe = (c: EjCat) => p.i.find(i => admite(c, i, cfg)) || p.i[0]
    // Puntuación: cuánto de lo que aún falta cubre; un poco de azar para que "rehacer" cambie
    const nota = (c: EjCat) => pide.reduce((s, x) => s + (cubre(c, x.el) ? (falta.get(x.el.capa + '|' + x.el.k) || 0) : 0), 0) + azar(c.id) * 30
    const candidatos = () => cat.filter(c => !usados.has(c.id) && p.i.some(i => admite(c, i, cfg)))
    let lista = elegido[key]
    const calc = (l: string[]) => {
      // ejecución: por capacidad, con la mezcla de la sesión (a mano) o la de Ajustes
      const porInt: Record<string, number[]> = {}
      l.forEach((k, j) => { const c = cat.find(x => x.id === k); if (c) (porInt[intDe(c)] ||= []).push(j) })
      const ejes: (string | undefined)[] = []
      Object.entries(porInt).forEach(([ii, js]) => { const a = asigna(mix.eje?.[ii] || MIX_DEFECTO[ii] || {}, js.length); js.forEach((j, n) => { ejes[j] = a[n] }) })
      const lados = mix.lat ? asigna<Lado>(mix.lat, l.length) : null
      return l.map((k, j): EjMontado | null => {
        const c = cat.find(x => x.id === k); if (!c) return null
        const id = `${key}-${j}`, v = ov[id]?.k === k ? ov[id] : null, ii = intDe(c)
        const eje = v?.eje || ejes[j], lado = (v?.lado || lados?.[j] || c.lado) as Lado
        return { id, k, int: ii, eje, lado, ...dosis(cfg, c, ii, eje, lado) }
      }).filter(Boolean) as EjMontado[]
    }
    if (!lista) {
      lista = []
      // se llena hasta su tiempo con lo que más cubre de lo que falta
      while (lista.length < 8) {
        const tot = calc(lista).reduce((n, e) => n + e.trabajo, 0)
        if (tot >= meta * 0.9) break
        const c = candidatos().filter(x => !lista!.includes(x.id)).sort((a, b) => nota(b) - nota(a))[0]
        if (!c) break
        lista.push(c.id)
        const t = calc([c.id])[0]?.trabajo || 0
        pide.forEach(x => { if (cubre(c, x.el)) { const kk = x.el.capa + '|' + x.el.k; falta.set(kk, Math.max(0, (falta.get(kk) || 0) - t)) } })
      }
      elegido[key] = lista
    }
    lista.forEach(k => usados.add(k))
    const ejs = calc(lista)
    return { p, ejs, seg: ejs.reduce((n, e) => n + e.trabajo, 0) }
  })
}

/** Alternativas para cambiar un ejercicio: que admitan la intensidad de la parte, por lo que comparten. */
export function alternativas(cat: EjCat[], k: string, p: ParteEst, cfg: ConfigTrabajo) {
  const c = cat.find(x => x.id === k)
  if (!c) return []
  const mios = [...c.zonas.map(z => 'z' + z), ...c.movs.map(x => 'm' + x), ...c.objs.map(x => 'o' + x)]
  return cat.filter(x => x.id !== k && p.i.some(i => admite(x, i, cfg))).map(x => {
    const sus = [...x.zonas.map(z => 'z' + z), ...x.movs.map(y => 'm' + y), ...x.objs.map(y => 'o' + y)]
    const com = mios.filter(y => sus.includes(y)).length
    return { c: x, enc: Math.round(com / Math.max(1, mios.length, sus.length) * 100) }
  }).filter(a => a.enc > 0).sort((a, b) => b.enc - a.enc).slice(0, 40)
}

// ---------------------------------------------------------------------------
// A SESIÓN DE LA APP (sesiones.partes)
// ---------------------------------------------------------------------------
export function aPartes(mont: ParteMontada[], cat: EjCat[], cfg: ConfigTrabajo, objetivos: { id: string, nombre: string }[]) {
  const item = (e: EjMontado, grupo?: string) => {
    const c = cat.find(x => x.id === e.k)!, I = cfg.intensidades.find(i => i.id === e.int)
    return {
      ejercicio_id: c.id, nombre: c.nombre, variante: '', capacidad: I?.nombre || '',
      regimen: cfg.ejecuciones.find(x => x.id === e.eje)?.nombre || 'Concéntrico',
      series: String(e.series), reps: e.reps ? String(e.reps) : '', peso: '', tiempo: e.seg ? String(e.seg) : '',
      descanso: I?.descanso != null ? String(I.descanso) : '', nota: '',
      lado: e.lado, imagen_url: c.imagen_url, variantes_disp: c.variantes || [], tipo_medida: c.tipo_medida,
      objetivos: objetivos.filter(o => c.objs.includes(o.nombre)).map(o => o.id), ...(grupo ? { grupo } : {}),
    }
  }
  const out: any[] = []
  mont.forEach(x => {
    const g = Math.max(2, x.p.g || 3)
    if (x.p.org === 'circuito' && x.ejs.length > 1) {
      // un circuito por cada grupo de N ejercicios
      for (let i = 0; i < x.ejs.length; i += g) {
        const tr = x.ejs.slice(i, i + g)
        out.push({ nombre: x.ejs.length > g ? `${x.p.n} · circuito ${i / g + 1}` : x.p.n, modo: 'circuito', vueltas: Math.max(...tr.map(e => e.series)), ejercicios: tr.map(e => item(e)) })
      }
    } else if (x.p.org === 'superserie' && x.ejs.length > 1) {
      out.push({ nombre: x.p.n, modo: 'superserie', ejercicios: x.ejs.map((e, i) => item(e, String.fromCharCode(65 + Math.floor(i / g)))) })
    } else out.push({ nombre: x.p.n, ejercicios: x.ejs.map(e => item(e)) })
  })
  return out
}
