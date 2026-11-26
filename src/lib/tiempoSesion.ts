import { supabase } from './supabase'
import { segundosSerie, type ConfigTrabajo } from './trabajo'

// ---------------------------------------------------------------------------
// CUÁNTO DURA UNA SESIÓN Y CUÁNTO DE ESO HACE DE VERDAD.
//
// Previsto: se suman sus series, como al programarla: reps × segundos por repetición
// (o los segundos de la serie), con el descanso solo si en Ajustes › Entrenador está
// marcado contarlo (lib/trabajo, segundosSerie). En circuito, una serie por vuelta.
// Hecho: lo mismo con lo que se apuntó cada vez que se hizo esa sesión (registros
// finalizados), día a día, y la media. % = media hecha / prevista.
// ---------------------------------------------------------------------------

const n = (v: any) => { const x = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0 }

export function segundosDeSeries(cfg: ConfigTrabajo, series: any[], regimen?: string | null, descanso?: number) {
  const ejec = regimen ? [regimen] : []
  return (series || []).reduce((t, s) => t + segundosSerie(cfg, { reps: s?.reps, segundos: s?.segundos ?? s?.tiempo, ejecuciones: ejec, descanso: descanso || 0 }).seg, 0)
}

/** Lo previsto, desde las partes de la sesión (como se guardan al programarla). */
export function segundosPrevistos(cfg: ConfigTrabajo, partes: any[]): number {
  return (partes || []).reduce((t, p) => t + (p?.ejercicios || []).reduce((u: number, ej: any) => {
    const nS = p?.modo === 'circuito' ? (n(p?.vueltas) || n(ej?.series) || 1) : (n(ej?.series) || 1)
    const serie = { reps: ej?.reps, segundos: ej?.tiempo ?? ej?.segundos }
    return u + segundosDeSeries(cfg, Array.from({ length: nS }, () => serie), ej?.regimen, n(ej?.descanso))
  }, 0), 0)
}

/** Lo previsto, desde los ejercicios ya cargados en el taller: TODOS los de la sesión,
    con lo que hizo la última vez si ya lo hizo alguna (su tiempo real) y si no, lo
    planificado. No cambia al apuntar lo de hoy. */
export function segundosPrevistosTaller(cfg: ConfigTrabajo, datos: any[]): number {
  return (datos || []).reduce((t, e) => {
    const nS = (e.series || []).length || n(e.plan?.series) || 1
    const ult = Array.isArray(e.ultimo) && e.ultimo.some((x: any) => n(x?.reps) || n(x?.segundos)) ? e.ultimo : null
    const plan = (e.plan?.reps || e.plan?.tiempo) ? Array.from({ length: nS }, () => ({ reps: e.plan?.reps, segundos: e.plan?.tiempo })) : null
    const series = ult ? Array.from({ length: nS }, (_, i) => ult[i] || ult[ult.length - 1]) : plan || e.series || []
    return t + segundosDeSeries(cfg, series, e.regimen || e.plan?.regimen, n(e.plan?.descanso ?? e.descanso))
  }, 0)
}

/** Las veces que se hizo la sesión (antes de `antesDe`): segundos hechos cada día. */
export async function vecesHechas(cfg: ConfigTrabajo, sesionId: string, partes: any[], antesDe?: string, pacienteId?: string): Promise<number[]> {
  if (!sesionId) return []
  let q = supabase.from('registros_ejercicio').select('fecha,paciente_id,ejercicio_id,variante,series,regimen,created_at')
    .eq('sesion_id', sesionId).eq('finalizado', true).order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(1000)
  if (antesDe) q = q.lt('fecha', antesDe)
  if (pacienteId) q = q.eq('paciente_id', pacienteId)
  const { data } = await q
  // El descanso de cada ejercicio, el de la sesión.
  const desc: Record<string, number> = {}
  ;(partes || []).forEach(p => (p?.ejercicios || []).forEach((ej: any) => { if (ej?.ejercicio_id) desc[ej.ejercicio_id] = n(ej?.descanso) }))
  // (las claves de `desc` son además los ejercicios que tiene hoy la sesión)
  /* LO MISMO QUE LO PREVISTO, PARA QUE SE PUEDA COMPARAR:
     - solo los ejercicios que tiene HOY la sesión (si se quitó uno, no cuenta);
     - un registro por ejercicio y día (el último): al volver a finalizar una clase o con
       un borrador de más, el mismo ejercicio salía dos veces y la media pasaba del 100 %. */
  const enSesion = new Set(Object.keys(desc))
  const visto = new Set<string>()
  const porDia: Record<string, number> = {}
  ;(data || []).forEach((r: any) => {
    if (enSesion.size && !enSesion.has(r.ejercicio_id)) return
    const kr = r.paciente_id + '|' + r.fecha + '|' + r.ejercicio_id + '|' + (r.variante || '')
    if (visto.has(kr)) return
    visto.add(kr)
    const k = r.paciente_id + '|' + r.fecha
    porDia[k] = (porDia[k] || 0) + segundosDeSeries(cfg, r.series || [], r.regimen, desc[r.ejercicio_id] || 0)
  })
  return Object.values(porDia).filter(s => s > 0)
}

/** Lo hecho HOY en el taller: las series con su volumen (reps, segundos o metros)
    apuntado hoy, con sus valores. Los de «No lo hizo» no cuentan. */
export function segundosHechosHoy(cfg: ConfigTrabajo, datos: any[], noHechos: number[] = []): number {
  return (datos || []).reduce((t, e, i) => {
    if (noHechos.includes(i)) return t
    const hoy = e?.hoy || {}
    const hechas = (e.series || []).filter((_: any, si: number) => hoy[`${si}.reps`] || hoy[`${si}.segundos`] || hoy[`${si}.metros`])
    return t + segundosDeSeries(cfg, hechas, e.regimen || e.plan?.regimen, n(e.plan?.descanso ?? e.descanso))
  }, 0)
}

export const minutos = (s: number) => Math.round(s / 60)
