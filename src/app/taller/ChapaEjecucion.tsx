'use client'
import { useState } from 'react'

// ---------------------------------------------------------------------------
// LA CHAPA DE EJECUCION
//
// Cuantos items van bien —1/4— sobre la foto del ejercicio, y al pulsarla la
// lista para marcarlos. Antes la lista estaba siempre desplegada en su columna:
// ocupaba un tercio del ancho de cada ejercicio para algo que se mira un
// momento y se cierra. Aqui el dato cabe en una chapa y el detalle se pide.
// ---------------------------------------------------------------------------

const textoDe = (it: any) => typeof it === 'string' ? it : it?.texto

export default function ChapaEjecucion({ ej, tam = 23, itemMarcado, onToggle, onTodos,
  objetivosLib = [], objsPac = [], onObjetivo }: any) {

  const [abierto, setAbierto] = useState(false)
  const items = ej.items || []
  const total = items.length
  const marcados = items.filter((it: any) => itemMarcado(ej.items_evaluados, textoDe(it), 0)).length

  const col = total === 0 || marcados === 0 ? { background: 'var(--bm)', color: 'var(--gr)' }
    : marcados === total ? { background: 'var(--g)', color: '#fff' }
    : { background: 'var(--amb)', color: '#fff' }

  return (
    <>
      <button onClick={e => { e.stopPropagation(); if (total > 0) setAbierto(v => v === false) }}
        title={total === 0 ? 'Sin ítems de ejecución' : 'Ejecución'}
        style={{ position: 'absolute', right: -5, bottom: -5, minWidth: tam + 13, height: tam, borderRadius: 99,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
          fontSize: tam > 21 ? 10.5 : 9.5, fontWeight: 600, fontFamily: 'inherit', padding: '0 7px',
          border: '2px solid var(--w)', cursor: total > 0 ? 'pointer' : 'default',
          boxShadow: '0 1px 5px rgba(38,40,37,.20)', ...col }}>
        {total === 0 ? '—' : `${marcados}/${total}`}
      </button>

      {abierto && total > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 9px)', left: '50%', transform: 'translateX(-50%)',
          width: 246, background: 'var(--w)', border: '1px solid var(--bd)', borderRadius: 9,
          boxShadow: '0 10px 28px rgba(38,40,37,.18)', padding: '11px 12px', zIndex: 20, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--grl)', letterSpacing: .5,
              textTransform: 'uppercase' }}>Ejecución</span>
            <button onClick={() => onTodos(marcados < total)}
              style={{ marginLeft: 'auto', fontSize: 8, padding: '2px 8px', borderRadius: 99, cursor: 'pointer',
                fontFamily: 'inherit', border: '1px solid ' + (marcados === total ? 'var(--g)' : 'var(--bd)'),
                background: marcados === total ? 'var(--gl)' : 'var(--w)',
                color: marcados === total ? 'var(--gd)' : 'var(--gr)' }}>
              {marcados === total ? '✓ Todo correcto' : 'Marcar todo'}
            </button>
            <button onClick={() => setAbierto(false)} style={{ fontSize: 12, color: 'var(--gr)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕</button>
          </div>

          {items.map((it: any, ii: number) => {
            const cumple = itemMarcado(ej.items_evaluados, textoDe(it), ii)
            const objs = (it.objetivos || []).map((oid: string) => objetivosLib.find((o: any) => o.id === oid)).filter(Boolean)
            return (
              <div key={ii}>
                <div onClick={() => onToggle(ii)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                  <span style={{ width: 17, height: 17, borderRadius: 5, flexShrink: 0, color: '#fff', fontSize: 11,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1.5px solid ${cumple ? 'var(--g)' : 'var(--bd)'}`,
                    background: cumple ? 'var(--g)' : 'transparent' }}>{cumple ? '✓' : ''}</span>
                  <span style={{ fontSize: 11 }}>{textoDe(it)}</span>
                </div>
                {cumple ? null : objs.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '3px 0 4px 25px' }}>
                    {objs.map((o: any) => {
                      const ya = objsPac.some((po: any) => po.objetivo_id === o.id)
                      return (
                        <span key={o.id} onClick={() => onObjetivo(o.id)}
                          title={ya ? 'Quitar objetivo del paciente' : 'Activar este objetivo'}
                          style={{ fontSize: 8, padding: '2px 7px', borderRadius: 99, cursor: 'pointer',
                            border: '1px solid var(--g)', background: ya ? 'var(--g)' : 'var(--w)',
                            color: ya ? '#fff' : 'var(--gd)' }}>
                          {ya ? '✓ ' : '+ '}{o.nombre}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
