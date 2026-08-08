'use client'
import ModoClase from './ModoClase'

/**
 * El taller.
 *
 * UNA SOLA PANTALLA. Antes eran dos pestañas, "Individual" y "Día de fuerza", y la primera
 * dejó de tener sentido en cuanto el taller empezó a leer la agenda: buscabas al paciente a
 * mano, elegías su sesión a mano y anotabas. Todo eso lo hace ya la vista de clase con la
 * cita delante y sin teclear nada.
 *
 * Lo que la pestaña individual hacía y AQUÍ NO SE HACE —crear, editar, duplicar y borrar
 * sesiones— vive en Pacientes → Entrenamiento, que es de donde no debió salir nunca:
 *
 *   El taller SOLO EJECUTA. Si se edita el plan mientras se ejecuta, se pierde la
 *   diferencia entre lo prescrito y lo que pasó, que es justo el dato que interesa. Que
 *   hoy no pudiera con 40 y hiciera 30 no es un error del plan: es información. El taller
 *   anota lo que pasó; el plan se ajusta después en la ficha, viéndolo.
 *
 * Tampoco se añade ni se quita gente aquí. Quién viene lo decide la AGENDA y solo la
 * agenda: dos sitios donde apuntar quién entrena acaban discrepando, y entonces no hay
 * forma de saber cuál manda.
 */
export default function TallerPage() {
  return <ModoClase/>
}
