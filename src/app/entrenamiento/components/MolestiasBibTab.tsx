'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'

export default function MolestiasBibTab({ molestiasBiblio }: any) {
  const [buscarMol, setBuscarMol] = useState('')
  const filtradas = molestiasBiblio.filter((m:any)=>!buscarMol||m.nombre.toLowerCase().includes(buscarMol.toLowerCase())||m.zona.toLowerCase().includes(buscarMol.toLowerCase()))
  const zonas = [...new Set(filtradas.map((m:any)=>m.zona))]

  return (
    <>
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
        <input className="input" placeholder="Buscar molestia..." value={buscarMol} onChange={e=>setBuscarMol(e.target.value)} style={{flex:1}}/>
        <span style={{fontSize:10,color:'var(--grl)'}}>{filtradas.length} molestias</span>
      </div>
      {zonas.map((zona:any)=>{
        const items = filtradas.filter((m:any)=>m.zona===zona)
        return (
          <div key={zona} className="card" style={{marginBottom:8}}>
            <div className="card-title"><span className="ct-l"><Ic name="ubicacion"/> {zona}</span></div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
              {items.map((m:any)=>(
                <span key={m.id} style={{fontSize:10,padding:'4px 10px',borderRadius:99,background:'var(--redl)',border:'1px solid #F5C8C8',color:'var(--red)'}}>{m.nombre}</span>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}
