'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'

// Catálogo genérico: medicamentos, alergias, intolerancias, operaciones
export default function CatalogoTab({ items, tipo, tabla, campoGrupo, tema, cargar }: any) {
  const [buscar, setBuscar] = useState('')
  const [modal, setModal] = useState(false)
  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState('')

  const estilos: any = {
    neutro: { bg:'var(--bl)', border:'1px solid var(--bd)', color:'var(--n)' },
    rojo:   { bg:'var(--redl)', border:'1px solid #F5C8C8', color:'var(--red)' },
    ambar:  { bg:'var(--ambl)', border:'1px solid var(--amb)', color:'#7A5800' },
  }
  const chip = estilos[tema] || estilos.neutro
  const grupos = [...new Set((items||[]).map((i:any)=>i[campoGrupo]))]

  async function guardar() {
    if (!nombre) return
    await supabase.from(tabla).insert({ nombre, [campoGrupo]: categoria||'Otros', activo:true })
    setModal(false); setNombre(''); setCategoria(''); cargar()
  }

  return (
    <>
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
        <input className="input" placeholder="Buscar..." value={buscar} onChange={e=>setBuscar(e.target.value)} style={{flex:1}}/>
        <button className="btn btn-p btn-sm" onClick={()=>setModal(true)}>+ Añadir</button>
      </div>

      {grupos.length===0&&<div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:11}}>Sin elementos.</div>}
      {grupos.map((cat:any)=>{
        const its = (items||[]).filter((i:any)=>i[campoGrupo]===cat&&(!buscar||i.nombre.toLowerCase().includes(buscar.toLowerCase())))
        if (!its.length) return null
        return (
          <div key={cat} className="card" style={{marginBottom:8}}>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:6}}>{cat}</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {its.map((i:any)=><span key={i.id} style={{fontSize:10,padding:'3px 10px',borderRadius:99,background:chip.bg,border:chip.border,color:chip.color}}>{i.nombre}</span>)}
            </div>
          </div>
        )
      })}

      {modal&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div className="modal">
            <div className="modal-title">Añadir {tipo}<button className="modal-close" onClick={()=>setModal(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={nombre} onChange={e=>setNombre(e.target.value)} autoFocus/></div>
            <div className="field"><label>{campoGrupo==='zona'?'Zona':'Categoría'}</label><input className="input" value={categoria} onChange={e=>setCategoria(e.target.value)} placeholder="ej. Otros"/></div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModal(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={guardar}><Ic name="guardar" size={13}/> Guardar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
