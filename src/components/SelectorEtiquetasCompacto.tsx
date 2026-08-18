'use client'
import { useMemo, useState } from 'react'
import { Ic } from '@/lib/icons'

/**
 * Elegir etiquetas dentro de un modal.
 *
 * El selector de la biblioteca de ejercicios es una rejilla de NUEVE columnas con 1250 px
 * de ancho mínimo: funciona a pantalla completa y es ilegible dentro de un modal, que es
 * donde se editan los tests. Salía con scroll lateral y las etiquetas apretadas en
 * columnas de 140 px.
 *
 * Aquí manda lo contrario: primero lo que YA está puesto, y lo demás se busca. Con
 * cientos de etiquetas en el árbol, enseñarlas todas a la vez no es enseñar nada.
 *
 * No sustituye al de la biblioteca: son dos sitios con espacio muy distinto y forzar el
 * mismo componente en los dos daría un resultado peor en ambos.
 */

const CATEGORIAS = [
  { key: 'musculo', label: 'Músculo' },
  { key: 'articulacion', label: 'Articulación' },
  { key: 'movimiento', label: 'Movimiento' },
  { key: 'posicion', label: 'Posición' },
  { key: 'material', label: 'Material' },
  { key: 'apoyo', label: 'Apoyo' },
  { key: 'agarre', label: 'Agarre' },
  { key: 'patologia', label: 'Patología' },
  { key: 'plano_eje', label: 'Plano y eje' },
]

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

export default function SelectorEtiquetasCompacto({ etiquetas = [], seleccionadas = [], onChange }: {
  etiquetas: any[]
  seleccionadas: string[]
  onChange: (ids: string[]) => void
}) {
  const [busca, setBusca] = useState('')
  const [cat, setCat] = useState('')

  const porId = useMemo(() => {
    const m: Record<string, any> = {}
    etiquetas.forEach(e => { m[e.id] = e })
    return m
  }, [etiquetas])

  const alternar = (id: string) =>
    onChange(seleccionadas.includes(id) ? seleccionadas.filter(x => x !== id) : [...seleccionadas, id])

  /**
   * Qué se ofrece. El buscador manda sobre la categoría: si estás escribiendo, quieres
   * encontrar la etiqueta, no acordarte de en qué columna vivía.
   */
  const lista = useMemo(() => {
    const t = norm(busca)
    let base = etiquetas
    if (t) base = base.filter(e => norm(e.nombre).includes(t))
    else if (cat) base = base.filter(e => e.categoria === cat)
    else return []
    return base.filter(e => !seleccionadas.includes(e.id)).slice(0, 60)
  }, [etiquetas, busca, cat, seleccionadas])

  const nCat = (k: string) => etiquetas.filter(e => e.categoria === k).length
  const selCat = (k: string) => etiquetas.filter(e => e.categoria === k && seleccionadas.includes(e.id)).length

  return (
    <div>
      {/* LO PUESTO, primero y siempre visible. Es lo que se viene a comprobar. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7, minHeight: 24 }}>
        {seleccionadas.length === 0
          ? <span style={{ fontSize: 11, color: 'var(--grl)' }}>Ninguna puesta todavía</span>
          : seleccionadas.map(id => {
            const e = porId[id]
            return (
              <span key={id} onClick={() => alternar(id)} title="Quitar"
                style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99, background: 'var(--g)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {e?.nombre || 'etiqueta'} <span style={{ opacity: .7 }}>✕</span>
              </span>
            )
          })}
      </div>

      <input className="input" value={busca} onChange={e => setBusca(e.target.value)}
        placeholder="Buscar etiqueta..." style={{ fontSize: 11, marginBottom: 6 }} />

      {!busca && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {CATEGORIAS.map(c => {
            const n = selCat(c.key)
            const activa = cat === c.key
            return (
              <span key={c.key} onClick={() => setCat(activa ? '' : c.key)}
                style={{ fontSize: 10, padding: '3px 9px', borderRadius: 99, cursor: 'pointer',
                  border: `1.5px solid ${activa ? 'var(--g)' : 'var(--bd)'}`,
                  background: activa ? 'var(--g)' : 'var(--w)', color: activa ? '#fff' : 'var(--gr)' }}>
                {c.label} {n > 0 && <b>{n}</b>}
                <span style={{ opacity: .6 }}> · {nCat(c.key)}</span>
              </span>
            )
          })}
        </div>
      )}

      {(busca || cat) && (
        <div style={{ maxHeight: 190, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 6, padding: 6 }}>
          {lista.length === 0
            ? <div style={{ fontSize: 11, color: 'var(--grl)', padding: '6px 4px' }}>Nada que coincida.</div>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {lista.map(e => (
                <span key={e.id} onClick={() => alternar(e.id)}
                  style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99, cursor: 'pointer', border: '1px solid var(--bd)', background: 'var(--w)', color: 'var(--gr)' }}>
                  <Ic name="mas" size={9} /> {e.nombre}
                </span>
              ))}
            </div>}
        </div>
      )}
    </div>
  )
}
