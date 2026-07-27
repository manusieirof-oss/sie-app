'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'
import { agrupaPorRaiz, categoriaDe } from '@/lib/etiquetas'

/**
 * Las etiquetas de un ejercicio, agrupadas bajo su raíz.
 *
 * El problema que resuelve: un ejercicio con "Cuádriceps" y "Vasto Medial" enseñaba dos
 * pastillas seguidas que a simple vista parecían dos músculos distintos. Y uno etiquetado
 * solo como "Vasto Medial" enseñaba un nombre suelto sin decir de qué cuelga.
 *
 * Ahora se ve siempre la RAÍZ —"Cuádriceps"—, con un número si lleva subetiquetas dentro.
 * Al pulsar se despliegan como pastillas huecas, para que se lea que son hijas de la de
 * al lado y no hermanas.
 *
 * `resaltados` son los ids que casan con el filtro activo. La raíz se marca también
 * cuando quien casa es una hija: así el resultado no sorprende, se ve por qué entró.
 *
 * Vive en un componente y no repetido en cada pantalla porque lo usan la ficha del
 * ejercicio, las tarjetas del explorador y el modal de sesión. Ya nos pasó con la rejilla
 * de ejercicios: tres copias que acabaron divergiendo.
 */

type Props = {
  etiquetas: any[]
  ids: string[]
  resaltados?: string[]
  /** Pinta solo estas categorías. Vacío o sin pasar: todas. */
  categorias?: string[]
  tamano?: 'normal' | 'mini'
  /** Al pulsar una etiqueta. Si no se pasa, la pastilla no es pulsable. */
  onEtiqueta?: (id: string) => void
}

export default function EtiquetasEjercicio({
  etiquetas, ids, resaltados = [], categorias, tamano = 'normal', onEtiqueta,
}: Props) {
  const [abiertas, setAbiertas] = useState<string[]>([])

  let grupos = agrupaPorRaiz(etiquetas, ids)
  if (categorias && categorias.length > 0) {
    grupos = grupos.filter(g => categorias.includes(categoriaDe(etiquetas, g.raiz)))
  }
  if (grupos.length === 0) return null

  const mini = tamano === 'mini'
  const fs = mini ? 11 : 12
  const pad = mini ? '2px 8px' : '3px 10px'

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: mini ? 4 : 6, alignItems: 'center' }}>
      {grupos.map(g => {
        const abierta = abiertas.includes(g.raiz.id)
        // La raíz se marca si casa ella o si casa cualquiera de sus hijas.
        const marcada = resaltados.includes(g.raiz.id) || g.hijas.some(h => resaltados.includes(h.id))
        const n = g.hijas.length

        return (
          <span key={g.raiz.id} style={{ display: 'inline-flex', gap: mini ? 4 : 6, alignItems: 'center' }}>
            <span
              onClick={() => {
                if (n > 0) setAbiertas(a => abierta ? a.filter(x => x !== g.raiz.id) : [...a, g.raiz.id])
                else onEtiqueta?.(g.raiz.id)
              }}
              title={n > 0 ? g.hijas.map(h => h.nombre).join(' · ') : undefined}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: fs, padding: pad, borderRadius: 99,
                background: marcada ? 'var(--g)' : 'var(--gl)',
                color: marcada ? '#fff' : 'var(--gd)',
                cursor: (n > 0 || onEtiqueta) ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
              }}
            >
              {g.raiz.nombre}
              {n > 0 && (
                <>
                  <span style={{ fontSize: fs - 1, opacity: 0.75 }}>{n}</span>
                  <Ic name={abierta ? 'arriba' : 'abajo'} size={mini ? 10 : 11} />
                </>
              )}
            </span>

            {abierta && g.hijas.map(h => (
              <span key={h.id}
                onClick={() => onEtiqueta?.(h.id)}
                style={{
                  fontSize: fs - 1, padding: mini ? '1px 7px' : '2px 9px', borderRadius: 99,
                  background: 'var(--w)',
                  border: `1px solid ${resaltados.includes(h.id) ? 'var(--g)' : 'var(--gm)'}`,
                  color: 'var(--gd)',
                  cursor: onEtiqueta ? 'pointer' : 'default',
                  whiteSpace: 'nowrap',
                }}
              >
                {h.nombre}
              </span>
            ))}
          </span>
        )
      })}
    </div>
  )
}
