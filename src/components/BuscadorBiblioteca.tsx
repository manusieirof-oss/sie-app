'use client'
import { useState } from 'react'

// Buscador sobre una tabla *_biblioteca. Estaba repetido en línea seis veces dentro
// de SaludTab (molestias, patologías, medicamentos, alergias, intolerancias y
// deportes) con el mismo comportamiento y pequeñas variaciones. Cualquier arreglo
// había que hacerlo seis veces.
export default function BuscadorBiblioteca({
  items,
  placeholder,
  buscarEn,
  subtitulo,
  onElegir,
  onNuevo,
  max = 10,
  etiquetaNuevo = 'Añadir',
}: {
  items: any[]
  placeholder: string
  /** Campos por los que filtrar. Por defecto, solo el nombre. */
  buscarEn?: (item: any) => (string | null | undefined)[]
  /** Segunda línea de cada resultado. */
  subtitulo?: (item: any) => string | null | undefined
  onElegir: (item: any) => void
  /** Si no se pasa, no se ofrece crear entradas nuevas. */
  onNuevo?: (texto: string) => void
  max?: number
  etiquetaNuevo?: string
}) {
  const [q, setQ] = useState('')

  const norm = (s: any) => String(s || '').toLowerCase()
  const campos = buscarEn || ((i: any) => [i.nombre])
  const filtrados = q
    ? items.filter(i => campos(i).some(c => norm(c).includes(norm(q))))
    : []

  function elegir(item: any) { setQ(''); onElegir(item) }
  function crear() { const t = q.trim(); if (!t) return; setQ(''); onNuevo?.(t) }

  return (
    <div>
      <input
        className="input"
        placeholder={placeholder}
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && filtrados.length === 0 && onNuevo) crear() }}
        style={{ marginBottom: 6 }}
      />
      {q && (
        <div style={{ border: '1px solid var(--bd)', borderRadius: 8, maxHeight: 170, overflowY: 'auto', marginBottom: 8 }}>
          {filtrados.slice(0, max).map((item: any, i: number) => {
            const sub = subtitulo?.(item)
            return (
              <div key={item.id ?? i} onClick={() => elegir(item)}
                style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--bl)' }}
                onMouseOver={e => (e.currentTarget as HTMLElement).style.background = 'var(--gl)'}
                onMouseOut={e => (e.currentTarget as HTMLElement).style.background = ''}>
                <div style={{ color: 'var(--n)' }}>{item.nombre}</div>
                {sub && <div style={{ fontSize: 12, color: 'var(--gr)' }}>{sub}</div>}
              </div>
            )
          })}
          {filtrados.length === 0 && onNuevo && (
            <div onClick={crear} style={{ padding: '7px 10px', fontSize: 13, color: 'var(--gd)', cursor: 'pointer' }}>
              + {etiquetaNuevo} “{q}”
            </div>
          )}
          {filtrados.length === 0 && !onNuevo && (
            <div style={{ padding: '7px 10px', fontSize: 13, color: 'var(--gr)' }}>Sin resultados</div>
          )}
        </div>
      )}
    </div>
  )
}
