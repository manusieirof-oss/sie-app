/**
 * PLAN POR MAPA DE CALOR — la lógica de la mesa del torno (/torno/[id]/calor), sin pantalla.
 *
 * La mesa tiene cuatro cartas:
 *   1. Alcance: las citas reales del paciente y cuánto trabajo cabe en ellas (y sus fases).
 *   2. A qué apunta: objetivos, movimientos y zonas, con el tiempo repartido en dos niveles.
 *   3. Lo que tiene y lo que pedimos: lo hecho en 3 meses frente al plan.
 *   4. Reparto en sus citas: sesiones distintas, cada cuánto se reparte todo y la proyección.
 *
 * Se prepara FASE A FASE: cada fase tiene su propia "mesa" y solo usa sus citas.
 * Todo lo que se guarda va en un único JSON (planes_calor.datos) para poder cambiar la
 * forma sin migraciones mientras la pantalla madura.
 */

export type Capa = 'obj' | 'mov' | 'zon'
export interface Proy { m: number, baja: number, cond: 'ses' | 'sem' | 'trab', val: number }
export interface Mesa {
  z: string[]; t: string[]; m: string[]; o: string[]; extra: string[]
  wi: Record<Capa, Record<string, number>>   // peso de cada elemento dentro de su capa
  wc: Record<Capa, number>                   // peso de cada capa en el reparto global
  nses: number                               // sesiones distintas (A, B, C…)
  rep: number                                // cada cuántas sesiones se reparte TODO el trabajo
  prog: 0 | 1 | 2                            // proyección: creciente, lineal, sierra
  proy: Proy
}
export interface Fase { n: string, v: number, o?: string }
export type TipoFases = 'tiempo' | 'ses' | 'eval'
export interface PlanCalor {
  v: 1
  fases: { tipo: TipoFases, l: Fase[] }
  faseAct: number
  porFase: Record<string, Mesa>
  estadoF: Record<string, 'creada'>
}

export const mesaVacia = (): Mesa => ({
  z: [], t: [], m: [], o: [], extra: [],
  wi: { obj: {}, mov: {}, zon: {} }, wc: { obj: 1, mov: 1, zon: 1 },
  nses: 2, rep: 1, prog: 0, proy: { m: 10, baja: 5, cond: 'ses', val: 4 },
})
export const planVacio = (): PlanCalor => ({ v: 1, fases: { tipo: 'ses', l: [] }, faseAct: 0, porFase: {}, estadoF: {} })
export const clonar = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

// ---------------------------------------------------------------------------
// ZONAS DEL PLAN: por regiones, como se piensa al programar (no por articulación).
// `rig` son los grupos musculares de la malla 3D (mapaTrabajo.MUS_RIG); `art` las zonas
// articulares del mapa que también cuentan (el pie no tiene músculo propio en la malla).
// ---------------------------------------------------------------------------
export const TRENES = [
  { k: 'sup', n: 'Tren superior', d: 'incluye abdominales y lumbar' },
  { k: 'inf', n: 'Tren inferior', d: 'de la cadera para abajo' },
]
export interface ZonaPlan { k: string, n: string, t: 'sup' | 'inf', rig: string[], art: string[] }
export const ZPLAN: ZonaPlan[] = [
  { k: 'brazo', n: 'Brazo', t: 'sup', rig: ['deltoides', 'triceps', 'biceps'], art: [] },
  { k: 'espalda', n: 'Espalda', t: 'sup', rig: ['dorsal', 'trapecio', 'erectores'], art: [] },
  { k: 'pectoral', n: 'Pectoral', t: 'sup', rig: ['pectoral'], art: [] },
  { k: 'core', n: 'Core', t: 'sup', rig: ['core'], art: [] },
  { k: 'gluteo', n: 'Glúteos', t: 'inf', rig: ['gluteo'], art: [] },
  { k: 'pierna', n: 'Pierna', t: 'inf', rig: ['cuadriceps', 'isquios', 'aductores'], art: [] },
  { k: 'gemelo', n: 'Gemelo', t: 'inf', rig: ['gemelos'], art: [] },
  { k: 'pie', n: 'Pie', t: 'inf', rig: [], art: ['tobillo', 'pie'] },
]
export const nombreZona = (k: string) => ZPLAN.find(z => z.k === k)?.n || k

// ---------------------------------------------------------------------------
// TIEMPO DE TRABAJO
// La cita dura lo que diga Ajustes; de ella, el trabajo real es la media de la clínica
// (ajuste `calor_trabajo_medio`), corregida por edad y sexo: no por intensidad, solo
// cuánto trabajo efectivo cabe en la hora.
// ---------------------------------------------------------------------------
export function factorEdadSexo(fechaNac?: string | null, sexo?: string | null) {
  let edad: number | null = null
  if (fechaNac) { const d = new Date(fechaNac); if (!isNaN(+d)) edad = Math.floor((Date.now() - +d) / (365.25 * 864e5)) }
  const fe = edad == null ? 1 : edad >= 75 ? 0.82 : edad >= 65 ? 0.88 : edad >= 50 ? 0.94 : 1
  const fs = /^(m|mujer|f|femenino)$/i.test((sexo || '').trim()) ? 0.97 : 1
  return { edad, f: Math.round(fe * fs * 100) / 100 }
}

// ---------------------------------------------------------------------------
// FASES: a qué fase cae cada cita (por semanas, por número de citas o por evaluación,
// que en la práctica es un número de citas estimado).
// ---------------------------------------------------------------------------
export function faseDe(plan: PlanCalor, dias: number[], i: number): number {
  const l = plan.fases.l
  if (!l.length) return 0
  let acc = 0
  for (let k = 0; k < l.length; k++) {
    const v = +l[k].v || 0
    if (plan.fases.tipo === 'tiempo') { acc += v * 7; if (dias[i] < acc) return k } else { acc += v; if (i < acc) return k }
  }
  return -1
}
export const citasDeFase = (plan: PlanCalor, dias: number[], k: number) =>
  dias.map((_, i) => i).filter(i => faseDe(plan, dias, i) === k)

// ---------------------------------------------------------------------------
// REPARTO DEL TIEMPO en dos niveles: entre capas y, dentro de cada capa, entre elementos.
// ---------------------------------------------------------------------------
export const itemsDe = (m: Mesa, k: Capa) => (k === 'obj' ? m.o : k === 'mov' ? m.m : m.z)
export const CAPAS: { k: Capa, n: string, c: string }[] = [
  { k: 'obj', n: 'Objetivos', c: '#5A969E' }, { k: 'mov', n: 'Movimientos', c: '#9AC3C7' }, { k: 'zon', n: 'Zonas', c: '#3F7880' },
]
export const activas = (m: Mesa) => CAPAS.filter(c => itemsDe(m, c.k).length)
export function pctCapa(m: Mesa, k: Capa) {
  const a = activas(m)
  if (!a.some(c => c.k === k)) return 0
  return (m.wc[k] ?? 1) / a.reduce((n, c) => n + (m.wc[c.k] ?? 1), 0) * 100
}
export function pctItem(m: Mesa, k: Capa, x: string) {
  const it = itemsDe(m, k)
  if (!it.includes(x)) return 0
  const w = (i: string) => m.wi[k][i] ?? 1
  return w(x) / it.reduce((n, i) => n + w(i), 0) * 100
}
/** Mueve un elemento a p% y reparte el resto entre los demás en proporción (siempre suma 100). */
export function ponPctItem(m: Mesa, k: Capa, x: string, p: number) {
  const otros = itemsDe(m, k).filter(i => i !== x)
  const antes = Object.fromEntries(otros.map(i => [i, pctItem(m, k, i)]))
  const sum = otros.reduce((n, i) => n + antes[i], 0)
  if (!otros.length) p = 100
  m.wi[k][x] = p
  otros.forEach(i => { m.wi[k][i] = sum ? antes[i] / sum * (100 - p) : (100 - p) / otros.length })
}
export interface Elemento { k: string, capa: Capa, n: string }
export function lista(m: Mesa): Elemento[] {
  return [
    ...m.o.map(k => ({ k, capa: 'obj' as Capa, n: k })),
    ...m.z.map(k => ({ k, capa: 'zon' as Capa, n: nombreZona(k) })),
    ...m.m.map(k => ({ k, capa: 'mov' as Capa, n: k })),
  ]
}

// ---------------------------------------------------------------------------
// SESIONES: bloques de `rep` sesiones; en cada bloque se reparte todo el trabajo, en el
// mismo orden (A como C, B como D). Cada sesión se llena hasta el trabajo de la cita.
// ---------------------------------------------------------------------------
export const LETRA = 'ABCDEFGHIJKLMNOPQRSTUVWX'
export const COLS = ['#5A969E', '#E8A33D', '#8C6BB1', '#D9663A', '#3F7880', '#C9A227', '#6E9F5A', '#B5527A', '#4C7CB5', '#9A7B4F', '#2F8F83', '#A9ABA6']
export const colSes = (i: number) => COLS[i % COLS.length]
export function contenido(m: Mesa, si: number): Elemento[] {
  const l = lista(m)
  const R = Math.min(m.rep, m.nses), g = Math.floor(si / R), tam = Math.min(R, m.nses - g * R), pos = si - g * R
  return tam > 1 ? l.filter((_, i) => i % tam === pos) : l
}
export function bloques(m: Mesa): string[][] {
  const R = Math.min(m.rep, m.nses), out: string[][] = []
  for (let i = 0; i < m.nses; i += R) out.push(LETRA.slice(i, Math.min(i + R, m.nses)).split(''))
  return out
}
export const frecTxt = (n: number) => n === 1 ? 'en todas las citas' : n === 2 ? 'un día sí, un día no' : n === 3 ? 'un día sí y dos no' : `1 de cada ${n} citas`

// ---------------------------------------------------------------------------
// PROYECCIÓN: creciente (sube hasta el % de mejora), lineal (se mantiene) o sierra
// (sube, y cada cierto tiempo baja un poco y vuelve a subir).
// ---------------------------------------------------------------------------
export const PROGS = [
  ['Creciente', 'sube poco a poco hasta el % que marques'],
  ['Lineal', 'se mantiene; la subes tú si lo ves'],
  ['Sierra', 'sube, baja un poco cada cierto tiempo y vuelve a subir'],
] as const
export const CONDS: [Proy['cond'], string][] = [['ses', 'sesiones'], ['sem', 'semanas'], ['trab', '% del trabajo']]
export function bloque(p: Proy, n: number, porSemana: number) {
  const b = p.cond === 'ses' ? p.val : p.cond === 'sem' ? Math.round(p.val * porSemana) : Math.round(n * p.val / 100)
  return Math.max(2, b || 2)
}
export const bajaEn = (i: number, prog: number, p: Proy, n: number, porSemana: number) => prog === 2 && i > 0 && i % bloque(p, n, porSemana) === 0
/** Valor relativo de intensidad (1 = punto de partida) de la cita i de n, y su tendencia. */
export function curva(prog: number, i: number, n: number, p: Proy, porSemana: number) {
  const f = n > 1 ? i / (n - 1) : 0, m = p.m / 100, T = 1 + m * f
  let v = 1
  if (prog === 0) v = T
  if (prog === 2) { const B = bloque(p, n, porSemana), pos = (i % B) / (B - 1); v = i >= B ? T - p.baja / 100 * (1 - pos) : T }
  return { v, T, t: bajaEn(i, prog, p, n, porSemana) ? 0.8 : 1 }
}

/**
 * La línea de TODA la programación: una sola, sin cortes. Cada fase arranca donde acabó
 * la anterior; una fase sin preparar se mantiene plana hasta que se prepare.
 */
export function lineaPrograma(plan: PlanCalor, dias: number[], porSemana: number) {
  const N = dias.length, v: number[] = [], t: number[] = []
  const fases = plan.fases.l.length ? plan.fases.l.map((_, k) => k) : [0]
  let base = 1
  for (const k of fases) {
    const m = plan.porFase[k], gi = citasDeFase(plan, dias, k), n = gi.length
    let ult = base
    gi.forEach((g, j) => {
      if (m && lista(m).length) { const c = curva(m.prog, j, n, m.proy, porSemana); v[g] = base * c.v; t[g] = c.t }
      else { v[g] = base; t[g] = 1 }
      ult = v[g]
    })
    base = ult
  }
  return { v, t, N }
}

// ---------------------------------------------------------------------------
// TEXTOS
// ---------------------------------------------------------------------------
export const minTxt = (m: number) => m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`
export const segTxt = (m: number) => {
  const s = Math.round(m * 60), h = Math.floor(s / 3600), mi = Math.floor(s % 3600 / 60), se = s % 60
  return h ? `${h} h ${mi} min` : mi ? `${mi} min${se ? ' ' + String(se).padStart(2, '0') + ' s' : ''}` : `${se} s`
}
export const fechaCorta = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
