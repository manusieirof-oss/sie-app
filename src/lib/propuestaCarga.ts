import { supabase } from './supabase'
import { lineaPrograma, faseDe, lista, bajaEn, citasDeFase, PROGS, type PlanCalor } from './planCalor'

// ---------------------------------------------------------------------------
// PROPONER CARGA EN EL TALLER, desde la PROYECCION del mapa de calor del paciente.
//
// No es una regla fija de "si le sobro, sube": sube solo si la planificacion lo dice.
// La mesa del mapa de calor tiene, fase a fase, una proyeccion (Creciente, Lineal,
// Sierra) que da la intensidad relativa de cada cita. Hoy se propone lo de la ultima
// vez × (intensidad de hoy / intensidad de aquel dia):
//   · Sin mapa de calor, o Lineal: no se propone nada (sale lo de la ultima vez).
//   · Solo ejercicios de fuerza: movilidad, estiramiento, respiracion... no se tocan.
//   · Sobre una zona con molestia no se sube (bajar si, si toca descarga).
// La propuesta NO se impone: son las cifras de partida, se cambian como siempre.
// ---------------------------------------------------------------------------

export type Propuesta = { r: number, pct: number, tipo: 'sube' | 'baja', motivo: string }

/** Lee el plan del paciente y devuelve, para la fecha de la ultima vez, la propuesta de hoy. */
export async function planDeCarga(pid: string, hoy: string): Promise<((fechaUlt: string) => Propuesta | null) | null> {
  const { data: pl } = await supabase.from('planes_calor').select('*').eq('paciente_id', pid).order('actualizado', { ascending: false }).limit(1)
  const fila: any = pl?.[0]
  const plan: PlanCalor | null = fila?.datos || null
  if (!plan || !Object.values(plan.porFase || {}).some((m: any) => m && lista(m).length)) return null
  // Desde cuando cuenta la linea: el dia que se hizo el plan.
  const inicio: string = (plan as any).inicio || String(fila.created_at || fila.actualizado || '').slice(0, 10)
  if (!inicio) return null
  const { data: cs } = await supabase.from('citas').select('fecha,tipo').eq('paciente_id', pid).gte('fecha', inicio)
    .neq('estado', 'cancelada').order('fecha').order('hora')
  const citas = (cs || []).filter((c: any) => !/valora/i.test(c.tipo || ''))
  if (!citas.length) return null
  const d0 = +new Date(citas[0].fecha + 'T12:00:00')
  const dias = citas.map((c: any) => Math.round((+new Date(c.fecha + 'T12:00:00') - d0) / 864e5))
  const porSemana = citas.length / Math.max(1, (dias[dias.length - 1] + 1) / 7)
  const { v } = lineaPrograma(plan, dias, porSemana)
  /** La cita de ese dia (o la ultima antes). */
  const idx = (f: string) => { let k = -1; citas.forEach((c: any, i: number) => { if (c.fecha <= f) k = i }); return k }
  const iHoy = idx(hoy)
  if (iHoy < 0 || v[iHoy] == null) return null
  const fase = faseDe(plan, dias, iHoy)
  const mesa: any = plan.porFase[fase < 0 ? 0 : fase]
  if (!mesa || mesa.prog === 1) return null
  const nF = citasDeFase(plan, dias, fase < 0 ? 0 : fase).length
  const posF = citasDeFase(plan, dias, fase < 0 ? 0 : fase).indexOf(iHoy)
  const descarga = mesa.prog === 2 && posF >= 0 && bajaEn(posF, 2, mesa.proy, nF, porSemana)
  return (fechaUlt: string) => {
    const iU = fechaUlt < inicio ? -1 : idx(fechaUlt)
    const vU = iU < 0 ? 1 : v[iU]
    if (!vU || iU === iHoy) return null
    const r = v[iHoy] / vU
    if (Math.abs(r - 1) < 0.005) return null
    const nombre = PROGS[mesa.prog]?.[0]?.toLowerCase() || ''
    return { r, pct: Math.round((r - 1) * 1000) / 10, tipo: r > 1 ? 'sube' : 'baja',
      motivo: r < 1 && descarga ? 'toca descarga (sierra)' : r > 1 ? `${nombre} · plan del mapa de calor` : `${nombre} · baja el plan` }
  }
}

const NO_FUERZA = /movilidad|estiramiento|respiraci|liberaci|masaje|equilibrio|propiocep|control/i
/** Solo se propone en ejercicios de fuerza. */
export const admitePropuesta = (e: any) => !NO_FUERZA.test(String(e?.capacidad || e?.plan?.capacidad || ''))

const num = (x: any) => { const n = parseFloat(String(x ?? '').replace(',', '.')); return isFinite(n) ? n : null }
/** Redondeo al material: de 0,5 en 0,5 kg con poco peso, de 1 en 1 hasta 40, de 2,5 en 2,5 despues. */
const redondeaKg = (x: number) => { const p = x < 10 ? 0.5 : x < 40 ? 1 : 2.5; return Math.round(x / p) * p }

/** Las series de partida con la propuesta aplicada. Con kg, el peso; sin kg, reps o segundos. */
export function proponerSeries(series: any[], r: number, noSubir: boolean) {
  let cambio = false
  const out = (series || []).map((s: any) => {
    const p = num(s?.peso)
    if (p != null && p > 0) {
      let n = redondeaKg(p * r); if (noSubir && n > p) n = p
      if (n !== p) { cambio = true; return { ...s, peso: String(n).replace('.', ',') } }
      return s
    }
    const rp = num(s?.reps)
    if (rp != null && rp > 0) {
      let n = Math.round(rp * r); if (noSubir && n > rp) n = rp
      if (n !== rp) { cambio = true; return { ...s, reps: String(n) } }
      return s
    }
    const sg = num(s?.segundos)
    if (sg != null && sg > 0) {
      let n = Math.round(sg * r / 5) * 5; if (noSubir && n > sg) n = sg
      if (n !== sg) { cambio = true; return { ...s, segundos: String(n) } }
    }
    return s
  })
  return { series: out, cambio }
}
