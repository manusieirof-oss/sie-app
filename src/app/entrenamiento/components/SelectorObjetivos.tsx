'use client'
import { useState } from 'react'
import { contiene } from '@/lib/texto'
import { categoriaDe, zonasDe, casaZona } from '@/lib/etiquetas'
import FiltroZonas from '@/components/FiltroZonas'
import MonedaObjetivo from '@/components/MonedaObjetivo'
import ModalObjetivo from './ModalObjetivo'

// ---------------------------------------------------------------------------
// ELEGIR OBJETIVOS, COMO EN SU BIBLIOTECA
//
// Un objetivo se reconoce por su moneda, y se encuentra por zona o por nombre:
// las mismas dos formas que en la biblioteca, porque es el mismo catalogo y
// aprender a buscarlo dos veces no tiene sentido.
//
// Y al marcarlo salen sus ESPECIFICOS: "Movilidad de rodilla" no es lo mismo
// si la fase pide solo la flexion que si las pide todas.
// ---------------------------------------------------------------------------

export default function SelectorObjetivos({ objetivos, ya = [], titulo = 'Añadir objetivos',
  tests = [], etiquetas = [], onRecargarBiblio, onCerrar, onElegir }: any) {

  const [busca, setBusca] = useState('')
  const [zona, setZona] = useState('')
  const [marcados, setMarcados] = useState<string[]>([])
  const [espSel, setEspSel] = useState<Record<string, string[]>>({})
  const [creando, setCreando] = useState(false)

  const nombreEt = (id: string) => etiquetas.find((e: any) => e.id === id)?.nombre || id
  const zonaIdsDe = (o: any) => [o?.articulacion_id, ...(o?.etiquetas || [])].filter(Boolean)

  const zonasUsadas = Array.from(new Set((objetivos || []).flatMap(zonaIdsDe)))
    .filter((id: any) => {
      const et = etiquetas.find((e: any) => e.id === id)
      return et != null && categoriaDe(etiquetas, et) === 'articulacion'
    }) as string[]
  const sinZona = (objetivos || []).filter((o: any) => zonasDe(etiquetas, zonaIdsDe(o)).length === 0).length

  const alternar = (id: string) =>
    setMarcados(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const nacido = (id?: string) => {
    if (id) setMarcados(p => [...p, id])
    onRecargarBiblio?.()
  }

  const lista = (objetivos || [])
    .filter((o: any) => ya.includes(o.id) === false)
    .filter((o: any) => contiene(o.nombre || '', busca) || contiene(o.descripcion || '', busca))
    .filter((o: any) => casaZona(etiquetas, zonaIdsDe(o), zona))

  const conEsp = (objetivos || []).filter((o: any) =>
    marcados.includes(o.id) && (o.movimientos || []).length > 0)

  return (
    <div className="modal-bg" style={{ zIndex: 150 }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div style={{ background:'var(--w)', border:'1px solid var(--bd)', borderRadius:14, width:'94vw',
        maxWidth:700, maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden',
        boxShadow:'var(--sh-md)' }}>

        <div style={{ padding:'13px 17px', borderBottom:'1px solid var(--bd)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1, fontSize:16, fontWeight:500 }}>{titulo}</div>
          <button className="btn btn-s btn-sm" onClick={() => setCreando(true)}>+ Nuevo objetivo</button>
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>

        <div style={{ padding:'11px 17px 0' }}>
          <input className="input" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar objetivo por nombre…"/>
          {zonasUsadas.length > 0 && (
            <div style={{ display:'flex', alignItems:'flex-start', gap:6, marginTop:9 }}>
              <span style={{ fontSize:8, fontWeight:600, color:'var(--grl)', letterSpacing:.4,
                textTransform:'uppercase', width:36, paddingTop:3 }}>Zona</span>
              <div style={{ flex:1, minWidth:0 }}>
                <FiltroZonas compacto etiquetas={etiquetas} usadas={zonasUsadas}
                  valor={zona} onChange={setZona} nSinZona={sinZona}/>
              </div>
            </div>
          )}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'12px 17px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(112px,1fr))', gap:10 }}>
            {lista.map((o: any) => {
              const on = marcados.includes(o.id)
              return (
                <div key={o.id} onClick={() => alternar(o.id)}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'10px 6px',
                    borderRadius:9, cursor:'pointer',
                    border:`1px solid ${on ? 'var(--g)' : 'var(--bd)'}`,
                    background: on ? 'var(--gl)' : 'var(--w)' }}>
                  <MonedaObjetivo objetivo={o} tam="g"/>
                  <span style={{ fontSize:10.5, textAlign:'center', lineHeight:1.3, color:'var(--n)' }}>{o.nombre}</span>
                  {(o.movimientos || []).length > 0 && (
                    <span style={{ fontSize:9, color:'var(--grl)' }}>
                      {(o.movimientos || []).length} específicos
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          {lista.length === 0 && (
            <div className="muted">
              {(objetivos || []).length === 0
                ? 'No hay objetivos en la biblioteca todavía.'
                : 'Ninguno coincide, o ya están todos puestos.'}
            </div>
          )}

          {/* QUE SE LE PIDE DE CADA UNO. Sin elegir ninguno se pide el objetivo entero. */}
          {conEsp.length > 0 && (
            <div style={{ marginTop:14, borderTop:'1px solid var(--bd)', paddingTop:12 }}>
              {conEsp.map((o: any) => (
                <div key={o.id} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, color:'var(--gr)', marginBottom:5 }}>
                    Qué se pide de <b style={{ color:'var(--n)' }}>{o.nombre}</b>
                  </div>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {(o.movimientos || []).map((mid: string) => {
                      const on = (espSel[o.id] || []).includes(mid)
                      return (
                        <button key={mid} className={`chip-sel ${on ? 'on' : ''}`}
                          onClick={() => setEspSel(prev => {
                            const yaS = prev[o.id] || []
                            return { ...prev, [o.id]: yaS.includes(mid)
                              ? yaS.filter(x => x !== mid) : [...yaS, mid] }
                          })}>{nombreEt(mid)}</button>
                      )
                    })}
                  </div>
                  {(espSel[o.id] || []).length === 0 && (
                    <div style={{ fontSize:10, color:'var(--grl)', marginTop:4 }}>
                      Sin elegir ninguno se pide el objetivo entero.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding:'12px 17px', borderTop:'1px solid var(--bd)', display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:11, color:'var(--gr)' }}>
            {marcados.length === 0 ? 'Ninguno marcado' : `${marcados.length} marcado${marcados.length === 1 ? '' : 's'}`}
          </span>
          <div style={{ flex:1 }}/>
          <button className="btn btn-s" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-p" disabled={marcados.length === 0}
            onClick={() => { onElegir(marcados, espSel); onCerrar() }}>Añadir</button>
        </div>

        {creando && (
          <ModalObjetivo objetivo={null} tests={tests} etiquetas={etiquetas}
            onGuardado={nacido} onCerrar={() => setCreando(false)}/>
        )}
      </div>
    </div>
  )
}
