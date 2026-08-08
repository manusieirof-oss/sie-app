import { supabase } from './supabase'
import { duplicarSesion } from './sesiones'

/**
 * Traer una sesión de otra pantalla. UN SOLO MECANISMO.
 *
 * POR QUÉ NO HAY UN SELECTOR EN CADA SITIO. Lo hubo, y distinto en cada uno: el taller
 * tuvo su propio modal, la agenda enseña solo las del paciente y sin biblioteca, y la
 * ficha solo deja crear una nueva. Tres formas de elegir una sesión, ninguna completa, y
 * las dos pantallas que sí saben enseñarlas —la ficha y la biblioteca— sin usarse.
 *
 * Aquí se invierte: el que necesita una sesión manda a la pantalla que las tiene, con un
 * ENCARGO en la dirección, y esa pantalla añade un botón de "traer y volver". Las
 * pantallas de sesiones no se duplican; aprenden a volver.
 *
 * DOS ENCARGOS, casi iguales:
 *   · con `citaId` — poner la sesión en esa cita. Del taller y de la agenda.
 *   · sin `citaId` — solo copiársela al paciente. De su ficha.
 *
 * El encargo viaja en la URL y no en memoria: sobrevive a recargar, y no deja un estado
 * invisible colgado si se vuelve atrás.
 */

export type Encargo = {
  pacienteId: string
  /** Si viene, además de copiar se pone en esta cita. */
  citaId?: string
  /** A quién y a qué hora, para poder decirlo sin otra consulta. */
  etiqueta: string
  /** A dónde se vuelve al terminar. */
  volver: string
}

const P_PAC = 'asignar_paciente'
const P_CITA = 'asignar_cita'
const P_ETQ = 'asignar_de'
const P_VOLVER = 'volver_a'

/** La dirección a la que mandar. `destino` es 'ficha' (las suyas) o 'biblioteca'. */
export function rutaDeAsignacion(destino: 'ficha' | 'biblioteca', e: Encargo): string {
  const q = new URLSearchParams({ [P_PAC]: e.pacienteId, [P_ETQ]: e.etiqueta, [P_VOLVER]: e.volver })
  if (e.citaId) q.set(P_CITA, e.citaId)
  return destino === 'ficha'
    ? `/pacientes/${e.pacienteId}?tab=entreno&${q}`
    : `/entrenamiento?tab=sesiones&${q}`
}

/** El encargo que trae la dirección actual. null en el uso normal. */
export function encargoDeLaUrl(): Encargo | null {
  if (typeof window === 'undefined') return null
  const p = new URLSearchParams(window.location.search)
  const pacienteId = p.get(P_PAC)
  if (!pacienteId) return null
  return {
    pacienteId,
    citaId: p.get(P_CITA) || undefined,
    etiqueta: p.get(P_ETQ) || '',
    // Se vuelve al taller si no se dice otra cosa: es de donde más se viene.
    volver: p.get(P_VOLVER) || '/taller',
  }
}

/**
 * Dejar la sesión donde tiene que quedar, y decir a dónde volver.
 *
 * Si es una PLANTILLA (`paciente_id` a null) se copia antes al paciente. Una cita no puede
 * apuntar a una plantilla: el día que alguien la retocara estaría reescribiendo lo que ya
 * se entrenó, y a la vez para todo el mundo.
 *
 * Si ya es del paciente y no hay cita, no hay nada que hacer: la sesión ya está donde toca.
 */
export async function asignarSesionYVolver(sesion: any, e: Encargo) {
  if (!sesion?.id) return { ok: false as const, error: 'Sesión sin id' }
  let id = sesion.id

  if (!sesion.paciente_id) {
    const r = await duplicarSesion(sesion, e.pacienteId, { sufijo: '' })
    if (!r.ok) return { ok: false as const, error: r.error }
    id = r.sesion.id
  }

  if (e.citaId) {
    const { error } = await supabase.from('citas').update({ sesion_id: id }).eq('id', e.citaId)
    if (error) return { ok: false as const, error: error.message }
  }

  return { ok: true as const, sesionId: id }
}
