'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'
import { zonasDe, subzonasEnUso, SIN_ZONA } from '@/lib/etiquetas'
import { ordenAnatomico } from '@/lib/anatomia'

/**
 * La fila de zonas. UNA SOLA, para tests, objetivos y el buscador de objetivos de dentro
 * de un test.
 *
 * Había tres, escritas por separado, y no coincidían: los tests agrupaban por la RAÍZ de
 * articulación —"Columna"— y la biblioteca de objetivos enseñaba la etiqueta tal cual se
 * puso —"Cervical"—. Las mismas etiquetas, dos vocabularios, y la sensación justificada de
 * que una de las dos pantallas estaba mal.
 *
 * RAÍCES DE ENTRADA, SUBZONAS A UN CLIC. Empezar desplegado sacaba treinta pastillas y
 * encontrar "Rodilla" costaba más que no tener filtro; no poder desplegar obligaba a
 * buscar a mano lo etiquetado en una subzona. El desplegable por raíz es el mismo patrón
 * que ya usa el filtro de etiquetas de los ejercicios.
 *
 * Elegir una RAÍZ trae también lo etiquetado por debajo de ella (lo resuelve `casaZona`),
 * así que desplegar solo hace falta para afinar, nunca para no perderse nada.
 */
export default function FiltroZonas({
  etiquetas = [], usadas, valor, onChange, nSinZona = 0, etiquetaSinZona = 'Sin zona',
  todas = 'Todas', compacto = false,
}: {
  etiquetas: any[]
  /** Ids de etiqueta de articulación que las filas usan de verdad, sin resolver a raíz. */
  usadas: string[]
  /** '' = todas · id de etiqueta · SIN_ZONA */
  valor: string
  onChange: (v: string) => void
  /** Cuántas filas no tienen ninguna zona. Con 0 no se pinta el cajón. */
  nSinZona?: number
  etiquetaSinZona?: string
  todas?: string
  /** Versión pequeña, para el buscador de objetivos de dentro de un test. */
  compacto?: boolean
}) {
  const [desplegadas, setDesplegadas] = useState<string[]>([])

  const raices = zonasDe(etiquetas, usadas)
    .sort((a: any, b: any) => ordenAnatomico(a.nombre, b.nombre))

  if (raices.length === 0 && nSinZona === 0) return null

  const Chip = ({ on, onClick, title, hija, children }: any) => (
    <button type="button" title={title} onClick={onClick}
      className={`chip-sel ${hija ? 'niv-1' : ''} ${on ? 'on' : ''}`}
      style={compacto ? { fontSize: 9, padding: hija ? '2px 7px' : '2px 8px', fontWeight: 600 } : undefined}>
      {children}
    </button>
  )

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      <Chip on={!valor} onClick={() => onChange('')}>{todas}</Chip>

      {raices.map((z: any) => {
        const hijas = subzonasEnUso(etiquetas, usadas, z.id)
          .sort((a: any, b: any) => ordenAnatomico(a.nombre, b.nombre))
        // La raíz se abre sola si lo seleccionado es una de sus hijas: si no, verías el
        // filtro puesto sin ver cuál.
        const abierta = desplegadas.includes(z.id) || hijas.some((h: any) => h.id === valor)
        return (
          <span key={z.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Chip on={valor === z.id} onClick={() => onChange(valor === z.id ? '' : z.id)}
              title={hijas.length > 0 ? `Incluye ${hijas.map((h: any) => h.nombre).join(', ')}` : undefined}>
              {z.nombre}
            </Chip>
            {hijas.length > 0 && (
              <button type="button"
                title={abierta ? 'Ocultar subzonas' : `Ver las ${hijas.length} subzonas`}
                onClick={() => setDesplegadas(p => p.includes(z.id) ? p.filter(x => x !== z.id) : [...p, z.id])}
                style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--g)', display: 'inline-flex', alignItems: 'center', gap: 1, font: 'inherit' }}>
                {!abierta && <span style={{ fontSize: compacto ? 8 : 10 }}>{hijas.length}</span>}
                <Ic name={abierta ? 'arriba' : 'abajo'} size={compacto ? 9 : 11} />
              </button>
            )}
            {abierta && hijas.map((h: any) => (
              <Chip key={h.id} hija on={valor === h.id} title="Subzona"
                onClick={() => onChange(valor === h.id ? '' : h.id)}>
                {h.nombre}
              </Chip>
            ))}
          </span>
        )
      })}

      {nSinZona > 0 && (
        <Chip on={valor === SIN_ZONA} title="Sin etiqueta de articulación"
          onClick={() => onChange(valor === SIN_ZONA ? '' : SIN_ZONA)}>
          {etiquetaSinZona} · {nSinZona}
        </Chip>
      )}
    </div>
  )
}
