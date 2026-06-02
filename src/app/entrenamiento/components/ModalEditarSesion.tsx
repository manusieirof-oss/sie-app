'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ModalEditarSesion({ sesion, ejercicios, onGuardado, onCerrar }: {
  sesion: any
  ejercicios: any[]
  onGuardado: () => void
  onCerrar: () => void
}) {
  const [formSesion, setFormSesion] = useState({
    nombre: sesion.nombre || '',
    descripcion: sesion.descripcion || '',
    partes: sesion.partes || []
  })
  const [parteActiva, setParteActiva] = useState(0)
  const [buscarEj, setBuscarEj] = useState('')
  const [guardando, setGuardando] = useState(false)

  const ejFiltrados = ejercicios.filter(e => !buscarEj || e.nombre.toLowerCase().includes(buscarEj.toLowerCase()))

  function addEjercicio(ej: any) {
    setFormSesion(prev => {
      const partes = [...prev.partes]
      const configEj = { ejercicio_id:ej.id, nombre:ej.nombre, variante:'Bilateral', capacidad:'Fuerza', series:'3', reps:'10', peso:'', tiempo:'', nota:'', imagen_url:ej.imagen_url||'' }
      partes[parteActiva] = { ...partes[parteActiva], ejercicios: [...(partes[parteActiva].ejercicios||[]), configEj] }
      return { ...prev, partes }
    })
  }

  function quitarEjercicio(parteIdx: number, ejIdx: number) {
    setFormSesion(prev => {
      const partes = [...prev.partes]
      partes[parteIdx] = { ...partes[parteIdx], ejercicios: partes[parteIdx].ejercicios.filter((_:any, i:number) => i !== ejIdx) }
      return { ...prev, partes }
    })
  }

  async function guardarSesion() {
    if (!formSesion.nombre) { alert('El nombre es obligatorio'); return }
    setGuardando(true)
    await supabase.from('sesiones').update({ nombre:formSesion.nombre, descripcion:formSesion.descripcion, partes:formSesion.partes }).eq('id', sesion.id)
    setGuardando(false)
    onGuardado()
    onCerrar()
  }

  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onCerrar()}}>
      <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'90vw',maxWidth:900,maxHeight:'90vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,.15)'}}>
        {/* CABECERA */}
        <div style={{padding:'14px 18px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10}}>
          <div style={{flex:1}}>
            <input className="input" value={formSesion.nombre} onChange={e=>setFormSesion(p=>({...p,nombre:e.target.value}))} placeholder="Nombre de la sesión *" style={{fontSize:14,fontWeight:400,border:'none',background:'transparent',padding:'0',outline:'none',width:'100%'}} autoFocus/>
            <input className="input" value={formSesion.descripcion} onChange={e=>setFormSesion(p=>({...p,descripcion:e.target.value}))} placeholder="Descripción / objetivo (opcional)" style={{fontSize:11,color:'var(--grl)',border:'none',background:'transparent',padding:'0',outline:'none',width:'100%',marginTop:3}}/>
          </div>
          <button className="btn btn-p" onClick={guardarSesion} disabled={guardando}>{guardando?'⏳':'💾 Guardar'}</button>
          <button onClick={onCerrar} style={{width:24,height:24,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',fontSize:12,color:'var(--gr)'}}>✕</button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 320px',flex:1,overflow:'hidden'}}>
          {/* IZQUIERDA — PARTES */}
          <div style={{overflowY:'auto',padding:14,borderRight:'1px solid var(--bd)'}}>
            <div style={{display:'flex',gap:4,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
              {formSesion.partes.map((p:any,i:number)=>(
                <button key={i} onClick={()=>setParteActiva(i)}
                  style={{fontSize:10,padding:'4px 10px',borderRadius:99,border:`1.5px solid ${parteActiva===i?'var(--g)':'var(--bd)'}`,background:parteActiva===i?'var(--g)':'var(--w)',color:parteActiva===i?'#fff':'var(--gr)',cursor:'pointer',fontFamily:'system-ui'}}>
                  {p.nombre} <span style={{opacity:.7}}>({(p.ejercicios||[]).length})</span>
                </button>
              ))}
              <button onClick={()=>{setFormSesion(p=>({...p,partes:[...p.partes,{nombre:`Parte ${p.partes.length+1}`,ejercicios:[]}]}));setParteActiva(formSesion.partes.length)}}
                style={{fontSize:10,padding:'4px 10px',borderRadius:99,border:'1.5px dashed var(--bd)',background:'var(--w)',color:'var(--grl)',cursor:'pointer',fontFamily:'system-ui'}}>
                + Parte
              </button>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <input className="input" value={formSesion.partes[parteActiva]?.nombre||''}
                onChange={e=>setFormSesion(prev=>{const p=[...prev.partes];p[parteActiva]={...p[parteActiva],nombre:e.target.value};return{...prev,partes:p}})}
                style={{fontWeight:500,fontSize:12}}/>
              {formSesion.partes.length>1&&(
                <button onClick={()=>{setFormSesion(prev=>({...prev,partes:prev.partes.filter((_:any,i:number)=>i!==parteActiva)}));setParteActiva(Math.max(0,parteActiva-1))}}
                  className="btn btn-d btn-sm">🗑 Eliminar parte</button>
              )}
            </div>
            {(formSesion.partes[parteActiva]?.ejercicios||[]).length===0?(
              <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:10,border:'1.5px dashed var(--bm)',borderRadius:'var(--rl)'}}>
                Selecciona ejercicios de la biblioteca →
              </div>
            ):(
              (formSesion.partes[parteActiva]?.ejercicios||[]).map((ej:any,ei:number)=>(
                <div key={ei} style={{background:'var(--bl)',borderRadius:7,border:'1px solid var(--bd)',marginBottom:6,overflow:'hidden'}}>
                  <div style={{display:'flex',alignItems:'center',gap:7,padding:'7px 9px'}}>
                    {ej.imagen_url?<img src={ej.imagen_url} alt={ej.nombre} style={{width:36,height:36,objectFit:'cover',borderRadius:4,flexShrink:0}}/>:<div style={{width:36,height:36,background:'var(--bm)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>💪</div>}
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{ej.nombre}</div>
                      <div style={{display:'flex',gap:3,marginTop:2}}>
                        {ej.variante&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{ej.variante}</span>}
                        {ej.capacidad&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>{ej.capacidad}</span>}
                      </div>
                    </div>
                    <button onClick={()=>quitarEjercicio(parteActiva,ei)} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 5px'}}>✕</button>
                  </div>
                  <div style={{padding:'5px 9px 8px',borderTop:'1px solid var(--bm)',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                    {[['series','Series',40],['reps','Reps',40],['peso','Kg',40],['tiempo','Seg',40]].map(([k,l,w]:any)=>(
                      <div key={k} style={{display:'flex',alignItems:'center',gap:3}}>
                        <span style={{fontSize:9,color:'var(--grl)'}}>{l}</span>
                        <input type="number" value={(ej as any)[k]||''} onChange={e=>{
                          setFormSesion(prev=>{
                            const partes=[...prev.partes]
                            const ejercicios=[...partes[parteActiva].ejercicios]
                            ejercicios[ei]={...ejercicios[ei],[k]:e.target.value}
                            partes[parteActiva]={...partes[parteActiva],ejercicios}
                            return{...prev,partes}
                          })
                        }} style={{width:w,fontSize:11,padding:'2px 4px',border:'1px solid var(--bd)',borderRadius:4,textAlign:'center',fontFamily:'system-ui'}} placeholder="—"/>
                      </div>
                    ))}
                    <input value={ej.nota||''} onChange={e=>{
                      setFormSesion(prev=>{
                        const partes=[...prev.partes]
                        const ejercicios=[...partes[parteActiva].ejercicios]
                        ejercicios[ei]={...ejercicios[ei],nota:e.target.value}
                        partes[parteActiva]={...partes[parteActiva],ejercicios}
                        return{...prev,partes}
                      })
                    }} style={{flex:1,fontSize:10,padding:'2px 6px',border:'1px solid var(--bd)',borderRadius:4,fontFamily:'system-ui',minWidth:80}} placeholder="📝 Nota..."/>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DERECHA — BIBLIOTECA */}
          <div style={{overflowY:'auto',padding:10,background:'var(--bl)'}}>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:7}}>Biblioteca de ejercicios</div>
            <input className="input" placeholder="🔍 Buscar..." value={buscarEj} onChange={e=>setBuscarEj(e.target.value)} style={{marginBottom:8,fontSize:11}}/>
            {ejFiltrados.map((e:any)=>(
              <div key={e.id} onClick={()=>addEjercicio(e)}
                style={{display:'flex',alignItems:'center',gap:7,padding:'6px 8px',background:'var(--w)',borderRadius:6,border:'1px solid var(--bd)',marginBottom:4,cursor:'pointer'}}
                onMouseOver={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                onMouseOut={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                {e.imagen_url?<img src={e.imagen_url} alt={e.nombre} style={{width:28,height:28,objectFit:'cover',borderRadius:3,flexShrink:0}}/>:<div style={{width:28,height:28,background:'var(--bm)',borderRadius:3,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>💪</div>}
                <span style={{fontSize:10,color:'var(--n)',flex:1,fontWeight:300}}>{e.nombre}</span>
                <span style={{fontSize:12,color:'var(--g)'}}>+</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
