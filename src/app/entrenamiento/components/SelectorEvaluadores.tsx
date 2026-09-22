'use client'
import { useEffect, useState } from 'react'
import { contiene } from '@/lib/texto'
import { cargarEvaluadores } from '@/lib/objetivosTests'
import { esCuestionario, preguntasDe } from '@/lib/cuestionarios'
import { categoriaDe, zonasDe, casaZona } from '@/lib/etiquetas'
import FiltroZonas from '@/components/FiltroZonas'

// ---------------------------------------------------------------------------
// CON QUE SE EVALUA UN OBJETIVO
//
// Tests y cuestionarios en la misma rejilla, separados por bloque: son dos
// cosas distintas de hacer —una se mide, la otra se pregunta— pero las dos
// dicen si el objetivo esta conseguido, asi que se eligen juntas.
// ---------------------------------------------------------------------------

export default function SelectorEvaluadores({ ya = [], etiquetas = [], onCerrar, onElegir }: {
  ya?: string[]
  etiquetas?: any[]
  onCerrar: () => void
  onElegir: (ids: string[]) => void
}) {
  const [zona, setZona] = useState('')
  const [todos, setTodos] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [marcados, setMarcados] = useState<string[]>([])

  useEffect(() => { cargarEvaluadores().then(setTodos) }, [])

  const alternar = (id: string) =>
    setMarcados(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  // La zona de un test vive en `etiquetas_relacionadas`, igual que en su biblioteca.
  const zonasDeTest = (t: any) => (t?.etiquetas_relacionadas || []) as string[]

  const zonasUsadas = Array.from(new Set(todos.flatMap(zonasDeTest)))
    .filter(id => {
      const et = etiquetas.find((e: any) => e.id === id)
      return et != null && categoriaDe(etiquetas, et) === 'articulacion'
    })
  const sinZona = todos.filter(t => zonasDe(etiquetas, zonasDeTest(t)).length === 0).length

  const lista = todos
    .filter(t => ya.includes(t.id) === false)
    .filter(t => contiene(t.nombre || '', busca) || contiene(t.descripcion || '', busca))
    .filter(t => casaZona(etiquetas, zonasDeTest(t), zona))

  const bloques = [
    { clave: 'test', titulo: 'Tests', los: lista.filter(t => esCuestionario(t) === false) },
    { clave: 'cues', titulo: 'Cuestionarios', los: lista.filter(esCuestionario) },
  ]

  return (
    <div className="modal-bg" style={{ zIndex: 150 }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div style={{ background:'var(--w)', border:'1px solid var(--bd)', borderRadius:14, width:'94vw',
        maxWidth:680, maxHeight:'88vh', display:'flex', flexDirection:'column', overflow:'hidden',
        boxShadow:'var(--sh-md)' }}>

        <div style={{ padding:'13px 17px', borderBottom:'1px solid var(--bd)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1, fontSize:16, fontWeight:500 }}>Con qué se evalúa</div>
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>

        <div style={{ padding:'11px 17px 0' }}>
          <input className="input" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar test o cuestionario…"/>
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
          {bloques.map(b => b.los.length === 0 ? null : (
            <div key={b.clave} style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:500, color:'var(--gr)', letterSpacing:'.5px',
                textTransform:'uppercase', marginBottom:8 }}>{b.titulo}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(205px,1fr))', gap:9 }}>
                {b.los.map(t => {
                  const on = marcados.includes(t.id)
                  const n = esCuestionario(t) ? preguntasDe(t).length : (Array.isArray(t.items) ? t.items.length : 0)
                  return (
                    <div key={t.id} onClick={() => alternar(t.id)}
                      style={{ border:`1px solid ${on ? 'var(--g)' : 'var(--bd)'}`, borderRadius:8,
                        padding:'10px 11px', cursor:'pointer', background: on ? 'var(--gl)' : 'var(--w)',
                        display:'flex', alignItems:'center', gap:9 }}>
                      <span style={{ width:17, height:17, borderRadius:5, flexShrink:0,
                        border:`1.5px solid ${on ? 'var(--g)' : 'var(--bd)'}`, background: on ? 'var(--g)' : 'transparent',
                        color:'#fff', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {on ? '✓' : ''}
                      </span>
                      {/* La foto es lo que distingue un test de otro de un vistazo, igual
                          que en la valoracion. El cuestionario no la tiene: lleva su marca. */}
                      {t.imagen_url
                        ? <img src={t.imagen_url} alt="" style={{ width:46, height:46, objectFit:'contain',
                            background:'var(--bm)', borderRadius:6, flexShrink:0 }}/>
                        : <span style={{ width:46, height:46, borderRadius:6, background:'var(--bm)',
                            color:'var(--grl)', fontSize:17, flexShrink:0, display:'flex',
                            alignItems:'center', justifyContent:'center' }}>
                            {esCuestionario(t) ? '✎' : '◎'}
                          </span>}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12.5, color:'var(--n)' }}>{t.nombre}</div>
                        <div style={{ fontSize:10.5, color:'var(--gr)', marginTop:2 }}>
                          {n} {esCuestionario(t) ? (n === 1 ? 'pregunta' : 'preguntas') : (n === 1 ? 'ítem' : 'ítems')}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {lista.length === 0 && <div className="muted">Nada que coincida, o ya están todos puestos.</div>}
        </div>

        <div style={{ padding:'12px 17px', borderTop:'1px solid var(--bd)', display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:11, color:'var(--gr)' }}>
            {marcados.length === 0 ? 'Ninguno marcado' : `${marcados.length} marcado${marcados.length === 1 ? '' : 's'}`}
          </span>
          <div style={{ flex:1 }}/>
          <button className="btn btn-s" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-p" disabled={marcados.length === 0}
            onClick={() => { onElegir(marcados); onCerrar() }}>Añadir</button>
        </div>
      </div>
    </div>
  )
}
