// ---------------------------------------------------------------------------
// HUECOS POR COLORES en la agenda (lo pidió Sara): para compensar los grupos.
//   verde    → vacío o con 3 plazas libres o más
//   amarillo → le quedan 1 o 2 plazas
//   rojo     → completo (o por encima del aforo)
// ---------------------------------------------------------------------------
export type ColorHueco = { fondo: string, borde: string, texto: string, nombre: string }

export function colorHueco(ocupadas: number, max: number): ColorHueco {
  const libres = max - ocupadas
  if (libres <= 0) return { fondo: '#F6E3E3', borde: '#D9A3A3', texto: '#8A3D3D', nombre: 'completo' }
  if (libres <= 2) return { fondo: '#FBF1DC', borde: '#E3C77E', texto: '#7A5800', nombre: `${libres} ${libres === 1 ? 'plaza' : 'plazas'}` }
  return { fondo: '#E7F1E3', borde: '#A9CB9C', texto: '#3F6E2E', nombre: `${libres} plazas` }
}
