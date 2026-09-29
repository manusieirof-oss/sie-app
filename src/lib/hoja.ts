// ---------------------------------------------------------------------------
// HOJA LIBRE: la sesion dibujada a mano, y lo poco de ella que son datos.
//
// El entrenador dibuja como en papel y el dibujo NO se interpreta: ni reconocimiento
// de letra ni IA. Leer la letra obliga a escribir con una forma fija (lo probamos en
// una maqueta y era justo lo contrario de lo que se buscaba) y depende de la tablet;
// esto funciona con cualquier lapiz.
//
// Los datos salen solo de las PEGATINAS que se pegan encima:
//   obj  un objetivo del paciente           -> sesiones_objetivos
//   ej   un ejercicio, de la biblioteca o con nombre libre
//   cas  una casilla de dato de un ejercicio -> se rellena en el taller
// Lo que no lleva pegatina es dibujo y no cuenta para nada.
//
// Coordenadas en unidades de la hoja (HOJA_W x HOJA_H, proporcion A4), no en pixeles:
// la misma hoja se ve en el iPad del entrenador y en el portatil de recepcion.
// ---------------------------------------------------------------------------

export const HOJA_W = 1000
export const HOJA_H = 1414

/** Los cuatro colores del BIC de cuatro colores. */
export const TINTAS = { azul: '#1C3F95', rojo: '#D2232A', negro: '#1B1B1B', verde: '#0F7B3E' } as const
export type Tinta = keyof typeof TINTAS

export const UNIDADES = ['kg', 'reps', 'series', 's', 'RPE', 'cm'] as const
export type Unidad = typeof UNIDADES[number]

/** [x, y, presion 0..1] */
export type Punto = [number, number, number]
export type Trazo = { c: Tinta, w: number, pts: Punto[] }

export type PegObj = { id: string, tipo: 'obj', x: number, y: number, objetivo_id: string | null, nombre: string }
export type PegEj = { id: string, tipo: 'ej', x: number, y: number, ejercicio_id: string | null, nombre: string }
export type PegCas = { id: string, tipo: 'cas', x: number, y: number, unidad: Unidad, previsto: string, de: string | null }
export type Peg = PegObj | PegEj | PegCas

export type Hoja = { trazos: Trazo[], pegs: Peg[] }

export const hojaVacia = (): Hoja => ({ trazos: [], pegs: [] })

/**
 * Lo que venga de la base, tal cual. La columna es jsonb y nadie impide que llegue
 * a medias; mejor una hoja con lo que se pueda leer que una pantalla en blanco.
 */
export function leerHoja(raw: any): Hoja {
  if (!raw || typeof raw !== 'object') return hojaVacia()
  const trazos = Array.isArray(raw.trazos)
    ? raw.trazos.filter((t: any) => t && Array.isArray(t.pts) && t.c in TINTAS)
    : []
  const pegs = Array.isArray(raw.pegs)
    ? raw.pegs.filter((p: any) => p && p.id && ['obj', 'ej', 'cas'].includes(p.tipo))
    : []
  return { trazos, pegs }
}

/** El ejercicio al que se asocia una casilla nueva: el mas cercano, pesando mas estar en la misma altura. */
export function ejercicioMasCerca(hoja: Hoja, x: number, y: number): PegEj | null {
  let mejor: PegEj | null = null, d = Infinity
  for (const p of hoja.pegs) {
    if (p.tipo !== 'ej') continue
    const dd = Math.hypot(p.x - x, (p.y - y) * 2.5)
    if (dd < d) { d = dd; mejor = p }
  }
  return mejor
}

export const objetivosDeHoja = (hoja: Hoja) =>
  Array.from(new Set(hoja.pegs.filter((p): p is PegObj => p.tipo === 'obj' && !!p.objetivo_id).map(p => p.objetivo_id as string)))

export const casillasDe = (hoja: Hoja, ejId: string) =>
  hoja.pegs.filter((p): p is PegCas => p.tipo === 'cas' && p.de === ejId)

/**
 * Lo apuntado en el taller, con la forma de `registros_ejercicio`.
 *
 * UNA SERIE POR EJERCICIO, de momento: kg -> peso, reps -> reps, s -> segundos. La
 * casilla "series" no es una cifra mas, dice cuantas veces se repitio esa serie, asi
 * que la serie se copia ese numero de veces; asi el volumen sale bien sin pedir al
 * entrenador que pegue tres casillas iguales. RPE y cm no tienen sitio en la serie
 * y van al comentario, que es donde el taller normal los apunta tambien.
 *
 * Un ejercicio sin nada apuntado no devuelve fila: que estuviera en la hoja no
 * significa que se hiciera.
 */
export function registrosDeHoja(hoja: Hoja, hechos: Record<string, string>) {
  const filas: { ejercicio_id: string | null, ejercicio_nombre: string, series: any[], comentario: string | null }[] = []
  for (const ej of hoja.pegs) {
    if (ej.tipo !== 'ej') continue
    const serie: any = { peso: '', reps: '', segundos: '' }
    const extra: string[] = []
    let veces = 1, algo = false
    for (const c of casillasDe(hoja, ej.id)) {
      const v = String(hechos[c.id] ?? '').trim().replace(',', '.')
      if (!v) continue
      algo = true
      if (c.unidad === 'kg') serie.peso = v
      else if (c.unidad === 'reps') serie.reps = v
      else if (c.unidad === 's') serie.segundos = v
      else if (c.unidad === 'series') veces = Math.max(1, Math.min(20, Math.round(Number(v)) || 1))
      else extra.push(`${c.unidad} ${v}`)
    }
    if (!algo) continue
    const hayCifra = serie.peso !== '' || serie.reps !== '' || serie.segundos !== ''
    filas.push({
      ejercicio_id: ej.ejercicio_id,
      ejercicio_nombre: ej.nombre || 'Ejercicio',
      series: hayCifra ? Array.from({ length: veces }, () => ({ ...serie })) : [],
      comentario: extra.length ? extra.join(' · ') : null,
    })
  }
  return filas
}
