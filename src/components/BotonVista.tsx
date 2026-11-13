'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'

// ---------------------------------------------------------------------------
// EL BOTÓN DE OPCIONES DE LA BIBLIOTECA, igual en todas sus pestañas: el mismo que
// «Calendario / Vista interactiva» de la ficha (.btn-vista). Con pocas opciones (hasta
// tres) cada toque pasa a la siguiente y los puntitos dicen en cuál estás; con más, se
// abre una lista. Antes cada pestaña tenía su fila de pastillas distinta.
// ---------------------------------------------------------------------------

export type OpcionVista = { k: string, t: string, sub?: boolean, n?: number }

export default function BotonVista({ opciones, valor, onChange, icono, prefijo, titulo, lista }: {
  opciones: OpcionVista[]
  valor: string
  onChange: (k: string) => void
  icono?: string
  /** Delante del valor: «Orden: Logros». */
  prefijo?: string
  titulo?: string
  /** Forzar la lista aunque haya pocas opciones. */
  lista?: boolean
}) {
  const [menu, setMenu] = useState<{ x: number, y: number } | null>(null)
  const i = Math.max(0, opciones.findIndex(o => o.k === valor))
  const actual = opciones[i]
  const enLista = lista || opciones.length > 3
  return (
    <>
      {/* El mismo aspecto que los botones de Ejercicios (Vista, Orden, Filtros): todos
          iguales en toda la biblioteca. */}
      <button type="button" className="chip-sel" title={titulo} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        onClick={e => {
          if (!enLista) { onChange(opciones[(i + 1) % opciones.length].k); return }
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
          setMenu({ x: Math.min(r.left, window.innerWidth - 240), y: r.bottom + 4 })
        }}>
        {icono && <Ic name={icono} size={14}/>}
        {prefijo ? `${prefijo}: ` : ''}{actual?.t}{actual?.n != null ? ` · ${actual.n}` : ''}
        {enLista
          ? <Ic name="abajo" size={12}/>
          : <span style={{ display: 'inline-flex', gap: 2, marginLeft: 2 }}>{opciones.map((_, k) => <i key={k} style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', opacity: k === i ? 1 : .3 }}/>)}</span>}
      </button>
      {menu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 59 }} onClick={() => setMenu(null)}/>
          <div className="menu-flot" style={{ left: menu.x, top: menu.y, maxHeight: '60vh', overflowY: 'auto', minWidth: 200 }}>
            {opciones.map(o => (
              <button key={o.k} type="button" className="menu-it" style={o.sub ? { paddingLeft: 26, color: 'var(--gr)' } : undefined}
                onClick={() => { setMenu(null); onChange(o.k) }}>
                <span style={{ flex: 1 }}>{o.t}{o.n != null ? ` · ${o.n}` : ''}</span>
                {o.k === valor && <span style={{ color: 'var(--g)', display: 'inline-flex' }}><Ic name="check" size={13}/></span>}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
