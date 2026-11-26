import { supabase } from './supabase'
import { segundosSerie, type ConfigTrabajo } from './trabajo'

// ---------------------------------------------------------------------------
// CUÁNTO DURA UNA SESIÓN Y CUÁNTO DE ESO HACE DE VERDAD.
//
// Previsto: se suman sus series, como al programarla: reps × segundos por repetición
// (o los segundos de la serie), con el descanso solo si en Ajustes › Entrenador está
// marcado contarlo (lib/trabajo, segundosSerie). En circuito, una serie por vuelta.
//
// CADA DÍA SE COMPARA CON LO QUE TOCABA ESE DÍA. Si la sesión cambia (se quita o se
// cambia un ejercicio), comparar lo de marzo con la sesión de hoy daba medias raras
// (por encima del 100 % o muy bajas). Ahora, de cada vez que la hizo:
//   hecho    = lo que apuntó (series con sus reps o segundos), un registro por ejercicio;
//   previsto = lo que tocaba de esos mismos ejercicios (lo de la sesión de hoy si lo
//              sigue teniendo; si no, lo que hizo) + lo que marcó «No lo hizo».
//   % del día = hecho / previsto. La media es la media de esos %.
// ---------------------------------------------------------------------------

const n = (v: any) => { const x = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0 }

export function segundosDeSeries(cfg: ConfigTrabajo, series: any[], regimen?: string | null, descanso?: number) {
  const ejec = regimen ? [regimen] : []
  return (series || []).reduce((t, s) => t + segundosSerie(cfg, { reps: s?.reps, segundos: s?.segundos ?? s?.tiempo, ejecuciones: ejec, descanso: descanso || 0 }).seg, 0)
}

/** Lo previsto de cada ejercicio, desde las partes de la sesión (como se programa). */
export function previstoPorEjercicioPartes(cfg: ConfigTrabajo, partes: any[]): Record<string, number> {
  const m: Record<string, number> = {}
  ;(partes || []).forEach(p => (p?.ejercicios || []).forEach((ej: any) => {
    const nS = p?.modo === 'circuito' ? (n(p?.vueltas) || n(ej?.series) || 1) : (n(ej?.series) || 1)
    const serie = { reps: ej?.reps, segundos: ej?.tiempo ?? ej?.segundos }
    const s = segundosDeSeries(cfg, Array.from({ length: nS }, () => serie), ej?.regimen, n(ej?.descanso))
    const k = ej?.ejercicio_id || ej?.nombre
    if (k) m[k] = (m[k] || 0) + s
  }))
  return m
}

/** Lo previsto de cada ejercicio cargado en el taller: con lo que hizo la última vez si ya
    lo hizo (su tiempo real) y si no, lo planificado. No cambia al apuntar lo de hoy. */
export function previstoPorEjercicioTaller(cfg: ConfigTrabajo, datos: any[]): Record<string, number> {
  const m: Record<string, number> = {}
  ;(datos || []).forEach(e => {
    const nS = (e.series || []).length || n(e.plan?.series) || 1
    const ult = Array.isArray(e.ultimo) && e.ultimo.some((x: any) => n(x?.reps) || n(x?.segundos)) ? e.ultimo : null
    const plan = (e.plan?.reps || e.plan?.tiempo) ? Array.from({ length: nS }, () => ({ reps: e.plan?.reps, segundos: e.plan?.tiempo })) : null
    const series = ult ? Array.from({ length: nS }, (_, i) => ult[i] || ult[ult.length - 1]) : plan || e.series || []
    const s = segundosDeSeries(cfg, series, e.regimen || e.plan?.regimen, n(e.plan?.descanso ?? e.descanso))
    const k = e.ejercicio_id || e.nombre
    if (k) m[k] = (m[k] || 0) + s
  })
  return m
}
export const sumar = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0)

/** El descanso entre series de cada ejercicio (para medir lo hecho igual que lo previsto). */
export function descansos(datosOPartes: any[], taller: boolean): Record<string, number> {
  const m: Record<string, number> = {}
  if (taller) (datosOPartes || []).forEach(e => { const k = e.ejercicio_id || e.nombre; if (k) m[k] = n(e.plan?.descanso ?? e.descanso) })
  else (datosOPartes || []).forEach(p => (p?.ejercicios || []).forEach((ej: any) => { const k = ej?.ejercicio_id || ej?.nombre; if (k) m[k] = n(ej?.descanso) }))
  return m
}

/** Lo hecho HOY en el taller: series con su volumen apuntado hoy. «No lo hizo» no cuenta. */
export function segundosHechosHoy(cfg: ConfigTrabajo, datos: any[], noHechos: number[] = []): number {
  return (datos || []).reduce((t, e, i) => {
    if (noHechos.includes(i)) return t
    const hoy = e?.hoy || {}
    const hechas = (e.series || []).filter((_: any, si: number) => hoy[`${si}.reps`] || hoy[`${si}.segundos`] || hoy[`${si}.metros`])
    return t + segundosDeSeries(cfg, hechas, e.regimen || e.plan?.regimen, n(e.plan?.descanso ?? e.descanso))
  }, 0)
}

export type DiaSesion = { fecha: string, hecho: number, previsto: number, pct: number }

/** Cada vez que se hizo la sesión (antes de `antesDe`), con lo hecho y lo que tocaba. */
export async function historialSesion(cfg: ConfigTrabajo, sesionId: string, previstoEj: Record<string, number>, descEj: Record<string, number>, antesDe?: string, pacienteId?: string): Promise<DiaSesion[]> {
  if (!sesionId) return []
  let q = supabase.from('registros_ejercicio').select('fecha,paciente_id,ejercicio_id,ejercicio_nombre,variante,series,regimen,created_at')
    .eq('sesion_id', sesionId).eq('finalizado', true).order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(1500)
  let qn = supabase.from('no_hechos').select('fecha,paciente_id,ejercicio_id,ejercicio_nombre').eq('sesion_id', sesionId).limit(1500)
  if (antesDe) { q = q.lt('fecha', antesDe); qn = qn.lt('fecha', antesDe) }
  if (pacienteId) { q = q.eq('paciente_id', pacienteId); qn = qn.eq('paciente_id', pacienteId) }
  const [{ data }, { data: nh }] = await Promise.all([q, qn])
  const dias: Record<string, { fecha: string, hecho: number, previsto: number }> = {}
  const visto = new Set<string>()
  ;(data || []).forEach((r: any) => {
    const kr = r.paciente_id + '|' + r.fecha + '|' + (r.ejercicio_id || r.ejercicio_nombre) + '|' + (r.variante || '')
    if (visto.has(kr)) return
    visto.add(kr)
    const k = r.paciente_id + '|' + r.fecha
    const d = dias[k] ||= { fecha: r.fecha, hecho: 0, previsto: 0 }
    const hecho = segundosDeSeries(cfg, r.series || [], r.regimen, descEj[r.ejercicio_id] ?? descEj[r.ejercicio_nombre] ?? 0)
    const tocaba = previstoEj[r.ejercicio_id] ?? previstoEj[r.ejercicio_nombre] ?? hecho
    d.hecho += Math.min(hecho, tocaba * 1.5)   // un día de más no tapa a los demás
    d.previsto += tocaba
  })
  ;(nh || []).forEach((r: any) => {
    const k = r.paciente_id + '|' + r.fecha
    if (!dias[k]) return
    dias[k].previsto += previstoEj[r.ejercicio_id] ?? previstoEj[r.ejercicio_nombre] ?? 0
  })
  return Object.values(dias).filter(d => d.previsto > 0)
    .map(d => ({ ...d, pct: Math.min(100, Math.round(d.hecho / d.previsto * 100)) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export const minutos = (s: number) => Math.round(s / 60)
