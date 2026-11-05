// ---------------------------------------------------------------------------
// LO COMÚN DEL CROMO DE UN EJERCICIO: su "rareza" (color según lo que se usa en la
// clínica) y los colores de cada capacidad. Lo usan el cromo grande (FichaEjercicio)
// y las tarjetas de la Biblioteca, que tienen que pintarse igual.
// ---------------------------------------------------------------------------

export type Rareza = { k: 'oro' | 'plata' | 'bronce' | 'nuevo', t: string, color: string, claro: string }

/** El color del marco según las veces que se ha apuntado en toda la clínica. */
export function rareza(veces: number): Rareza {
  if (veces >= 100) return { k: 'oro', t: 'Imprescindible', color: '#C9A84C', claro: '#f6e7b4' }
  if (veces >= 30) return { k: 'plata', t: 'Habitual', color: '#9aa3a6', claro: '#e9eef0' }
  if (veces >= 1) return { k: 'bronce', t: 'De vez en cuando', color: '#b08560', claro: '#f0dccb' }
  return { k: 'nuevo', t: 'Sin estrenar', color: '#5A969E', claro: '#d6ecee' }
}

/* De más fuerza (oscuro) a más resistencia (claro), para que el rosco se lea sin leyenda.
   Las que no están aquí (Movilidad…) toman los colores de OTROS por orden. */
export const COLOR_CAP: Record<string, string> = {
  'Fuerza máxima': '#2B5A61', 'Fuerza': '#3E7179', 'Hipertrofia': '#5A969E',
  'Fuerza-resistencia': '#8DBDC3', 'Resistencia': '#BFDDE0',
}
const OTROS = ['#C9A84C', '#b08560', '#B05A5A', '#9aa3a6']

/** Trozos del rosco: cada capacidad con su color, su % y dónde empieza (0..1). */
export function trozosCapacidad(caps: { nombre: string, n: number, color?: string }[]) {
  const total = caps.reduce((a, c) => a + c.n, 0) || 1
  let acum = 0, o = 0
  return caps.map(c => {
    const t = { ...c, color: c.color || COLOR_CAP[c.nombre] || OTROS[o++ % OTROS.length], pct: Math.round(c.n / total * 100), ini: acum, parte: c.n / total }
    acum += c.n / total; return t
  })
}
