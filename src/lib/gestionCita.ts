import { supabase } from './supabase'
import { citaAntes, correrTrasEstado, correrAlQuitar, correrAlMover } from './correrSesiones'
import { bonoTrasEstado, engancharCitas, revisarBonoDeCita } from './bonoSesiones'
import { recuperacionAlCambiarEstado, recuperacionAlEliminar } from './recuperaciones'

/**
 * CAMBIAR, MOVER Y ELIMINAR UNA CITA. Un solo sitio, que mira si ha entrado.
 *
 * Esto estaba escrito dos veces, en la agenda y en la ficha del paciente, y en ninguna
 * se miraba el error del cambio: si la base decia que no (sin conexion, sin permiso), el
 * modal se cerraba igual, la cita volvia a como estaba y AUN ASI se seguia con lo de
 * detras: se creaba o borraba la recuperacion, se corrian las sesiones y se tocaba el
 * bono, como si el cambio hubiera entrado. Ademas las dos copias ya no hacian lo mismo:
 * desde la ficha las sesiones no corrian y desde la agenda si.
 *
 * Aqui, si el cambio de la cita no entra, se para y se dice. Lo de detras solo se hace
 * cuando la cita ha cambiado de verdad.
 *
 * `.select('id')` en cada escritura: con las reglas de la base, un cambio o un borrado
 * sin permiso NO da error, simplemente no toca ninguna fila. Pidiendo las filas tocadas
 * se distingue "hecho" de "no ha hecho nada".
 */

export type ResultadoCita = { ok: true, aviso?: string } | { ok: false, error: string }

const SIN_FILAS = 'La cita no se ha cambiado: ya no existe o no tienes permiso para hacerlo.'

/** Realizada, falta, cancelada o programada. Misma regla desde cualquier pantalla. */
export async function cambiarEstadoDeCita(citaId: string, estado: string): Promise<ResultadoCita> {
  const antes = await citaAntes(citaId)
  if (!antes) return { ok: false, error: 'No se ha podido leer la cita. Recarga y vuelve a intentarlo.' }
  const { data, error } = await supabase.from('citas').update({ estado }).eq('id', citaId).select('id')
  if (error) return { ok: false, error: 'No se ha podido cambiar el estado: ' + error.message }
  if (!data || data.length === 0) return { ok: false, error: SIN_FILAS }
  // Falta o cancelada: su sesion pasa a la siguiente (si corren, ver lib/correrSesiones).
  await correrTrasEstado(antes, estado)
  // Cancelada no gasta del bono (su hueco pasa a la siguiente); si vuelve, se ata otra vez.
  await bonoTrasEstado(citaId, estado)
  // Cancelada recupera, falta no (lib/recuperaciones).
  const rr = await recuperacionAlCambiarEstado({ id: citaId, paciente_id: antes.paciente_id, fecha: antes.fecha, hora: antes.hora }, estado)
  if (rr.ok === false) return { ok: true, aviso: 'El estado se ha cambiado, pero la recuperación no se ha actualizado: ' + rr.error }
  if (rr.motivo) return { ok: true, aviso: 'Cancelada sin recuperación: ' + rr.motivo + '.' }
  return { ok: true }
}

/**
 * Cambiar dia, hora, sala, tipo (y notas, si vienen). `original` es la cita como estaba,
 * para apuntar el cambio en su historial y correr las sesiones si cambia de dia.
 */
export async function moverCita(
  cita: { id: string, paciente_id?: string | null, fecha: string, hora: string, sala: string, tipo: string, notas?: string | null },
  original: { paciente_id?: string | null, fecha?: string | null, hora?: string | null } | null | undefined,
  conNotas = true,
): Promise<ResultadoCita> {
  const campos: any = { fecha: cita.fecha, hora: cita.hora, sala: cita.sala, tipo: cita.tipo }
  if (conNotas) campos.notas = cita.notas
  const { data, error } = await supabase.from('citas').update(campos).eq('id', cita.id).select('id')
  if (error) return { ok: false, error: 'No se ha podido guardar la cita: ' + error.message }
  if (!data || data.length === 0) return { ok: false, error: SIN_FILAS }
  // Si ha pasado a Individual (o al reves) o se ha movido fuera de su bono, se corrige.
  await revisarBonoDeCita(cita.id)
  if (original) {
    const pid = cita.paciente_id || original.paciente_id
    const registros: any[] = []
    const cambiaDia = !!(cita.fecha && original.fecha && cita.fecha !== original.fecha)
    if (cambiaDia) registros.push({ cita_id: cita.id, paciente_id: pid, campo_cambiado: 'fecha', valor_anterior: original.fecha, valor_nuevo: cita.fecha })
    const hAnt = (original.hora || '').slice(0, 5), hNue = (cita.hora || '').slice(0, 5)
    if (hNue && hAnt && hNue !== hAnt) registros.push({ cita_id: cita.id, paciente_id: pid, campo_cambiado: 'hora', valor_anterior: hAnt, valor_nuevo: hNue })
    if (registros.length > 0) {
      // Es el historial: si no entra, la cita ya esta movida. Se apunta y se sigue.
      const { error: eReg } = await supabase.from('cambios_cita').insert(registros)
      if (eReg) console.error('cambios_cita:', eReg.message)
    }
    // Otro DIA: la cita coge la sesion que le toca en su nueva posicion. Hora o sala, no.
    if (cambiaDia && pid) await correrAlMover(pid, cita.id, original.fecha as string, original.hora)
  }
  return { ok: true }
}

/** Eliminar una cita puesta por error: sin dejar rastro, y recolocando lo que dependia de ella. */
export async function eliminarCitaDel(cita: { id: string, bono_id?: string | null }): Promise<ResultadoCita> {
  const antes = await citaAntes(cita.id)
  // Fuera su recuperacion; y si recuperaba otra falta, esa vuelve al banco. Va antes de
  // borrar porque la recuperacion apunta a la cita.
  const rec = await recuperacionAlEliminar(cita.id)
  if (rec.ok === false) return { ok: false, error: 'No se ha eliminado la cita: no se pudo quitar su recuperación (' + rec.error + ').' }
  const { data, error } = await supabase.from('citas').delete().eq('id', cita.id).select('id')
  if (error) return { ok: false, error: 'No se ha podido eliminar la cita: ' + error.message }
  if (!data || data.length === 0) return { ok: false, error: 'La cita no se ha eliminado: ya no existe o no tienes permiso para hacerlo.' }
  // Estaba mal puesta: las sesiones se recolocan como si no hubiera existido.
  if (antes && antes.estado === 'programada') await correrAlQuitar(antes)
  // Si gastaba de un bono, el hueco lo coge su siguiente cita sin bono.
  if (cita.bono_id) await engancharCitas(cita.bono_id)
  return { ok: true }
}
