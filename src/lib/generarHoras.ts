// Las horas a las que se puede poner una cita.
//
// Hay UNA sola forma de calcularlas y vive aquí. La agenda las calculaba con
// `generarHoras` a partir de los ajustes de la clínica, y la ficha del paciente leía
// una clave `horas` guardada en Ajustes que quedó de una versión anterior y que ya no
// actualiza nadie: al cambiar la hora de una cita desde la ficha salían horas que no
// existían en la agenda.

/**
 * Horas de cita a partir del mapa de ajustes, con los mismos valores por defecto en
 * todas partes. Se le pasa `{clave: valor}` tal cual sale de la tabla `ajustes`.
 */
export function horasDeAgenda(map: Record<string, string>): string[] {
  return generarHoras(
    map.agenda_inicio || '08:30',
    map.agenda_fin || '21:30',
    map.clinica_pausa_inicio || '12:30',
    map.clinica_pausa_fin || '15:30',
    parseInt(map.clinica_duracion_clase || '50'),
    parseInt(map.clinica_tiempo_cambio || '10'),
  )
}

export function generarHoras(
  inicio: string = '08:30',
  fin: string = '21:30',
  pausaInicio: string = '12:30',
  pausaFin: string = '15:30',
  duracion: number = 50,
  descanso: number = 10
): string[] {
  const intervalo = duracion + descanso
  const horas: string[] = []

  function toMinutos(t: string): number {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  function toHora(min: number): string {
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
  }

  const inicioMin = toMinutos(inicio)
  const finMin = toMinutos(fin)
  const pausaInicioMin = toMinutos(pausaInicio)
  const pausaFinMin = toMinutos(pausaFin)

  let actual = inicioMin
  while (actual + duracion <= finMin) {
    if (actual >= pausaInicioMin && actual < pausaFinMin) {
      actual = pausaFinMin
      continue
    }
    if (actual < pausaInicioMin && actual + duracion > pausaInicioMin) {
      actual = pausaFinMin
      continue
    }
    horas.push(toHora(actual))
    actual += intervalo
  }

  return horas
}
