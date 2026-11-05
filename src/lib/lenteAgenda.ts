import { supabase } from '@/lib/supabase'
import { hoyISO } from '@/lib/fechas'
import { unaCuotaPorPacienteYMes } from '@/lib/bonos'

// ---------------------------------------------------------------------------
// LA LENTE DE LA AGENDA: el mismo botón único que en la Biblioteca. Cada toque cambia
// lo que se ve junto al nombre de cada persona, sin llenar la cabecera de iconos:
//   · Normal      — como siempre.
//   · Sesión      — la sesión que tiene ese día.
//   · Asistencia  — % de clases a las que vino (este mes y en total). Dentro de cada
//                   grupo se ordenan de más a menos.
//   · Cobro       — si la cuota del mes está pagada, pendiente, en impago o no tiene.
//   · Alertas     — sus alertas activas, escritas.
// Aquí solo se traen los datos; pintarlos es cosa de VistaDia.
// ---------------------------------------------------------------------------

export type LenteAgenda = 'normal' | 'sesion' | 'asistencia' | 'cobro' | 'alertas'
export const LENTES_AGENDA: { k: LenteAgenda, t: string, ic: string }[] = [
  { k: 'normal', t: 'Normal', ic: 'agenda' },
  { k: 'sesion', t: 'Sesión', ic: 'fuerza' },
  { k: 'asistencia', t: 'Asistencia', ic: 'porcentaje' },
  { k: 'cobro', t: 'Cobro', ic: 'euro' },
  { k: 'alertas', t: 'Alertas', ic: 'alerta' },
]

export type Asistencia = { mes: number | null, total: number | null }

/** % de asistencia: realizadas entre (realizadas + faltas), hasta hoy. null = aún nada. */
export async function asistencias(pids: string[], fecha: string): Promise<Record<string, Asistencia>> {
  if (!pids.length) return {}
  const mes = fecha.slice(0, 7), hoy = hoyISO()
  const filas: any[] = []
  for (let d = 0; d < 50000; d += 1000) {
    const { data, error } = await supabase.from('citas').select('paciente_id,fecha,estado')
      .in('paciente_id', pids).in('estado', ['realizada', 'falta']).lte('fecha', hoy).order('id').range(d, d + 999)
    if (error || !data) break
    filas.push(...data); if (data.length < 1000) break
  }
  const c: Record<string, { v: number, f: number, vm: number, fm: number }> = {}
  filas.forEach(x => {
    const o = (c[x.paciente_id] ||= { v: 0, f: 0, vm: 0, fm: 0 })
    const vino = x.estado === 'realizada'
    if (vino) o.v++; else o.f++
    if (String(x.fecha).slice(0, 7) === mes) { if (vino) o.vm++; else o.fm++ }
  })
  const pct = (a: number, b: number) => a + b > 0 ? Math.round(a / (a + b) * 100) : null
  return Object.fromEntries(pids.map(p => { const o = c[p]; return [p, o ? { mes: pct(o.vm, o.fm), total: pct(o.v, o.f) } : { mes: null, total: null }] }))
}

export type EstadoCuota = 'pagado' | 'pendiente' | 'impago' | 'sinCuota'
export const TXT_CUOTA: Record<EstadoCuota, { t: string, fondo: string, color: string }> = {
  pagado: { t: 'Pagado', fondo: 'var(--gl)', color: 'var(--gd)' },
  pendiente: { t: 'Pendiente', fondo: 'var(--ambl)', color: '#8A6410' },
  impago: { t: 'Impago', fondo: 'var(--redl)', color: 'var(--red)' },
  sinCuota: { t: 'Sin cuota', fondo: 'var(--bl)', color: 'var(--gr)' },
}

/** La cuota del mes de ese día, con la misma regla que Cobros (una por persona y mes). */
export async function cuotas(pids: string[], fecha: string): Promise<Record<string, EstadoCuota>> {
  if (!pids.length) return {}
  const anio = Number(fecha.slice(0, 4)), mes = Number(fecha.slice(5, 7))
  const { data: bs } = await supabase.from('bonos').select('*').eq('mes', mes).eq('anio', anio).in('paciente_id', pids)
  const ids = (bs || []).map((b: any) => b.id)
  const { data: pg } = ids.length ? await supabase.from('v_bonos_pago').select('bono_id,pagado').in('bono_id', ids) : { data: [] as any[] }
  const pagados = new Set((pg || []).filter((r: any) => r.pagado).map((r: any) => r.bono_id))
  const una = unaCuotaPorPacienteYMes(bs || [], pagados)
  const out: Record<string, EstadoCuota> = Object.fromEntries(pids.map(p => [p, 'sinCuota' as EstadoCuota]))
  una.forEach((b: any) => { out[b.paciente_id] = pagados.has(b.id) ? 'pagado' : b.estado_pago === 'impago' ? 'impago' : 'pendiente' })
  return out
}
