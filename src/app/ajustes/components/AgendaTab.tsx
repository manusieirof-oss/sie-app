'use client'
import { useState } from 'react'

export default function AgendaTab({ tiposCita, setTiposCita }: any) {
  const [modal, setModal] = useState(false)
  const [nuevo, setNuevo] = useState({ nombre:'', color:'#5A969E', duracion:50, cuenta_clase:false })

  function actualizar(i:number, campo:string, valor:any) {
    setTiposCita((p:any)=>p.map((t:any,j:number)=>j===i?{...t,[campo]:valor}:t))
  }

  return (
    <div>
      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <div className="card-title" style={{margin:0}}>📅 Tipos de cita</div>
          <button className="btn btn-p btn-sm" onClick={()=>setModal(true)}>+ Nuevo tipo</button>
        </div>
        <div style={{fontSize:9,color:'var(--grl)',marginBottom:10}}>Define los tipos de cita (clases, consultas, llamadas...), su color en la agenda y su duración.</div>
        {tiposCita.map((t:any,i:number)=>(
          <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:6,border:'1px solid var(--bd)',marginBottom:6,background:'var(--bl)'}}>
            <input type="color" value={t.color} onChange={e=>actualizar(i,'color',e.target.value)} style={{width:26,height:26,border:'none',borderRadius:6,cursor:'pointer',background:'none',flexShrink:0}} title="Color en la agenda"/>
            <div style={{flex:1}}>
              <input className="input" value={t.nombre} onChange={e=>actualizar(i,'nombre',e.target.value)} style={{fontSize:11,padding:'4px 8px',marginBottom:3}}/>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <label style={{fontSize:9,color:'var(--grl)',display:'flex',alignItems:'center',gap:4}}>
                  Duración:
                  <input className="input" type="number" value={t.duracion} onChange={e=>actualizar(i,'duracion',parseInt(e.target.value)||0)} style={{width:54,fontSize:9,padding:'2px 5px'}}/>
                  min
                </label>
                <label style={{fontSize:9,color:'var(--grl)',display:'flex',alignItems:'center',gap:4,cursor:'pointer'}}>
                  <input type="checkbox" checked={!!t.cuenta_clase} onChange={e=>actualizar(i,'cuenta_clase',e.target.checked)} style={{accentColor:'var(--g)'}}/>
                  Cuenta como clase
                </label>
              </div>
            </div>
            <button onClick={()=>setTiposCita((p:any)=>p.filter((_:any,j:number)=>j!==i))} style={{fontSize:10,color:'var(--red)',background:'none',border:'none',cursor:'pointer',flexShrink:0}}>🗑</button>
          </div>
        ))}
      </div>
      {modal&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div className="modal">
            <div className="modal-title">Nuevo tipo de cita<button className="modal-close" onClick={()=>setModal(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevo.nombre} onChange={e=>setNuevo(p=>({...p,nombre:e.target.value}))} autoFocus placeholder="ej. Consulta, Llamada..."/></div>
            <div className="g2">
              <div className="field"><label>Color</label><input type="color" value={nuevo.color} onChange={e=>setNuevo(p=>({...p,color:e.target.value}))} className="input" style={{height:38,padding:3,cursor:'pointer'}}/></div>
              <div className="field"><label>Duración (min)</label><input className="input" type="number" value={nuevo.duracion} onChange={e=>setNuevo(p=>({...p,duracion:parseInt(e.target.value)||0}))}/></div>
            </div>
            <div onClick={()=>setNuevo(p=>({...p,cuenta_clase:!p.cuenta_clase}))} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:6,border:`1px solid ${nuevo.cuenta_clase?'var(--g)':'var(--bd)'}`,background:nuevo.cuenta_clase?'var(--gl)':'var(--w)',cursor:'pointer',marginBottom:10}}>
              <div style={{width:16,height:16,borderRadius:3,border:`2px solid ${nuevo.cuenta_clase?'var(--g)':'var(--bd)'}`,background:nuevo.cuenta_clase?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{nuevo.cuenta_clase&&<span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}</div>
              <span style={{fontSize:10,color:'var(--n)'}}>Cuenta como clase (para el total de personas del día)</span>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModal(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={()=>{
                if(!nuevo.nombre) return
                setTiposCita((p:any)=>[...p,{id:nuevo.nombre.toLowerCase().replace(/\s/g,'_')+'_'+Date.now(),nombre:nuevo.nombre,color:nuevo.color,duracion:nuevo.duracion,cuenta_clase:nuevo.cuenta_clase}])
                setNuevo({nombre:'',color:'#5A969E',duracion:50,cuenta_clase:false})
                setModal(false)
              }}>💾 Añadir tipo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
