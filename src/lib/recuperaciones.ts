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
