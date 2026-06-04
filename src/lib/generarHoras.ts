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
