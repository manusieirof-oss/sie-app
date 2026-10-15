import { supabase } from './supabase'
import { hoyISO } from './fechas'

/**
 * EN QUÉ PUNTO ESTÁ UNA RECUPERACIÓN.
 *
 * En la tabla casi todas se quedan en estado 'pendiente' para siempre: al agendar la
 * cita de recuperación solo se apunta `cita_recuperacion_id`, y al pasar el plazo no
 * cambia nada. Por eso salían en "sin recuperar" las ya agendadas y las caducadas, y
 * en la agenda se ofrecían para recuperar faltas con el plazo vencido.
 *
 * Se calcula aquí, en un solo sitio, en vez de mirar `estado` a pelo:
 *   - recuperada: marcada así en la tabla.
 *   - agendada: ya tiene su cita de recuperación puesta.
 *   - caducada: sin cita y con el plazo pasado.
 *   - pendiente: sin cita y aún en plazo. Es lo único que queda "por recuperar".
 */
export type EstadoRecuperacion = 'recuperada' | 'agendada' | 'caducada' | 'pendiente'

export function estadoRecuperacion(r: any, hoy: string = hoyISO()): EstadoRecuperacion {
  if (r?.estado === 'recuperada') return 'recuperada'
  if (r?.cita_recuperacion_id) return 'agendada'
  if (r?.fecha_limite && r.fecha_limite < hoy) return 'caducada'
  return 'pendiente'
}

/** Las que de verdad quedan por recuperar: sin cita y en plazo. */
export const porRecuperar = (lista: any[]) => (lista || []).filter(r => estadoRecuperacion(r) === 'pendiente')

/**
 * La cita de recuperación ya no vale (se cancela o se borra): la falta vuelve al banco.
 * Si para entonces el plazo ha pasado, sale como caducada, no como pendiente.
 */
export async function soltarRecuperacion(citaId: string) {
  const { error } = await supabase.from('recuperaciones')
    .update({ estado: 'pendiente', cita_recuperacion_id: null }).eq('cita_recuperacion_id', citaId)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

// ---------------------------------------------------------------------------
// LA REGLA, IGUAL DESDE CUALQUIER SITIO (agenda, panel, editor de citas, ficha):
//
//   - CANCELADA (avisa)   → se puede recuperar, con el plazo de Ajustes.
//   - FALTA (no avisa)    → no se recupera.
//   - ELIMINADA           → desaparece, con su recuperación si la tenía.
//   - Vuelve a realizada o programada → ya no hay nada que recuperar.
//
// Antes cada pantalla lo hacía a su manera: el panel de la agenda daba
// recuperación por FALTA y los demás por CANCELADA, y el plazo eran 30 días a mano
// sin mirar Ajustes. Ahora todo pasa por aquí.
// ---------------------------------------------------------------------------

/**
 * Lo puesto en Ajustes → Recuperaciones. Sin ajustes: activas, 30 días, sin máximo
 * al mes y sin aviso mínimo.
 */
export async function politicaRecuperaciones(): Promise<{ activas: boolean, plazoDias: number, maxMes: number, avisoHoras: number }> {
  const { data } = await supabase.from('ajustes').select('clave,valor')
    .in('clave', ['recuperaciones_activas', 'recuperaciones_plazo_dias', 'recuperaciones_max_mes', 'recuperaciones_aviso_horas'])
  const m: Record<string, string> = Object.fromEntries((data || []).map((a: any) => [a.clave, a.valor || '']))
  const num = (k: string) => { const n = parseInt(m[k] || '', 10); return n > 0 ? n : 0 }
  return { activas: m.recuperaciones_activas !== 'false', plazoDias: num('recuperaciones_plazo_dias') || 30,
    maxMes: num('recuperaciones_max_mes'), avisoHoras: num('recuperaciones_aviso_horas') }
}

const masDias = (f: string, d: number) => {
  const x = new Date(f + 'T12:00:00'); x.setDate(x.getDate() + d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/**
 * Lo que le pasa a las recuperaciones cuando una cita cambia de estado. Se llama
 * DESPUÉS de cambiar el estado de la cita.
 *
 * `motivo`: si se canceló pero NO genera recuperación (desactivadas, poco aviso o
 * máximo del mes), por qué. Quien llama lo enseña, para no prometer una que no hay.
 *
 * `pausaHasta`: cancelada por una PAUSA (vacaciones, una salida). El plazo cuenta
 * desde la vuelta, no desde la cita: si no, una pausa de un mes las dejaba todas
 * caducadas antes de volver. Y el aviso mínimo no aplica: la pausa se avisa antes.
 */
export async function recuperacionAlCambiarEstado(
  cita: { id: string, paciente_id: string, fecha: string, hora?: string | null }, estado: string,
  opc: { pausaHasta?: string } = {},
): Promise<{ ok: true, motivo?: string } | { ok: false, error: string }> {
  const mal = (e: any) => ({ ok: false as const, error: e.message || String(e) })
  let motivo: string | undefined

  // 1. Como FALTA que se perdió.
  if (estado === 'cancelada') {
    const pol = await politicaRecuperaciones()
    const { data: ya, error: e1 } = await supabase.from('recuperaciones').select('id').eq('cita_falta_id', cita.id).maybeSingle()
    if (e1) return mal(e1)
    if (!ya) {
      if (!pol.activas) motivo = 'las recuperaciones están desactivadas en Ajustes'
      // AVISO MÍNIMO: horas entre ahora y la cita. Una cita ya pasada que se marca
      // como cancelada también cuenta como poco aviso.
      if (!motivo && pol.avisoHoras > 0 && !opc.pausaHasta) {
        const inicio = new Date(`${cita.fecha}T${(cita.hora || '00:00').slice(0, 5)}:00`)
        const horas = (inicio.getTime() - Date.now()) / 3600000
        if (horas < pol.avisoHoras) motivo = `avisó con menos de ${pol.avisoHoras} h`
      }
      // MÁXIMO AL MES: las recuperaciones que ya tiene con faltas de ese mismo mes.
      if (!motivo && pol.maxMes > 0) {
        const mes = cita.fecha.slice(0, 7)
        const { count, error: e2 } = await supabase.from('recuperaciones').select('id', { count: 'exact', head: true })
          .eq('paciente_id', cita.paciente_id).gte('fecha_falta', mes + '-01').lte('fecha_falta', mes + '-31')
        if (e2) return mal(e2)
        if ((count || 0) >= pol.maxMes) motivo = `ya tiene ${pol.maxMes} recuperaci${pol.maxMes === 1 ? 'ón' : 'ones'} ese mes`
      }
      if (!motivo) {
        const base = opc.pausaHasta && opc.pausaHasta > cita.fecha ? opc.pausaHasta : cita.fecha
        const { error } = await supabase.from('recuperaciones').insert({
          paciente_id: cita.paciente_id, cita_falta_id: cita.id, fecha_falta: cita.fecha,
          fecha_limite: masDias(base, pol.plazoDias), estado: 'pendiente',
        })
        if (error) return mal(error)
      }
    }
  } else {
    // Falta, realizada o programada: esa cita ya no deja nada por recuperar. Solo se
    // borra si nadie la ha recuperado todavía; una ya recuperada no se toca.
    const { error } = await supabase.from('recuperaciones').delete()
      .eq('cita_falta_id', cita.id).neq('estado', 'recuperada')
    if (error) return mal(error)
  }

  // 2. Como CITA DE RECUPERACIÓN de otra.
  if (estado === 'cancelada') {
    // Cancelada: la falta original vuelve al banco (si sigue en plazo, se puede volver a agendar).
    const r = await soltarRecuperacion(cita.id); if (r.ok === false) return r
  } else if (estado === 'realizada') {
    const { error } = await supabase.from('recuperaciones').update({ estado: 'recuperada' }).eq('cita_recuperacion_id', cita.id)
    if (error) return mal(error)
  } else if (estado === 'programada') {
    const { error } = await supabase.from('recuperaciones').update({ estado: 'pendiente' }).eq('cita_recuperacion_id', cita.id)
    if (error) return mal(error)
  }
  // Falta en la cita de recuperación: no vino, se pierde. La falta original queda
  // como agendada (gastada) y no vuelve al banco.
  return { ok: true, motivo }
}

/** Antes de eliminar una cita: fuera su recuperación, y si recuperaba otra, esa vuelve al banco. */
export async function recuperacionAlEliminar(citaId: string): Promise<{ ok: true } | { ok: false, error: string }> {
  const { error } = await supabase.from('recuperaciones').delete().eq('cita_falta_id', citaId)
  if (error) return { ok: false, error: error.message }
  return soltarRecuperacion(citaId)
}
