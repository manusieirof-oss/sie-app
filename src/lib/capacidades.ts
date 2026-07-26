// Tabla de referencia capacidad <-> repeticiones (bidireccional)
// Cada tramo de reps apunta a UNA sola capacidad (sin solapes)

// `descanso` son los segundos habituales entre series para esa capacidad. Es una
// SUGERENCIA: rellena el campo al elegir capacidad y se puede pisar siempre, porque
// el descanso real depende de si la carga se ajustó del todo, de cómo llegue el
// paciente y de con qué se combine el ejercicio.
export const CAPACIDADES = [
  { nombre: 'Fuerza máxima',     min: 1,  max: 3,  sugerido: 3,  descanso: 240 },
  { nombre: 'Fuerza',           min: 4,  max: 6,  sugerido: 5,  descanso: 180 },
  { nombre: 'Hipertrofia',       min: 7,  max: 12, sugerido: 10, descanso: 90  },
  { nombre: 'Fuerza-resistencia', min: 13, max: 20, sugerido: 15, descanso: 60  },
  { nombre: 'Resistencia',       min: 21, max: 999, sugerido: 25, descanso: 30  },
]

export const REGIMENES = ['Concéntrico','Excéntrico','Isométrico','Explosivo','Pliométrico']

// reps -> capacidad (devuelve el nombre, o '' si no hay reps)
export function capacidadPorReps(reps: string | number): string {
  const n = parseInt(String(reps))
  if (!n || n < 1) return ''
  const c = CAPACIDADES.find(c => n >= c.min && n <= c.max)
  return c ? c.nombre : ''
}

// capacidad -> reps sugeridas (devuelve string, o '' si no encuentra)
export function repsPorCapacidad(nombre: string): string {
  const c = CAPACIDADES.find(c => c.nombre === nombre)
  return c ? String(c.sugerido) : ''
}

// capacidad -> descanso sugerido entre series, en segundos
export function descansoPorCapacidad(nombre: string): string {
  const c = CAPACIDADES.find(c => c.nombre === nombre)
  return c ? String(c.descanso) : ''
}

/** 240 -> "4 min", 90 -> "1:30", 30 -> "30 s". Para leerlo de un vistazo. */
export function textoDescanso(seg: string | number): string {
  const n = parseInt(String(seg))
  if (!n || n < 1) return ''
  if (n < 60) return `${n} s`
  const m = Math.floor(n / 60), s = n % 60
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')}`
}
