import { supabase } from './supabase'
import { duplicarSesion } from './sesiones'

/**
 * Asignar una sesión a una cita, viniendo del taller.
 *
 * POR QUÉ NO HAY UN SELECTOR DENTRO DEL TALLER. Lo hubo: un modal propio con las sesiones
 * del paciente y las de la biblioteca. Era una TERCERA pantalla para mirar sesiones, con
 * su buscador, sus filtros y su forma de pintarlas, al lado de las dos que ya existían y
 * que están mucho mejor hechas. Cada mejora en aquellas habría que repetirla aquí.
 *
 * Ahora el taller manda a la pantalla que toca —la ficha del paciente o la biblioteca— con
 * un ENCARGO en la dirección, y esa pantalla, que ya sabe enseñar sesiones, añade un botón
 * de "asignar y volver". El taller no aprende a listar sesiones; las pantallas de sesiones
 * aprenden a volver.
 *
 * El encargo viaja en la URL y no en memoria a propósito: así sobrevive a recargar la
 * página, y si alguien la comparte o vuelve atrás no queda un estado invisible colgado.
 */

export type Encargo = {
  citaId: string
  pacienteId: string
  /** Para poder decir a quién y a qué hora se está asignando, sin otra consulta. */
  etiqueta: string
}

const P_CITA = 'asignar_cita'
const P_PAC = 'asignar_paciente'
const P_ETQ = 'asignar_de'

/** La dirección a la que manda el taller. `destino` es 'ficha' o 'biblioteca'. */
export function rutaDeAsignacion(destino: 'ficha' | 'biblioteca', e: Encargo): string {
  const q = new URLSearchParams({ [P_CITA]: e.citaId, [P_PAC]: e.pacienteId, [P_ETQ]: e.etiqueta })
  return destino === 'ficha'
    ? `/pacientes/${e.pacienteId}?tab=entreno&${q}`
    : `/entrenamiento?tab=sesiones&${q}`
}

/** El encargo que trae la dirección actual, si lo hay. Devuelve null en el uso normal. */
export function encargoDeLaUrl(): Encargo | null {
  if (typeof window === 'undefined') return null
  const p = new URLSearchParams(window.location.search)
  const citaId = p.get(P_CITA)
  const pacienteId = p.get(P_PAC)
  if (!citaId || !pacienteId) return null
  return { citaId, pacienteId, etiqueta: p.get(P_ETQ) || '' }
}

/**
 * Poner la sesión en la cita y devolver al taller.
 *
 * Si la sesión es una PLANTILLA (`paciente_id` a null) se copia antes al paciente y se
 * asigna la copia. Una cita no puede apuntar a una plantilla: el día que alguien la
 * retocara estaría reescribiendo lo que ya se entrenó, y a la vez para todo el mundo.
 */
export async function asignarSesionYVolver(sesion: any, e: Encargo) {
  let id = sesion?.id
  if (!id) return { ok: false as const, error: 'Sesión sin id' }

  if (!sesion.paciente_id) {
    const r = await duplicarSesion(sesion, e.pacienteId, { sufijo: '' })
    if (!r.ok) return { ok: false as const, error: r.error }
    id = r.sesion.id
  }

  const { error } = await supabase.from('citas').update({ sesion_id: id }).eq('id', e.citaId)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}
