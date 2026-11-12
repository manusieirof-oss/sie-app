'use client'
import { normalizar } from '@/lib/texto'
import { categoriaDe } from '@/lib/etiquetas'

// ---------------------------------------------------------------------------
// ICONOS DE LAS ETIQUETAS DE POSICIÓN Y MATERIAL. Un dibujo de línea al lado del nombre
// para encontrarlas de un vistazo al ponerlas y al filtrar (el nombre sigue saliendo:
// el icono ayuda a buscar, no sustituye). Se buscan por NOMBRE; una subetiqueta sin
// dibujo propio coge el de su madre (Supino › Con piernas en alto → el de Supino).
// Agarre no lleva: los dibujos de manos se parecían demasiado entre sí.
// Todos en una caja de 32 × 32, trazo redondeado, sin relleno.
// ---------------------------------------------------------------------------
const S = '<line x1="2" y1="29" x2="30" y2="29" stroke-width="1.2" opacity=".45"/>'
const DIBUJOS: Record<string, string> = {
  // POSICIÓN
  'bipedestacion': S + '<circle cx="16" cy="5" r="2.6"/><path d="M16 8v10M16 10.5l-4.5 5M16 10.5l4.5 5M16 18l-3.5 10.5M16 18l3.5 10.5"/>',
  'sentado': S + '<circle cx="12" cy="5" r="2.6"/><path d="M12 8v10h8.5v10.5M12 10.5l5 4.5"/><path d="M6 21h9M7 21v8M14 21v8"/>',
  'supino': S + '<circle cx="5.5" cy="24.5" r="2.6"/><path d="M8.5 26h10l4-7 4.5 9.5M10.5 26.5l4 .5"/>',
  'prono': S + '<circle cx="24.5" cy="16" r="2.6"/><path d="M22 19.5L10 27H3M21.5 20.5V28h5.5"/>',
  'decubito lateral': S + '<circle cx="7" cy="17" r="2.6"/><path d="M9.5 28.5L7.5 21M9.5 21.5l11 4 8 3M20.5 25.5l4-3.5 3 6"/>',
  'cuadrupedia': S + '<circle cx="25" cy="11" r="2.6"/><path d="M22.5 13.5H10M22 13.5V28.5M10 13.5V28.5H4"/>',
  'arrodillado': S + '<circle cx="16" cy="5" r="2.6"/><path d="M16 8v9.5l1 11H9M16 10.5l3 6"/>',
  'caballero': S + '<circle cx="13" cy="5" r="2.6"/><path d="M13 8v9.5h8v11M13 17.5l-1.5 11H5M13 10.5l3.5 5.5"/>',
  'cambiante': '<circle cx="16" cy="6" r="2.6"/><path d="M16 9v8M16 11l-4 4M16 11l4 4M16 17l-3 7M16 17l3 7"/><path d="M5 20a11 11 0 0 1 3-11M5 9.5V14h4M27 12a11 11 0 0 1-3 11M27 22.5V18h-4"/>',
  // MATERIAL
  'mancuerna': '<path d="M10 16h12"/><rect x="5" y="10.5" width="5" height="11" rx="1.5"/><rect x="22" y="10.5" width="5" height="11" rx="1.5"/><path d="M3 13.5v5M29 13.5v5"/>',
  'kettlebell': '<path d="M11.5 15V11.5a4.5 4.5 0 0 1 9 0V15"/><circle cx="16" cy="20.5" r="7.5"/><path d="M11 28h10"/>',
  'barra': '<path d="M2 16h28"/><rect x="6" y="9" width="3" height="14" rx="1"/><rect x="23" y="9" width="3" height="14" rx="1"/><path d="M10.5 12.5v7M21.5 12.5v7"/>',
  'polea': '<path d="M5 30V2h22M16 2v3"/><circle cx="16" cy="8" r="3"/><path d="M16 11v11M12 22h8l-1 4h-6z"/>',
  'fitball': '<circle cx="16" cy="16.5" r="11.5"/><path d="M6 11c6 3 14 3 20 0M5.5 20c6.5 3.5 14.5 3.5 21 0"/>',
  'goma': '<rect x="3" y="12" width="4" height="8" rx="1.5"/><rect x="25" y="12" width="4" height="8" rx="1.5"/><path d="M7 16c4-7 8 7 12 0s4 0 6 0"/>',
  'banda elastica': '<path d="M3 14c5-4 9 4 13 0s9-4 13 0M3 19c5-4 9 4 13 0s9-4 13 0M3 14v5M29 14v5"/>',
  'mini band': '<ellipse cx="16" cy="16" rx="12" ry="6"/><ellipse cx="16" cy="16" rx="8.5" ry="3.5"/>',
  'banco': '<rect x="3" y="13" width="26" height="4" rx="1.5"/><path d="M7 17v9M25 17v9M4.5 26h5M22.5 26h5"/>',
  'cajon': '<rect x="5" y="10" width="22" height="18" rx="1.5"/><rect x="12" y="15" width="8" height="3" rx="1.5"/>',
  'cajon pliometrico': '<path d="M6 28l3-15h14l3 15z"/><path d="M16 2v7M12.5 5.5L16 2l3.5 3.5"/>',
  'disco': '<circle cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="2.5"/><path d="M8.5 11.5a9 9 0 0 1 4-3.5M23.5 20.5a9 9 0 0 1-4 3.5"/>',
  'bosu': '<path d="M5 23a11 11 0 0 1 22 0Z"/><rect x="3.5" y="23" width="25" height="3.5" rx="1.5"/>',
  'roller': '<ellipse cx="7" cy="16" rx="3" ry="6.5"/><path d="M7 9.5h18a3 6.5 0 0 1 0 13H7"/><path d="M13 10v12M19 10v12"/>',
  'aro': '<circle cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="9.5"/>',
  'balon medicinal': '<circle cx="16" cy="16" r="11"/><path d="M5 16h22M16 5c-5 6-5 16 0 22M16 5c5 6 5 16 0 22"/>',
  'pelota': '<circle cx="16" cy="19" r="8"/><path d="M11.5 16a5 5 0 0 1 4-3"/><line x1="4" y1="29" x2="28" y2="29" stroke-width="1.2" opacity=".45"/>',
  'barra de dominadas': '<path d="M3 6h26M7 6v23M25 6v23M4 29h6M22 29h6M12 6v3M20 6v3"/>',
  'cinchas de suspension': '<path d="M16 2v4M16 6L10 21M16 6l6 15"/><rect x="6" y="21" width="8" height="3" rx="1.5"/><rect x="18" y="21" width="8" height="3" rx="1.5"/>',
  'cuerda': '<circle cx="4.5" cy="16" r="2"/><path d="M6.5 16c2.5-6 5 6 7.5 0s5 6 7.5 0 4.5 6 7 0"/>',
  'cuna': '<path d="M4 26h24L4 13z"/>',
  'deslizador': '<ellipse cx="16" cy="23" rx="10" ry="3.5"/><path d="M6 12h20M22 9l4 3-4 3M10 9l-4 3 4 3"/>',
  'landmine': '<path d="M6 26L24 11"/><circle cx="25" cy="10" r="4"/><circle cx="5.5" cy="26.5" r="2"/><path d="M2 29h8"/>',
  'pared': '<rect x="4" y="4" width="24" height="24" rx="1"/><path d="M4 10h24M4 16h24M4 22h24M12 4v6M20 10v6M12 16v6M20 22v6"/>',
  'plataforma': '<path d="M3 23h26v4H3z"/><path d="M6 23l2.5-5h15l2.5 5"/>',
  'rack': '<path d="M7 3v26M25 3v26M3 29h8M21 29h8M7 12h3v2M25 12h-3v2M7 20h5M25 20h-5"/>',
  'rueda abdominal': '<circle cx="16" cy="16" r="7"/><circle cx="16" cy="16" r="2"/><path d="M3 16h6M23 16h6"/>',
  'saco': '<path d="M16 2v4"/><rect x="10" y="6" width="12" height="22" rx="5"/><path d="M10 11h12"/>',
  'stick': '<path d="M5 28L27 4"/><path d="M4 26.5l3 3M25.5 3l3 3"/>',
  'valla': '<path d="M5 28V11M27 28V11M4 11h24M4 14.5h24M3 28h5M24 28h5"/>',
}

/** El dibujo de una etiqueta (o de su madre), solo si es de posición o material. */
export function dibujoDe(etiquetas: any[], et: any): string | null {
  if (!et) return null
  const cat = categoriaDe(etiquetas, et)
  if (cat !== 'posicion' && cat !== 'material') return null
  let x = et
  const vistos = new Set<string>()
  while (x && !vistos.has(x.id)) {
    vistos.add(x.id)
    const d = DIBUJOS[normalizar(x.nombre || '').trim()]
    if (d) return d
    x = x.padre_id ? etiquetas.find((e: any) => e.id === x.padre_id) : null
  }
  return null
}

export default function IconoEtiqueta({ etiquetas, et, size = 18 }: { etiquetas: any[], et: any, size?: number }) {
  const d = dibujoDe(etiquetas, et)
  if (!d) return null
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden style={{ flexShrink: 0, fill: 'none', stroke: 'currentColor',
      strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }} dangerouslySetInnerHTML={{ __html: d }}/>
  )
}
