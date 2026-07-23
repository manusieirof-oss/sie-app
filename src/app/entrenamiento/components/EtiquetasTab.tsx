'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'

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

export default function EtiquetasTab({ etiquetas, cargar }: any) {
  const [modalEtiqueta, setModalEtiqueta] = useState(false)
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState({ categoria:'musculo', nombre:'', padre_id:'' })

  function getNivel1(cat: string) { return etiquetas.filter((e:any)=>e.categoria===cat && !e.padre_id) }
  function getSubs(padreId: string) { return etiquetas.filter((e:any)=>e.padre_id===padreId) }

  async function crearEtiqueta() {
    if (!nuevaEtiqueta.nombre) { alert('Escribe el nombre'); return }
    await supabase.from('etiquetas').insert({ categoria:nuevaEtiqueta.categoria, nombre:nuevaEtiqueta.nombre, padre_id:nuevaEtiqueta.padre_id||null })
    setModalEtiqueta(false); setNuevaEtiqueta({ categoria:'musculo', nombre:'', padre_id:'' }); cargar()
  }

  return (
    <>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{fontSize:11,color:'var(--grl)',fontWeight:300}}>{etiquetas.length} etiquetas en total</div>
        <button className="btn btn-p btn-sm" onClick={()=>setModalEtiqueta(true)}>+ Nueva etiqueta</button>
      </div>
      <div style={{overflowX:'auto'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(9,minmax(160px,1fr))',gap:8,minWidth:1250}}>
          {CATEGORIAS.map(cat=>{
            const nivel1 = getNivel1(cat.key)
            return (
              <div key={cat.key} className="card" style={{padding:0,overflow:'hidden'}}>
                <div style={{padding:'8px 11px',background:'var(--n)',borderBottom:'1px solid var(--bd)'}}>
                  <div style={{fontSize:10,fontWeight:500,color:'#fff'}}>{cat.label}</div>
                  <div style={{fontSize:8,color:'var(--gm)',marginTop:1}}>{nivel1.length} etiquetas</div>
                </div>
                <div style={{padding:'8px 10px'}}>
                  {nivel1.map((et:any)=>{
                    const subs = getSubs(et.id)
                    return (
                      <div key={et.id} style={{marginBottom:6}}>
                        <div style={{fontSize:10,fontWeight:400,color:'var(--n)'}}>{et.nombre}</div>
                        {subs.length>0&&(
                          <div style={{marginLeft:8,borderLeft:'1.5px solid var(--bm)',paddingLeft:6,marginTop:2}}>
                            {subs.map((sub:any)=>{
                              const subsubs = getSubs(sub.id)
                              return (
                                <div key={sub.id} style={{marginBottom:2}}>
                                  <div style={{fontSize:9,fontWeight:300,color:'var(--gr)'}}>{sub.nombre}</div>
                                  {subsubs.length>0&&(
                                    <div style={{marginLeft:7,borderLeft:'1px solid var(--bm)',paddingLeft:5}}>
                                      {subsubs.map((ss:any)=>(
                                        <div key={ss.id} style={{fontSize:8,fontWeight:300,color:'var(--grl)'}}>{ss.nombre}</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {modalEtiqueta&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalEtiqueta(false)}}>
          <div className="modal">
            <div className="modal-title">Nueva etiqueta<button className="modal-close" onClick={()=>setModalEtiqueta(false)}>✕</button></div>
            <div className="field"><label>Categoría</label>
              <select className="input" value={nuevaEtiqueta.categoria} onChange={e=>setNuevaEtiqueta(p=>({...p,categoria:e.target.value,padre_id:''}))}>
                {CATEGORIAS.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div className="field"><label>Etiqueta padre (si es subetiqueta)</label>
              <select className="input" value={nuevaEtiqueta.padre_id} onChange={e=>setNuevaEtiqueta(p=>({...p,padre_id:e.target.value}))}>
                <option value="">— Es etiqueta principal —</option>
                {etiquetas.filter((e:any)=>e.categoria===nuevaEtiqueta.categoria).map((e:any)=>{
                  const prefijo = e.padre_id?(etiquetas.find((p:any)=>p.id===e.padre_id)?.nombre||'')+' › ':''
                  return <option key={e.id} value={e.id}>{prefijo}{e.nombre}</option>
                })}
              </select>
            </div>
            <div className="field"><label>Nombre *</label>
              <input className="input" value={nuevaEtiqueta.nombre} onChange={e=>setNuevaEtiqueta(p=>({...p,nombre:e.target.value}))} autoFocus placeholder="ej. Bíceps Femoral"/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEtiqueta(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearEtiqueta}><Ic name="guardar" size={13}/> Guardar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
