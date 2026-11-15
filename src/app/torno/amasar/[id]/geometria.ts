// Sacado de page.tsx tal cual: un archivo de pagina no puede compartir sus piezas con
// otros, y el cuerpo del rosco (CuerpoAmasar) las necesita.
// Geometría del rosco (viewBox 600 x 600).
export const C = 300, R0 = 168, R1 = 286, HUECO = 1.6

export const polar = (r: number, a: number) => [C + r * Math.cos(a * Math.PI / 180), C + r * Math.sin(a * Math.PI / 180)]
export function quesito(a0: number, a1: number) {
  const [x0, y0] = polar(R1, a0), [x1, y1] = polar(R1, a1), [x2, y2] = polar(R0, a1), [x3, y3] = polar(R0, a0)
  const g = a1 - a0 > 180 ? 1 : 0
  return `M${x0},${y0} A${R1},${R1} 0 ${g} 1 ${x1},${y1} L${x2},${y2} A${R0},${R0} 0 ${g} 0 ${x3},${y3} Z`
}
