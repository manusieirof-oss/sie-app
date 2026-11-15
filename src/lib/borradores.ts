/**
 * LO QUE SE QUEDA A MEDIAS EN ESTE EQUIPO, FUERA AL SALIR.
 *
 * La valoracion guarda un borrador en el navegador (datos de salud y la foto) para no
 * perder lo escrito si la tablet se duerme. Pero se quedaba ahi hasta 14 dias aunque se
 * cerrara la sesion: en una tablet compartida, el siguiente que entrara lo tenia delante.
 *
 * Se borra cuando alguien pulsa «Cerrar sesion» A MANO. Si la sesion se cierra sola por
 * inactividad NO se borra, a proposito: es justo el caso para el que existe el borrador
 * (a media valoracion, con el paciente delante).
 */
import { olvidarEnlacesFotos } from './fotos'

const CLAVES = ['sie-valoracion-borrador', 'sie-valoracion-foto']

export function borrarBorradores() {
  try { CLAVES.forEach(k => localStorage.removeItem(k)) } catch {}
  // Y los enlaces a las caras de los pacientes (lib/fotos).
  olvidarEnlacesFotos()
}
