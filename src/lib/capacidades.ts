// Tabla de referencia capacidad <-> repeticiones (bidireccional)
// Cada tramo de reps apunta a UNA sola capacidad (sin solapes)

export const CAPACIDADES = [
  { nombre: 'Fuerza máxima',     min: 1,  max: 3,  sugerido: 3  },
  { nombre: 'Fuerza',           min: 4,  max: 6,  sugerido: 5  },
  { nombre: 'Hipertrofia',       min: 7,  max: 12, sugerido: 10 },
  { nombre: 'Fuerza-resistencia', min: 13, max: 20, sugerido: 15 },
  { nombre: 'Resistencia',       min: 21, max: 999, sugerido: 25 },
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
