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
  /**
   * SUSTITUCIÓN: qué había antes y por qué se cambia.
   *
   * Solo viene cuando la cita YA tenía sesión y se está cambiando en la sala. El motivo
   * se pide en el taller, antes de salir, y viaja hasta aquí porque el que escribe la
   * cita es este módulo: pedirlo aquí significaría preguntar en la ficha y en la
   * biblioteca por separado, y el "por qué" se decide mirando al paciente, no mirando el
   * catálogo de sesiones.
   *
   * El nombre viaja además del id por lo mismo que se guarda en la tabla: el registro
   * tiene que poder leerse aunque la sesión se renombre o se borre.
   */
  antesId?: string
  antesNombre?: string
  motivo?: string
  nota?: string
}

const P_PAC = 'asignar_paciente'
const P_CITA = 'asignar_cita'
const P_ETQ = 'asignar_de'
const P_VOLVER = 'volver_a'
const P_ANTES = 'cambia_de'
const P_ANTES_N = 'cambia_de_n'
const P_MOTIVO = 'cambia_por'
const P_NOTA = 'cambia_nota'

/**
 * La dirección a la que mandar. `destino` es 'ficha' (las suyas) o 'biblioteca'.
 *
 * CON CITA, "sus sesiones" ya no es la ficha: es el calendario de citas, la única
 * pantalla que pone sesiones en citas (sabe de candados y de fases, y no guarda hasta
 * Confirmar). La biblioteca sigue sirviendo para TRAER una sesión al paciente; la
 * cita se la pone luego el calendario. Ver `asignarSesionYVolver`.
 */
export function rutaDeAsignacion(destino: 'ficha' | 'biblioteca', e: Encargo, pincel?: string): string {
  const q = new URLSearchParams({ [P_PAC]: e.pacienteId, [P_ETQ]: e.etiqueta, [P_VOLVER]: e.volver })
  if (e.citaId) q.set(P_CITA, e.citaId)
  if (e.antesId) q.set(P_ANTES, e.antesId)
  if (e.antesNombre) q.set(P_ANTES_N, e.antesNombre)
  if (e.motivo) q.set(P_MOTIVO, e.motivo)
  if (e.nota) q.set(P_NOTA, e.nota)
  if (destino === 'ficha' && e.citaId) {
    if (pincel) q.set('pincel', pincel)
    return `/torno/${e.pacienteId}/citas?${q}`
  }
  return destino === 'ficha'
    ? `/pacientes/${e.pacienteId}?tab=entreno&${q}`
    : `/entrenamiento?tab=sesiones&${q}`
}

/** El encargo que trae la dirección actual. null en el uso normal. */
export function encargoDeLaUrl(): Encargo | null {
  if (typeof window === 'undefined') return null
  return encargoDe(new URLSearchParams(window.location.search))
}

/** Lo mismo, desde unos parámetros ya leídos (useSearchParams en el calendario). */
export function encargoDe(p: URLSearchParams): Encargo | null {
  const pacienteId = p.get(P_PAC)
  if (!pacienteId) return null
  return {
    pacienteId,
    citaId: p.get(P_CITA) || undefined,
    etiqueta: p.get(P_ETQ) || '',
    // Se vuelve al taller si no se dice otra cosa: es de donde más se viene.
    volver: p.get(P_VOLVER) || '/taller',
    antesId: p.get(P_ANTES) || undefined,
    antesNombre: p.get(P_ANTES_N) || undefined,
    motivo: p.get(P_MOTIVO) || undefined,
    nota: p.get(P_NOTA) || undefined,
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

  /**
   * Con cita, la sesión ya es del paciente y quien la pone en la cita es el calendario,
   * con ella ya elegida y la cita marcada: se confirma allí, y allí se apunta el motivo
   * si es un cambio en la sala. Así hay una sola puerta que escribe citas.
   */
  if (e.citaId) return { ok: true as const, sesionId: id, ir: rutaDeAsignacion('ficha', e, id) }

  return { ok: true as const, sesionId: id, ir: undefined as string | undefined }
}
