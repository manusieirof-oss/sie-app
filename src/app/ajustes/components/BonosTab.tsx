'use client'
import { useState } from 'react'

export default function BonosTab({ bonos, setBonos }: any) {
  const [modalBono, setModalBono] = useState(false)
  const [nuevoBono, setNuevoBono] = useState({ nombre:'', dias:2, descripcion:'' })

  return (
    <div>
      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <div className="card-title" style={{margin:0}}>🎫 Tipos de bono</div>
          <button className="btn btn-p btn-sm" onClick={()=>setModalBono(true)}>+ Nuevo bono</button>
        </div>
        {bonos.map((b:any,i:number)=>(
          <div key={b.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:6,border:'1px solid var(--bd)',marginBottom:6,background:'var(--bl)'}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:'var(--g)',flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{b.nombre}</div>
              <div style={{fontSize:9,color:'var(--grl)'}}>{b.descripcion} · {b.dias} día{b.dias!==1?'s':''}/semana</div>
            </div>
            <button onClick={()=>setBonos((p:any)=>p.filter((_:any,j:number)=>j!==i))} style={{fontSize:10,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>🗑</button>
          </div>
        ))}
      </div>
      {modalBono&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalBono(false)}}>
          <div className="modal">
            <div className="modal-title">Nuevo bono<button className="modal-close" onClick={()=>setModalBono(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevoBono.nombre} onChange={e=>setNuevoBono(p=>({...p,nombre:e.target.value}))} autoFocus placeholder="ej. Premium"/></div>
            <div className="field"><label>Días por semana</label><input className="input" type="number" value={nuevoBono.dias} onChange={e=>setNuevoBono(p=>({...p,dias:parseInt(e.target.value)||1}))}/></div>
            <div className="field"><label>Descripción</label><input className="input" value={nuevoBono.descripcion} onChange={e=>setNuevoBono(p=>({...p,descripcion:e.target.value}))} placeholder="ej. 3 días/semana + 1 individual"/></div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalBono(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={()=>{
                if(!nuevoBono.nombre) return
                setBonos((p:any)=>[...p,{id:nuevoBono.nombre.toLowerCase().replace(/\s/g,'_'),nombre:nuevoBono.nombre,dias:nuevoBono.dias,descripcion:nuevoBono.descripcion}])
                setNuevoBono({nombre:'',dias:2,descripcion:''})
                setModalBono(false)
              }}>💾 Añadir bono</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
