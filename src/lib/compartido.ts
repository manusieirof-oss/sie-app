// EQUIPOS COMPARTIDOS (tablets de sala, el ordenador central).
//
// En un equipo marcado como compartido la sesión no se queda abierta: se cierra sola
// tras un rato sin tocarlo, y al volver a abrirlo después de ese rato pide entrar de
// nuevo. Para que entrar no sea un engorro, el login enseña a quienes ya han usado
// ese equipo: tocas tu nombre y solo pones la contraseña.
//
// Todo vive en el propio equipo (localStorage): la lista de quién lo usa no sale de la
// base de datos, porque antes de entrar nadie puede leer el equipo, y así debe ser.

const K_COMPARTIDO = 'sie_compartido'
const K_RECIENTES = 'sie_recientes'
const K_ACTIVIDAD = 'sie_ultima_actividad'

/** Minutos sin tocar el equipo antes de cerrar la sesión. */
export const MINUTOS_INACTIVO = 20

const leer = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const poner = (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch {} }

export const esCompartido = () => leer(K_COMPARTIDO) === '1'
export function marcarCompartido(si: boolean) { poner(K_COMPARTIDO, si ? '1' : null); if (si) apuntarActividad() }

export type Reciente = { email: string, nombre: string }
export function recientes(): Reciente[] {
  try { return JSON.parse(leer(K_RECIENTES) || '[]') } catch { return [] }
}
/** Quien entra queda el primero de la lista (máx. 12). */
export function recordar(email: string, nombre: string) {
  if (!email) return
  const resto = recientes().filter(r => r.email !== email)
  poner(K_RECIENTES, JSON.stringify([{ email, nombre: nombre || email }, ...resto].slice(0, 12)))
}
export function olvidar(email: string) { poner(K_RECIENTES, JSON.stringify(recientes().filter(r => r.email !== email))) }

/** La última vez que alguien tocó el equipo. Guardada, para que sirva aunque se recargue o la tablet duerma. */
export function apuntarActividad() { poner(K_ACTIVIDAD, String(Date.now())) }
export function caducada(): boolean {
  const t = Number(leer(K_ACTIVIDAD) || 0)
  return !!t && Date.now() - t > MINUTOS_INACTIVO * 60_000
}
