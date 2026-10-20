/**
 * La rampa de color del mapa de calor: 0 blanco roto → amarillo → naranja → rojo.
 * Aparte y sin three.js, para que la leyenda y las barras no carguen el 3D.
 */
export const RAMPA = ['#F4F1EC', '#F8E08E', '#F2A541', '#E4572E', '#B5192F']

const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
export function colorCalor(v: number): string {
  const x = Math.max(0, Math.min(1, v)) * (RAMPA.length - 1)
  const i = Math.min(RAMPA.length - 2, Math.floor(x)), t = x - i
  const a = rgb(RAMPA[i]), b = rgb(RAMPA[i + 1])
  return '#' + a.map((c, k) => Math.round(c + (b[k] - c) * t).toString(16).padStart(2, '0')).join('')
}
