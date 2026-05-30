'use client'
import { useState } from 'react'

export default function PatologiasTab({ patologiasBiblio }: any) {
  const [buscarPat, setBuscarPat] = useState('')
  const [patSeleccionada, setPatSeleccionada] = useState<any>(null)
  const filtradas = patologiasBiblio.filter((p:any)=>!buscarPat||p.nombre.toLowerCase().includes(buscarPat.toLowerCase())||p.zona.toLowerCase().includes(buscarPat.toLowerCase())||p.sistema.toLowerCase().includes(buscarPat.toLowerCase()))
  const zonas = [...new Set(filtradas.map((p:any)=>p.zona))]

  return (
    <>
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
        <input className="input" placeholder="🔍 Buscar patología..." value={buscarPat} onChange={e=>setBuscarPat(e.target.value)} style={{flex:1}}/>
        <span style={{fontSize:10,color:'var(--grl)'}}>{filtradas.length} patologías</span>
      </div>
      {zonas.map((zona:any)=>{
        const items = filtradas.filter((p:any)=>p.zona===zona)
        return (
          <div key={zona} className="card" style={{marginBottom:8}}>
            <div className="card-title">📍 {zona}</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
              {items.map((p:any)=>(
                <div key={p.id} onClick={()=>setPatSeleccionada(patSeleccionada?.id===p.id?null:p)}
                  style={{padding:'4px 10px',borderRadius:99,border:`1px solid ${patSeleccionada?.id===p.id?'var(--g)':'var(--bd)'}`,background:patSeleccionada?.id===p.id?'var(--gl)':'var(--w)',cursor:'pointer',fontSize:10,color:patSeleccionada?.id===p.id?'var(--gd)':'var(--n)'}}>
                  {p.nombre}
                </div>
              ))}
            </div>
            {patSeleccionada&&items.some((i:any)=>i.id===patSeleccionada.id)&&(
              <div style={{marginTop:10,padding:'10px 12px',background:'var(--bl)',borderRadius:6,border:'1px solid var(--bd)'}}>
                <div style={{display:'flex',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                  <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{patSeleccionada.sistema}</span>
                  <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:patSeleccionada.gravedad_tipica==='severa'?'var(--redl)':patSeleccionada.gravedad_tipica==='moderada'?'var(--ambl)':'var(--gl)',color:patSeleccionada.gravedad_tipica==='severa'?'var(--red)':patSeleccionada.gravedad_tipica==='moderada'?'#7A5800':'var(--gd)'}}>
                    {patSeleccionada.gravedad_tipica}
                  </span>
                </div>
                {patSeleccionada.descripcion&&<div style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.5,marginBottom:6}}>{patSeleccionada.descripcion}</div>}
                {patSeleccionada.precauciones&&(
                  <div style={{padding:'6px 9px',background:'var(--ambl)',borderRadius:5,border:'1px solid var(--amb)',fontSize:9,color:'#7A5800'}}>
                    ⚠️ <strong>Precauciones:</strong> {patSeleccionada.precauciones}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
