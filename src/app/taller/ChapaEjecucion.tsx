'use client'
import { useRef, useState } from 'react'
import Flotante from './Flotante'
import { Ic } from '@/lib/icons'

// ---------------------------------------------------------------------------
// LA CHAPA DE EJECUCION (Y FEEDBACKS)
//
// Ejecucion y feedbacks se miran en el mismo momento -como se hace y como
// corregirlo- y eran dos chapas en dos esquinas. Ahora es una: el contador de
// ejecucion con un bocadillo si hay feedbacks, y al abrirla las dos listas.
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
  const ancla = useRef<HTMLButtonElement>(null)
  const items = ej.items || []
  const total = items.length
  const marcados = items.filter((it: any) => itemMarcado(ej.items_evaluados, textoDe(it), 0)).length
  const fbs = (ej.feedbacks || []).filter((f: any) => textoDe(f))
  const hay = total > 0 || fbs.length > 0

  const col = total === 0 || marcados === 0 ? { background: 'var(--bm)', color: 'var(--gr)' }
    : marcados === total ? { background: 'var(--g)', color: '#fff' }
    : { background: 'var(--amb)', color: '#fff' }

  return (
    <>
      <button ref={ancla} onClick={e => { e.stopPropagation(); if (hay) setAbierto(v => v === false) }}
        title={!hay ? 'Sin ejecución ni feedbacks' : 'Ejecución y feedbacks'}
        style={{ position: 'absolute', right: 5, bottom: 5, minWidth: total ? tam + 13 : tam, height: tam, borderRadius: 99,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
          fontSize: tam > 21 ? 10.5 : 9.5, fontWeight: 600, fontFamily: 'inherit', padding: '0 7px',
          border: '2px solid var(--w)', cursor: hay ? 'pointer' : 'default',
          boxShadow: '0 1px 5px rgba(38,40,37,.20)', ...col }}>
        {total === 0 ? (fbs.length ? '' : '—') : `${marcados}/${total}`}
        {fbs.length > 0 && <Ic name="mensaje" size={11}/>}
      </button>

      <Flotante abierto={abierto && hay} ancla={ancla} onCerrar={() => setAbierto(false)} ancho={262}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--grl)', letterSpacing: .5,
              textTransform: 'uppercase' }}>Ejecución</span>
            {total > 0 && <button onClick={() => onTodos(marcados < total)}
              style={{ marginLeft: 'auto', fontSize: 8, padding: '2px 8px', borderRadius: 99, cursor: 'pointer',
                fontFamily: 'inherit', border: '1px solid ' + (marcados === total ? 'var(--g)' : 'var(--bd)'),
                background: marcados === total ? 'var(--gl)' : 'var(--w)',
                color: marcados === total ? 'var(--gd)' : 'var(--gr)' }}>
              {marcados === total ? '✓ Todo correcto' : 'Marcar todo'}
            </button>}
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
                {cumple || !onObjetivo ? null : objs.length > 0 && (
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
          {total === 0 && <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 2 }}>Sin ítems de ejecución.</div>}

          {fbs.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--bl)' }}>
              <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--grl)', letterSpacing: .5,
                textTransform: 'uppercase', marginBottom: 6 }}>Cómo hacerlo mejor</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {fbs.map((f: any, fi: number) => (
                  <span key={fi} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99,
                    background: 'var(--bl)', color: 'var(--n)', lineHeight: 1.4 }}>«{textoDe(f)}»</span>
                ))}
              </div>
            </div>
          )}
      </Flotante>
    </>
  )
}
